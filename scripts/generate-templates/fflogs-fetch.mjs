import { API_DELAY_MS } from './config.mjs';
import { gql, sleep } from './api.mjs';

// ─── Step 3: Fetch best single log (死亡0・JP・遅いキル優先) ───
export async function findBestLog(token, encounterId) {
    // JPリージョンの遅いキルから死亡0のログを探す
    // 見つからなければグローバルも探す
    for (const region of ['JP', undefined]) {
        const regionLabel = region || 'Global';
        const regionArg = region ? `, serverRegion: "${region}"` : '';

        // 複数ページ分探す（最大3ページ）
        for (let page = 1; page <= 3; page++) {
            const queryStr = `
                query GetRankings($encounterId: Int!, $page: Int!) {
                    worldData {
                        encounter(id: $encounterId) {
                            name
                            fightRankings(page: $page, metric: speed${regionArg})
                        }
                    }
                }
            `;
            const data = await gql(token, queryStr, { encounterId, page });
            await sleep(API_DELAY_MS);

            const rankings = data.worldData.encounter?.fightRankings;
            if (!rankings || !rankings.rankings || rankings.rankings.length === 0) break;

            // 遅い順（末尾から）に死亡0のログを探す
            const allRankings = rankings.rankings;
            const candidates = allRankings.slice().reverse();

            for (const r of candidates) {
                if (!r.report?.code || !r.report?.fightID) continue;

                // このログの死亡数を確認
                try {
                    const fight = await fetchFightMeta(token, r.report.code, r.report.fightID);
                    await sleep(API_DELAY_MS);

                    const deaths = await fetchDeathEvents(token, r.report.code, fight);
                    await sleep(API_DELAY_MS);

                    if (deaths.length === 0) {
                        console.log(`   ✅ Found deathless log: ${r.report.code}#${r.report.fightID} (${regionLabel}, ${Math.round(r.duration / 1000)}s)`);
                        return {
                            reportCode: r.report.code,
                            fightId: r.report.fightID,
                            duration: r.duration,
                            fight,
                            deaths,
                        };
                    } else {
                        console.log(`   ⏭️  ${r.report.code}#${r.report.fightID}: ${deaths.length} deaths — skipping`);
                    }
                } catch (err) {
                    console.log(`   ⏭️  ${r.report.code}#${r.report.fightID}: error — ${err.message}`);
                }
            }
        }
    }

    // 死亡0が見つからなかった場合、最も死亡が少ないJPログを使う
    console.log(`   ⚠️  No deathless log found. Falling back to slowest JP kill...`);
    const regionArg = ', serverRegion: "JP"';
    const queryStr = `
        query GetRankings($encounterId: Int!, $page: Int!) {
            worldData {
                encounter(id: $encounterId) {
                    name
                    fightRankings(page: $page, metric: speed${regionArg})
                }
            }
        }
    `;
    const data = await gql(token, queryStr, { encounterId, page: 1 });
    await sleep(API_DELAY_MS);

    const rankings = data.worldData.encounter?.fightRankings;
    if (!rankings?.rankings?.length) {
        // JP無ければグローバル
        const gData = await gql(token, queryStr.replace(regionArg, ''), { encounterId, page: 1 });
        await sleep(API_DELAY_MS);
        const gRankings = gData.worldData.encounter?.fightRankings;
        if (!gRankings?.rankings?.length) return null;
        const r = gRankings.rankings[gRankings.rankings.length - 1];
        const fight = await fetchFightMeta(token, r.report.code, r.report.fightID);
        await sleep(API_DELAY_MS);
        const deaths = await fetchDeathEvents(token, r.report.code, fight);
        await sleep(API_DELAY_MS);
        return { reportCode: r.report.code, fightId: r.report.fightID, duration: r.duration, fight, deaths };
    }

    const r = rankings.rankings[rankings.rankings.length - 1];
    const fight = await fetchFightMeta(token, r.report.code, r.report.fightID);
    await sleep(API_DELAY_MS);
    const deaths = await fetchDeathEvents(token, r.report.code, fight);
    await sleep(API_DELAY_MS);
    return { reportCode: r.report.code, fightId: r.report.fightID, duration: r.duration, fight, deaths };
}

