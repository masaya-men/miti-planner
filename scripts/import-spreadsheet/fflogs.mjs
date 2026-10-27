import { similarity } from './similarity.mjs';

const API_DELAY_MS = 300;

// ─── FFLogs GraphQL ───
export async function gql(token, query, variables = {}) {
    const resp = await fetch('https://www.fflogs.com/api/v2/client', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    return await resp.json();
}

// ─── FFLogsからJP→EN名の辞書を構築 ───
export async function buildJpEnDict(token, encounterId) {
    if (!token) return new Map();

    // ランキングからJP地域のログを探す（複数ページ試行）
    let r = null;
    for (const region of ['"JP"', 'null']) {
        for (let page = 1; page <= 3; page++) {
            const rankData = await gql(token, `
                query ($encounterId: Int!, $page: Int!) {
                    worldData {
                        encounter(id: $encounterId) {
                            fightRankings(page: $page, metric: speed, serverRegion: ${region})
                        }
                    }
                }
            `, { encounterId, page });
            await sleep(API_DELAY_MS);
            const rankings = rankData?.data?.worldData?.encounter?.fightRankings?.rankings;
            if (rankings?.length) {
                r = rankings[rankings.length - 1]; // 最も遅いキル
                break;
            }
        }
        if (r) break;
    }
    if (!r) return new Map();
    const reportCode = r.report?.code;
    const fightId = r.report?.fightID;
    if (!reportCode) return new Map();

    // EN版とJP版のイベントを取得してマッピング
    const fetchEvents = async (translate) => {
        const data = await gql(token, `
            query ($reportCode: String!, $fightIds: [Int]!, $startTime: Float!, $endTime: Float!) {
                reportData {
                    report(code: $reportCode) {
                        fights(killType: Kills) { id startTime endTime }
                        events(
                            dataType: DamageDone
                            fightIDs: $fightIds
                            hostilityType: Enemies
                            startTime: $startTime
                            endTime: $endTime
                            limit: 10000
                            useAbilityIDs: false
                            translate: ${translate}
                        ) { data }
                    }
                }
            }
        `, { reportCode, fightIds: [fightId], startTime: 0, endTime: 999999999 });
        return data?.data?.reportData?.report?.events?.data || [];
    };

    const eventsEn = await fetchEvents('true');
    await sleep(API_DELAY_MS);
    const eventsJp = await fetchEvents('false');
    await sleep(API_DELAY_MS);

    // GUIDごとにEN名を収集
    const enByGuid = new Map();
    for (const ev of eventsEn) {
        const guid = ev.ability?.guid;
        const name = ev.ability?.name?.trim();
        if (guid && name && guid > 0) enByGuid.set(guid, name);
    }

    // translate:falseの名前も収集（JPクライアントのログならJP名が得られる）
    const nativeByGuid = new Map();
    for (const ev of eventsJp) {
        const guid = ev.ability?.guid;
        const name = ev.ability?.name?.trim();
        if (guid && name && guid > 0) nativeByGuid.set(guid, name);
    }

    // JP名→EN名の辞書を構築
    const jpToEn = new Map();

    // まずtranslate:falseがJP名の場合（EN名と異なる）を使う
    for (const [guid, nativeName] of nativeByGuid) {
        const enName = enByGuid.get(guid);
        if (enName && nativeName !== enName) {
            jpToEn.set(nativeName, enName);
        }
    }

    // JP名が取れなかった場合、XIVAPIでGUID→JP名を引く
    if (jpToEn.size < enByGuid.size / 2) {
        const guidsToLookup = [...enByGuid.keys()].filter(g => {
            const native = nativeByGuid.get(g);
            const en = enByGuid.get(g);
            return !native || native === en; // ネイティブ名がEN名と同じ=JP名が取れていない
        });

        if (guidsToLookup.length > 0) {
            console.log(`      🌐 XIVAPI: Looking up ${guidsToLookup.length} ability names...`);
            for (const guid of guidsToLookup) {
                try {
                    const resp = await fetch(`https://xivapi.com/Action/${guid}?columns=Name_ja,Name_en,ID`);
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data.Name_ja && data.Name_ja !== enByGuid.get(guid)) {
                            jpToEn.set(data.Name_ja, enByGuid.get(guid));
                        }
                    }
                } catch { /* skip */ }
                await sleep(100);
            }
        }
    }

    // ファジーマッチ用にFFLogsの全JP名候補も保存
    jpToEn._allJpNames = [...jpToEn.keys()];
    jpToEn._fuzzyLookup = (query) => {
        // 完全一致
        if (jpToEn.has(query)) return jpToEn.get(query);
        // 括弧除去
        const base = query.replace(/[\(（][^）\)]*[\)）]/g, '').trim();
        if (jpToEn.has(base)) return jpToEn.get(base);

        // 「or」「/」区切りの場合、各パーツを個別に検索して組み立て
        const orParts = base.split(/\s+or\s+|\//).map(s => s.trim()).filter(Boolean);
        if (orParts.length >= 2) {
            const enParts = orParts.map(part => {
                if (jpToEn.has(part)) return jpToEn.get(part);
                // 各パーツもファジーマッチ
                let best = 0, bestEn = null;
                for (const [jp, en] of jpToEn) {
                    if (typeof jp !== 'string') continue;
                    const s = similarity(part, jp);
                    if (s > best) { best = s; bestEn = en; }
                }
                return best >= 0.7 ? bestEn : part; // 見つからなければJP名のまま
            });
            if (enParts.some(p => p !== orParts[orParts.indexOf(p)])) {
                return enParts.join(' or ');
            }
        }

        // ファジーマッチ: 類似度が0.7以上のベストマッチを返す
        let bestScore = 0, bestEn = null;
        for (const [jp, en] of jpToEn) {
            if (typeof jp !== 'string') continue;
            const score = similarity(base, jp);
            if (score > bestScore) { bestScore = score; bestEn = en; }
        }
        return bestScore >= 0.7 ? bestEn : null;
    };

    return jpToEn;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── XIVAPI で日本語名から英語名を検索 ───
export async function searchEnglishName(jaName) {
    if (xivApiCache.has(jaName)) return xivApiCache.get(jaName);

    try {
        // XIVAPI search endpoint
        const resp = await fetch(`${XIVAPI_BASE}/search?string=${encodeURIComponent(jaName)}&indexes=Action&columns=Name_ja,Name_en&limit=1&language=ja`);
        if (!resp.ok) {
            xivApiCache.set(jaName, null);
            return null;
        }
        const data = await resp.json();
        if (data.Results && data.Results.length > 0 && data.Results[0].Name_en) {
            const en = data.Results[0].Name_en;
            xivApiCache.set(jaName, en);
            return en;
        }
    } catch {
        // ignore
    }
    xivApiCache.set(jaName, null);
    return null;
}
