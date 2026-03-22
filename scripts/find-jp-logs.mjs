#!/usr/bin/env node
/**
 * 各コンテンツのJPクライアントログを探し、JP→EN辞書を構築してテンプレートを更新する
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../src/data/templates');
const CONTENTS_PATH = resolve(__dirname, '../src/data/contents.json');
const API_DELAY_MS = 250;

// .env.local
try {
    const envText = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
    for (const line of envText.split('\n')) {
        const [key, ...vals] = line.split('=');
        if (key && !key.startsWith('#')) process.env[key.trim()] = vals.join('=').trim();
    }
} catch {}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getToken() {
    const resp = await fetch('https://www.fflogs.com/oauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&client_id=${process.env.VITE_FFLOGS_CLIENT_ID}&client_secret=${process.env.VITE_FFLOGS_CLIENT_SECRET}`,
    });
    return (await resp.json()).access_token;
}

async function gql(token, query, variables = {}) {
    const resp = await fetch('https://www.fflogs.com/api/v2/client', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    return await resp.json();
}

function isJapaneseName(name) {
    return /[ぁ-ん]|[ァ-ヶ]|[一-龠]/.test(name);
}

// JPクライアントのログを探す（最大maxTries件のログを確認）
async function findJpClientLog(token, encounterId, maxTries = 200) {
    for (const region of ['"JP"', 'null']) {
        for (let page = 1; page <= 20; page++) {
            const data = await gql(token, `
                query ($eid: Int!, $page: Int!) {
                    worldData { encounter(id: $eid) {
                        fightRankings(page: $page, metric: speed, serverRegion: ${region})
                    }}
                }
            `, { eid: encounterId, page });
            await sleep(API_DELAY_MS);

            const rankings = data?.data?.worldData?.encounter?.fightRankings?.rankings;
            if (!rankings?.length) break;

            // 末尾（遅いキル）から順に確認
            for (let i = rankings.length - 1; i >= 0 && maxTries > 0; i--, maxTries--) {
                const r = rankings[i];
                if (!r.report?.code) continue;

                // fight meta
                const md = await gql(token, `
                    query ($rc: String!) { reportData { report(code: $rc) {
                        fights { id startTime endTime kill }
                    }}}
                `, { rc: r.report.code });
                await sleep(API_DELAY_MS);

                const fight = md?.data?.reportData?.report?.fights?.find(f => f.id === r.report.fightID)
                    || md?.data?.reportData?.report?.fights?.find(f => f.kill);
                if (!fight) continue;

                // translate:false で最初の数イベントをチェック
                const ed = await gql(token, `
                    query ($rc: String!, $fid: [Int]!, $st: Float!, $et: Float!) {
                        reportData { report(code: $rc) {
                            events(dataType: DamageDone, fightIDs: $fid, hostilityType: Enemies,
                                startTime: $st, endTime: $et, limit: 10,
                                useAbilityIDs: false, translate: false) { data }
                        }}
                    }
                `, { rc: r.report.code, fid: [fight.id], st: fight.startTime, et: fight.endTime });
                await sleep(API_DELAY_MS);

                const evts = ed?.data?.reportData?.report?.events?.data || [];
                // Attack/attack以外の名前でJP判定
                const nonAttack = evts.find(e => e.ability?.name && !/^attack$/i.test(e.ability.name.trim()));
                if (nonAttack && isJapaneseName(nonAttack.ability.name)) {
                    console.log(`      ✅ Found JP log: ${r.report.code}#${fight.id}`);
                    return { reportCode: r.report.code, fight };
                } else {
                    process.stdout.write('.');
                }
            }
        }
    }
    return null;
}

// JP→EN辞書を構築
async function buildDictFromLog(token, reportCode, fight) {
    const fetchEvents = async (translate) => {
        const allEvents = [];
        let pageStart = fight.startTime;
        while (true) {
            const data = await gql(token, `
                query ($rc: String!, $fid: [Int]!, $st: Float!, $et: Float!) {
                    reportData { report(code: $rc) {
                        events(dataType: DamageDone, fightIDs: $fid, hostilityType: Enemies,
                            startTime: $st, endTime: $et, limit: 10000,
                            useAbilityIDs: false, translate: ${translate}) { data, nextPageTimestamp }
                    }}
                }
            `, { rc: reportCode, fid: [fight.id], st: pageStart, et: fight.endTime });
            await sleep(API_DELAY_MS);
            const page = data?.data?.reportData?.report?.events;
            if (!page?.data) break;
            allEvents.push(...page.data);
            if (!page.nextPageTimestamp) break;
            pageStart = page.nextPageTimestamp;
        }
        return allEvents;
    };

    const eventsJp = await fetchEvents('false');
    const eventsEn = await fetchEvents('true');

    const enByGuid = new Map();
    for (const e of eventsEn) {
        const g = e.ability?.guid;
        if (g && g > 0) enByGuid.set(g, e.ability.name.trim());
    }

    const jpToEn = new Map();
    for (const e of eventsJp) {
        const g = e.ability?.guid;
        const jp = e.ability?.name?.trim();
        const en = enByGuid.get(g);
        if (g && jp && en && jp !== en) {
            jpToEn.set(jp, en);
        }
    }
    return jpToEn;
}

// 類似度
function similarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    const normalize = s => s.replace(/[・\s　]/g, '').replace(/ー/g, '').toLowerCase();
    const na = normalize(a), nb = normalize(b);
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.9;
    let longest = 0;
    for (let i = 0; i < na.length; i++) {
        for (let len = 2; len <= na.length - i; len++) {
            if (nb.includes(na.slice(i, i + len))) longest = Math.max(longest, len);
        }
    }
    return longest / Math.max(na.length, nb.length);
}

function fuzzyLookup(query, dict) {
    if (dict.has(query)) return dict.get(query);
    const base = query.replace(/[\(（][^）\)]*[\)）]/g, '').trim();
    if (dict.has(base)) return dict.get(base);

    // or/&分割
    const parts = base.split(/\s+or\s+|&/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
        const enParts = parts.map(part => {
            if (dict.has(part)) return dict.get(part);
            let best = 0, bestEn = null;
            for (const [jp, en] of dict) {
                const s = similarity(part, jp);
                if (s > best) { best = s; bestEn = en; }
            }
            return best >= 0.6 ? bestEn : null;
        });
        if (enParts.every(p => p)) return enParts.join(' or ');
    }

    let bestScore = 0, bestEn = null;
    for (const [jp, en] of dict) {
        const score = similarity(base, jp);
        if (score > bestScore) { bestScore = score; bestEn = en; }
    }
    return bestScore >= 0.6 ? bestEn : null;
}

// メイン
async function main() {
    console.log('🔑 Authenticating...');
    const token = await getToken();
    console.log('   ✅ OK\n');

    const contents = JSON.parse(readFileSync(CONTENTS_PATH, 'utf-8'));
    const jpLogCache = new Map(); // encounterId → dict
    let totalResolved = 0, totalUnresolved = 0;

    for (const f of readdirSync(TEMPLATES_DIR).sort()) {
        if (!f.endsWith('.json')) continue;
        const tplPath = resolve(TEMPLATES_DIR, f);
        const tpl = JSON.parse(readFileSync(tplPath, 'utf-8'));

        // P12S等の古いコンテンツはスキップ
        const skipIds = ['p12s_p1', 'p12s_p2', 'p11s'];
        const contentId = tpl.contentId || f.replace('.json', '');
        if (skipIds.includes(contentId)) continue;

        const unresolved = tpl.timelineEvents.filter(e =>
            e.name.en === e.name.ja && e.name.ja !== 'AA' && !e.name.ja.endsWith('_AA')
        );
        if (unresolved.length === 0) continue;

        const uniqueNames = [...new Set(unresolved.map(e => e.name.ja))];
        const content = contents.find(c => c.id === contentId);
        const encId = content?.fflogsEncounterId;
        if (!encId) { totalUnresolved += uniqueNames.length; continue; }

        console.log(`\n📄 ${f}: ${uniqueNames.length} unresolved (encounter ${encId})`);

        // 辞書取得（キャッシュ）
        if (!jpLogCache.has(encId)) {
            console.log(`   🔍 Searching for JP client log...`);
            const jpLog = await findJpClientLog(token, encId);
            if (jpLog) {
                console.log(`   📖 Building JP→EN dictionary...`);
                const dict = await buildDictFromLog(token, jpLog.reportCode, jpLog.fight);
                console.log(`   📖 ${dict.size} JP→EN mappings`);
                jpLogCache.set(encId, dict);
            } else {
                console.log(`   ⚠️ No JP client log found`);
                jpLogCache.set(encId, new Map());
            }
        }

        const dict = jpLogCache.get(encId);
        let resolved = 0;
        for (const ja of uniqueNames) {
            const en = fuzzyLookup(ja, dict);
            if (en && en !== ja) {
                for (const ev of tpl.timelineEvents) {
                    if (ev.name.ja === ja) ev.name.en = en;
                }
                resolved++;
            }
        }

        // P12S等のEN名テンプレートはEN→JP方向で解決
        if (resolved === 0 && uniqueNames.some(n => /^[A-Za-z]/.test(n))) {
            // 逆引き: EN名のテンプレートに対してJP名を設定
            const enToJp = new Map();
            for (const [jp, en] of dict) enToJp.set(en, jp);
            for (const ja of uniqueNames) {
                if (enToJp.has(ja)) {
                    const jpName = enToJp.get(ja);
                    for (const ev of tpl.timelineEvents) {
                        if (ev.name.ja === ja) {
                            ev.name.en = ja;  // 元がEN名なのでenに設定
                            ev.name.ja = jpName; // JP名を設定
                        }
                    }
                    resolved++;
                }
            }
        }

        console.log(`   ✅ ${resolved}/${uniqueNames.length} resolved`);
        totalResolved += resolved;
        totalUnresolved += (uniqueNames.length - resolved);
        writeFileSync(tplPath, JSON.stringify(tpl, null, 2) + '\n', 'utf-8');
    }

    console.log(`\n════════════════════════════════════════`);
    console.log(`📊 Total: ${totalResolved} resolved, ${totalUnresolved} still unresolved`);
    console.log(`════════════════════════════════════════`);
}

main().catch(err => { console.error(err); process.exit(1); });