// ─── Step 4: Fetch fight metadata (start/end times) ───
export async function fetchFightMeta(token, reportCode, fightId) {
    const data = await gql(token, `
        query GetFight($reportCode: String!) {
            reportData {
                report(code: $reportCode) {
                    fights(killType: Kills) {
                        id
                        startTime
                        endTime
                        name
                        difficulty
                        kill
                        phaseTransitions {
                            id
                            startTime
                        }
                    }
                }
            }
        }
    `, { reportCode });

    const fights = data.reportData.report.fights;
    const fight = fights.find(f => f.id === fightId);
    if (!fight) {
        // Try to find any kill in the report
        const anyKill = fights.find(f => f.kill);
        if (anyKill) return anyKill;
        throw new Error(`Fight ${fightId} not found in report ${reportCode}`);
    }
    return fight;
}

// ─── Step 5: Fetch damage events ───
export async function fetchDamageEvents(token, reportCode, fight, translate = false) {
    const allEvents = [];
    let pageStart = fight.startTime;

    while (true) {
        const data = await gql(token, `
            query GetEvents(
                $reportCode: String!
                $fightIds: [Int]!
                $startTime: Float!
                $endTime: Float!
            ) {
                reportData {
                    report(code: $reportCode) {
                        events(
                            dataType: DamageDone
                            fightIDs: $fightIds
                            hostilityType: Enemies
                            startTime: $startTime
                            endTime: $endTime
                            limit: 10000
                            useAbilityIDs: false
                            includeResources: false
                            translate: ${translate}
                        ) {
                            data
                            nextPageTimestamp
                        }
                    }
                }
            }
        `, {
            reportCode,
            fightIds: [fight.id],
            startTime: pageStart,
            endTime: fight.endTime,
        });

        const page = data.reportData.report.events;
        allEvents.push(...page.data);

        if (!page.nextPageTimestamp) break;
        pageStart = page.nextPageTimestamp;
    }

    return allEvents;
}

// ─── Step 5b: Fetch cast events (詠唱イベント) ───
export async function fetchCastEvents(token, reportCode, fight, translate = false) {
    const allEvents = [];
    let pageStart = fight.startTime;

    while (true) {
        const data = await gql(token, `
            query GetCasts(
                $reportCode: String!
                $fightIds: [Int]!
                $startTime: Float!
                $endTime: Float!
            ) {
                reportData {
                    report(code: $reportCode) {
                        events(
                            dataType: Casts
                            fightIDs: $fightIds
                            hostilityType: Enemies
                            startTime: $startTime
                            endTime: $endTime
                            limit: 10000
                            useAbilityIDs: false
                            includeResources: false
                            translate: ${translate}
                        ) {
                            data
                            nextPageTimestamp
                        }
                    }
                }
            }
        `, {
            reportCode,
            fightIds: [fight.id],
            startTime: pageStart,
            endTime: fight.endTime,
        });

        const page = data.reportData.report.events;
        allEvents.push(...page.data);

        if (!page.nextPageTimestamp) break;
        pageStart = page.nextPageTimestamp;
    }

    return allEvents;
}

// ─── Step 5c: Fetch death events ───
export async function fetchDeathEvents(token, reportCode, fight) {
    const data = await gql(token, `
        query GetDeaths($reportCode: String!, $fightIds: [Int]!, $startTime: Float!, $endTime: Float!) {
            reportData {
                report(code: $reportCode) {
                    events(
                        dataType: Deaths
                        fightIDs: $fightIds
                        startTime: $startTime
                        endTime: $endTime
                        limit: 10000
                        hostilityType: Friendlies
                    ) {
                        data
                    }
                }
            }
        }
    `, {
        reportCode,
        fightIds: [fight.id],
        startTime: fight.startTime,
        endTime: fight.endTime,
    });
    return data.reportData.report.events.data || [];
}
