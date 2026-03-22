#!/usr/bin/env node
/**
 * 未解決のEN名をFFLogsから検索して解決するスクリプト
 * テンプレートJSONを直接更新する
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../src/data/templates');
const CONTENTS_PATH = resolve(__dirname, '../src/data/contents.json');
const API_DELAY_MS = 300;

// .env.local読み込み
const envPath = resolve(__dirname, '../.env.local');
try {
    const envText = readFileSync(envPath, 'utf-8');
    for (const line of envText.split('\n')) {
        const [key, ...vals] = line.split('=');
        if (key && !key.startsWith('#')) process.env[key.trim()] = vals.join('=').trim();
    }
} catch {}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getToken() {
    const resp = await fetch('https://www.fflogs.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

// FFLogsからGUID→{ja, en}の辞書を構築
async function buildFullDict(token, encounterId) {
    // 複数リージョン・ページから遅いキルを探す
    let reportCode, fightId;
    for (const region of ['"JP"', 'null']) {
        for (let page = 1; page <= 3; page++) {
            const data = await gql(token, `
                query ($encounterId: Int!, $page: Int!) {
                    worldData { encounter(id: $encounterId) {
                        fightRankings(page: $page, metric: speed, serverRegion: ${region})
                    }}
                }
            `, { encounterId, page });
            await sleep(API_DELAY_MS);
            const rankings = data?.data?.worldData?.encounter?.fightRankings?.rankings;
            if (rankings?.length) {
                const r = rankings[rankings.length - 1];
                reportCode = r.report?.code;
                fightId = r.report?.fightID;
                break;
            }
        }
        if (reportCode) break;
    }
    if (!reportCode) return new Map();

    // まずfightのstartTime/endTimeを取得
    const metaData = await gql(token, `
        query ($rc: String!) {
            reportData { report(code: $rc) {
                fights { id startTime endTime kill }
            }}
        }
    `, { rc: reportCode });
    await sleep(API_DELAY_MS);
    const fight = metaData?.data?.reportData?.report?.fights?.find(f => f.id === fightId)
        || metaData?.data?.reportData?.report?.fights?.find(f => f.kill);
    if (!fight) return new Map();

    const fetchEvents = async (translate) => {
        const data = await gql(token, `
            query ($rc: String!, $fid: [Int]!, $st: Float!, $et: Float!) {
                reportData { report(code: $rc) {
                    events(dataType: DamageDone, fightIDs: $fid, hostilityType: Enemies,
                        startTime: $st, endTime: $et, limit: 10000,
                        useAbilityIDs: false, translate: ${translate}) { data }
                }}
            }
        `, { rc: reportCode, fid: [fight.id], st: fight.startTime, et: fight.endTime });
        return data?.data?.reportData?.report?.events?.data || [];
    };

    const eventsEn = await fetchEvents('true');
    await sleep(API_DELAY_MS);
    const eventsJp = await fetchEvents('false');
    await sleep(API_DELAY_MS);

    // GUID→EN名
    const enByGuid = new Map();
    for (const ev of eventsEn) {
        const guid = ev.ability?.guid;
        const name = ev.ability?.name?.trim();
        if (guid && name && guid > 0) enByGuid.set(guid, name);
    }

    // GUID→ネイティブ名
    const nativeByGuid = new Map();
    for (const ev of eventsJp) {
        const guid = ev.ability?.guid;
        const name = ev.ability?.name?.trim();
        if (guid && name && guid > 0) nativeByGuid.set(guid, name);
    }

    // JP名→EN名の辞書構築
    // 1. ネイティブ名がEN名と異なる場合はそのまま使う
    const jpToEn = new Map();
    for (const [guid, native] of nativeByGuid) {
        const en = enByGuid.get(guid);
        if (en && native !== en) jpToEn.set(native, en);
    }

    // 2. 全GUIDについてXIVAPIでJP名を引く（最も確実）
    const allGuids = [...enByGuid.keys()];
    console.log(`      🌐 XIVAPI: Looking up ${allGuids.length} GUIDs...`);
    for (const guid of allGuids) {
        if (jpToEn.size > 0) {
            // 既にこのGUIDのJP名が辞書にあるかチェック
            const en = enByGuid.get(guid);
            const existing = [...jpToEn.entries()].find(([, v]) => v === en);
            if (existing) continue;
        }
        try {
            const resp = await fetch(`https://xivapi.com/Action/${guid}?columns=Name_ja,Name_en,ID`);
            if (resp.ok) {
                const data = await resp.json();
                if (data.Name_ja) {
                    jpToEn.set(data.Name_ja, enByGuid.get(guid));
                }
            }
        } catch {}
        await sleep(80);
    }

    // 3. EN名→EN名も追加（EN名テンプレート用）
    for (const [, en] of enByGuid) {
        if (!jpToEn.has(en)) jpToEn.set(en, en);
    }

    return jpToEn;
}

// 類似度計算
function similarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    // 中点（・）、長音（ー）、スペースを除去して正規化
    const normalize = s => s
        .replace(/[・\s　]/g, '')
        .replace(/ー/g, '')
        .toLowerCase();
    const na = normalize(a), nb = normalize(b);
    if (na === nb) return 1;
    // 一方が他方を含む場合は高スコア
    if (na.includes(nb) || nb.includes(na)) return 0.9;
    let longest = 0;
    for (let i = 0; i < na.length; i++) {
        for (let len = 2; len <= na.length - i; len++) {
            if (nb.includes(na.slice(i, i + len))) longest = Math.max(longest, len);
        }
    }
    return longest / Math.max(na.length, nb.length);
}

// ファジーマッチ
function fuzzyLookup(query, dict) {
    if (dict.has(query)) return dict.get(query);
    const base = query.replace(/[\(（][^）\)]*[\)）]/g, '').trim();
    if (dict.has(base)) return dict.get(base);

    // or分割
    const orParts = base.split(/\s+or\s+|\/|&/).map(s => s.trim()).filter(Boolean);
    if (orParts.length >= 2) {
        const enParts = orParts.map(part => {
            if (dict.has(part)) return dict.get(part);
            let best = 0, bestEn = null;
            for (const [jp, en] of dict) {
                if (typeof jp !== 'string') continue;
                const s = similarity(part, jp);
                if (s > best) { best = s; bestEn = en; }
            }
            return best >= 0.6 ? bestEn : null;
        });
        if (enParts.every(p => p)) return enParts.join(' or ');
    }

    // 単一名ファジーマッチ（閾値を下げて0.6に）
    let bestScore = 0, bestEn = null;
    for (const [jp, en] of dict) {
        if (typeof jp !== 'string') continue;
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
    let totalResolved = 0, totalUnresolved = 0;

    for (const f of readdirSync(TEMPLATES_DIR).sort()) {
        if (!f.endsWith('.json')) continue;
        const tplPath = resolve(TEMPLATES_DIR, f);
        const tpl = JSON.parse(readFileSync(tplPath, 'utf-8'));

        const unresolved = tpl.timelineEvents.filter(e =>
            e.name.en === e.name.ja && e.name.ja !== 'AA' && !e.name.ja.endsWith('_AA')
        );
        if (unresolved.length === 0) continue;

        const uniqueNames = [...new Set(unresolved.map(e => e.name.ja))];
        console.log(`📄 ${f}: ${uniqueNames.length} unresolved names`);

        // FFLogs辞書を構築
        const contentId = tpl.contentId || f.replace('.json', '');
        const content = contents.find(c => c.id === contentId);
        const encId = content?.fflogsEncounterId;
        if (!encId) {
            console.log(`   ⚠️ No encounterId — skipping`);
            totalUnresolved += uniqueNames.length;
            continue;
        }

        console.log(`   🔍 Building dictionary (encounter ${encId})...`);
        const dict = await buildFullDict(token, encId);
        console.log(`   📖 ${dict.size} mappings`);

        let resolved = 0;
        for (const ja of uniqueNames) {
            const en = fuzzyLookup(ja, dict);
            if (en && en !== ja) {
                // テンプレート内の全該当イベントを更新
                for (const ev of tpl.timelineEvents) {
                    if (ev.name.ja === ja) ev.name.en = en;
                }
                resolved++;
            }
        }

        console.log(`   ✅ ${resolved}/${uniqueNames.length} resolved\n`);
        totalResolved += resolved;
        totalUnresolved += (uniqueNames.length - resolved);

        // 保存
        writeFileSync(tplPath, JSON.stringify(tpl, null, 2) + '\n', 'utf-8');
    }

    console.log(`\n════════════════════════════════════════`);
    console.log(`📊 Total: ${totalResolved} resolved, ${totalUnresolved} still unresolved`);
    console.log(`════════════════════════════════════════`);
}

main().catch(err => { console.error(err); process.exit(1); });
