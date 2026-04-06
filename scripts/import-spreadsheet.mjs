#!/usr/bin/env node
/**
 * スプレッドシートからテンプレートを生成するスクリプト
 * 有志が作成した軽減表（Google Sheets）を読み込み、テンプレートJSONに変換する
 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../src/data/templates');
const CONTENTS_PATH = resolve(__dirname, '../src/data/contents.json');

const API_DELAY_MS = 300;

// ─── FFLogs API認証 ───
async function getFFLogsToken() {
    // .env.local から環境変数を読み込む
    const envPath = resolve(__dirname, '../.env.local');
    try {
        const envText = readFileSync(envPath, 'utf-8');
        for (const line of envText.split('\n')) {
            const [key, ...vals] = line.split('=');
            if (key && !key.startsWith('#')) process.env[key.trim()] = vals.join('=').trim();
        }
    } catch { /* .env.local なくても動く */ }

    const id = process.env.VITE_FFLOGS_CLIENT_ID;
    const secret = process.env.VITE_FFLOGS_CLIENT_SECRET;
    if (!id || !secret) return null;

    const resp = await fetch('https://www.fflogs.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&client_id=${id}&client_secret=${secret}`,
    });
    const data = await resp.json();
    return data.access_token || null;
}

// ─── FFLogs GraphQL ───
async function gql(token, query, variables = {}) {
    const resp = await fetch('https://www.fflogs.com/api/v2/client', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
    });
    return await resp.json();
}

// ─── FFLogsからJP→EN名の辞書を構築 ───
async function buildJpEnDict(token, encounterId) {
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

// ─── ファジーマッチ: 2つの文字列の類似度（0〜1）を計算 ───
function similarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    // 正規化: 長音(ー)除去、全角半角統一、小書き文字統一
    const normalize = (s) => s
        .replace(/ー/g, '')
        .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
        .toLowerCase();
    const na = normalize(a), nb = normalize(b);
    if (na === nb) return 1;

    // 共通文字数 / 長い方の文字数
    const setA = new Set(na), setB = new Set(nb);
    let common = 0;
    for (const c of setA) { if (setB.has(c)) common++; }
    const charRatio = common / Math.max(setA.size, setB.size);

    // 連続部分文字列の一致も考慮
    let longestMatch = 0;
    for (let i = 0; i < na.length; i++) {
        for (let len = 2; len <= na.length - i; len++) {
            if (nb.includes(na.slice(i, i + len))) {
                longestMatch = Math.max(longestMatch, len);
            }
        }
    }
    const substringRatio = longestMatch / Math.max(na.length, nb.length);

    return Math.max(charRatio * 0.4 + substringRatio * 0.6, substringRatio);
}

// ─── スプレッドシート定義 ───
const SPREADSHEETS = {
    // 絶コンテンツ
    fru:  { sheetId: '1SE42_C609lQnsgbyeXwyB3xVu-6Fjl6cjP1nY5g_DAU' },
    top:  { sheetId: '1VpwyDq9uc0W3i4rJZgI3YILVfpgUv_wmWT-csBhPQKI' },
    // DSR: P1タブ→dsr_p1、P2以降→dsr
    dsr_p1: { sheetId: '1N-ZrBSEzxsVRsCmwScSeAGSCfaGMwv-Tl99zGozC5ss', tabFilter: name => name === 'P1_蒼天騎士' },
    dsr:    { sheetId: '1N-ZrBSEzxsVRsCmwScSeAGSCfaGMwv-Tl99zGozC5ss', tabFilter: name => name !== 'P1_蒼天騎士' },
    tea:  { sheetId: '1UvYuBB2v87TFz8ISMTA68wC1o7kSn5LXw57_7PJYWaw' },
    uwu:  { sheetId: '1WY8yeJ4fpxudiUNcSbawGZJx0X79_VjjhE2f73wZMQ0' },
    ucob: { sheetId: '187eHoXZ4Z6Pf7KeRUWQtvccmVaDXUXvCe8c4gwTgB30' },
    // 零式
    // ヘビー級（M9S-M12S）: 1つのスプシに複数コンテンツ
    'm9s,m10s,m11s,m12s_p1,m12s_p2': { sheetId: '1w0JT2aHnGtqtSq_YmntjUBuFdga6jhS5_VCBQvgCSHk' },
    // クルーザー級（M5S-M8S）
    'm5s,m6s,m7s,m8s': { sheetId: '1_Xgu2xfV3uw_rDyoRJr1UrO5XCmsLuLBWQWSjEFOp-0' },
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Google Sheets タブ（シート）名を取得 ───
async function getSheetTabs(sheetId) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    const resp = await fetch(url, { redirect: 'follow' });
    const html = await resp.text();

    // docs-sheet-tab-caption からタブ名を抽出（HTMLエンティティをデコード）
    const captions = [...html.matchAll(/docs-sheet-tab-caption">([^<]+)/g)]
        .map(m => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    return captions.map(name => ({ name }));
}

// ─── CSV取得（シート名で取得） ───
async function fetchSheetCSV(sheetId, sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) throw new Error(`Failed to fetch CSV for "${sheetName}": ${resp.status}`);
    return await resp.text();
}

// ─── CSV パース ───
function parseCSV(csv) {
    const rows = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
        const ch = csv[i];
        if (ch === '"') {
            if (inQuotes && csv[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            rows.push(current);
            current = '';
        } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (ch === '\r' && csv[i + 1] === '\n') i++;
            rows.push(current);
            current = '';
            // 行の区切り → 配列の配列にする
            if (!rows._rows) rows._rows = [];
            rows._rows.push([...rows.splice(0)]);
        } else {
            current += ch;
        }
    }
    if (current) {
        if (!rows._rows) rows._rows = [];
        rows.push(current);
        rows._rows.push([...rows.splice(0)]);
    }

    return rows._rows || [];
}

// ─── 時刻パース（MM:SS → 秒） ───
function parseTime(timeStr) {
    if (!timeStr) return null;
    const cleaned = timeStr.trim().replace(/^-/, '');
    const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
}

// ─── ダメージ種別の判定 ───
function parseDamageType(typeCell) {
    if (!typeCell) return 'magical';
    const lower = typeCell.toLowerCase().trim();
    if (lower.includes('physical') || lower.includes('物理')) return 'physical';
    if (lower.includes('magic') || lower.includes('魔法')) return 'magical';
    if (lower.includes('unique') || lower.includes('無属性')) return 'magical';
    return 'magical';
}

// ─── ダメージ値パース ───
function parseDamage(dmgStr) {
    if (!dmgStr) return undefined;
    const cleaned = dmgStr.replace(/[,\s]/g, '');
    const num = parseInt(cleaned);
    return isNaN(num) || num <= 0 ? undefined : num;
}

// ─── XIVAPI で日本語名から英語名を検索 ───
async function searchEnglishName(jaName) {
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

// ─── シートのタイムラインデータをパース ───
function parseTimelineSheet(rows) {
    const events = [];

    // ヘッダー行を探す（"Time" と "Action" を含む行）
    let headerRow = -1;
    let colTime = -1, colAction = -1, colType = -1, colDamage = -1;

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        for (let j = 0; j < row.length; j++) {
            const cell = (row[j] || '').trim().toLowerCase();
            if (cell.startsWith('time')) colTime = j;
            if (cell.startsWith('action')) colAction = j;
            if (cell.startsWith('type')) colType = j;
            if (cell.startsWith('damage') || cell.startsWith('hit')) colDamage = j;
        }
        if (colTime >= 0 && colAction >= 0) { headerRow = i; break; }
    }

    // Damage列がまだ見つからない場合、"Damage"ヘッダーの直下列を探す
    if (headerRow >= 0 && colDamage < 0) {
        // Damageヘッダーの位置を探す
        const row = rows[headerRow];
        for (let j = 0; j < row.length; j++) {
            if ((row[j] || '').trim().toLowerCase().startsWith('damage')) {
                colDamage = j; // Damage列の開始位置（Hit列はその直下）
                break;
            }
        }
    }

    if (headerRow < 0 || colTime < 0 || colAction < 0) {
        console.log(`      ⚠️ ヘッダーが見つかりません (headerRow=${headerRow}, colTime=${colTime}, colAction=${colAction})`);
        return events;
    }

    console.log(`      📋 Columns: Time=${colTime}, Action=${colAction}, Type=${colType}, Damage=${colDamage}`);

    // データ行を処理（ヘッダーから3行後 = サブヘッダー2行をスキップ）
    const dataStart = headerRow + 3;
    for (let i = dataStart; i < rows.length; i++) {
        const row = rows[i];
        const timeStr = row[colTime]?.trim();
        const action = row[colAction]?.trim();
        const typeStr = colType >= 0 ? row[colType]?.trim() : '';
        const dmgStr = colDamage >= 0 ? row[colDamage]?.trim() : '';

        if (!action) continue;
        if (action === '戦闘開始！' || action === '戦闘開始') continue;

        const time = parseTime(timeStr);
        if (time === null) continue;

        // ダメージ値がないイベント（バフ/デバフ名、ギミック説明）は除外
        const damage = parseDamage(dmgStr);
        if (damage === undefined) continue;

        // 括弧書きの注釈を除去: (プレイヤー), (TB), (着弾), （覚醒1）等
        const cleanAction = action.replace(/\s*[\(（][^）\)]*[\)）]/g, '').trim();

        events.push({
            time,
            name: { ja: cleanAction, en: '' },
            damageType: parseDamageType(typeStr),
            damageAmount: damage,
            target: 'AoE',
        });
    }

    return events;
}

// ─── メイン処理 ───
async function main() {
    const contents = JSON.parse(readFileSync(CONTENTS_PATH, 'utf-8'));
    const targetContent = process.argv.find(a => a.startsWith('--content='))?.split('=')[1];

    console.log('┌───────────────────────────────────────────┐');
    console.log('│   Spreadsheet → Template Importer         │');
    console.log('└───────────────────────────────────────────┘\n');

    // FFLogs認証
    console.log('🔑 Authenticating with FFLogs (for EN name resolution)...');
    const fflogsToken = await getFFLogsToken();
    if (fflogsToken) {
        console.log('   ✅ Token obtained\n');
    } else {
        console.log('   ⚠️ No FFLogs credentials — EN names will use JA fallback\n');
    }

    let success = 0, failed = 0;

    for (const [contentIds, config] of Object.entries(SPREADSHEETS)) {
        const ids = contentIds.split(',');

        // フィルタリング
        if (targetContent && !ids.includes(targetContent)) continue;

        console.log(`\n────────────────────────────────────────`);
        console.log(`📊 Spreadsheet: ${config.sheetId}`);
        console.log(`   Contents: ${ids.join(', ')}`);

        try {
            // タブ名を取得
            console.log(`   🔍 Fetching sheet tabs...`);
            const tabs = await getSheetTabs(config.sheetId);

            if (tabs.length === 0) {
                console.log(`   ⚠️ タブ名を自動検出できません`);
                failed += ids.length;
                continue;
            }

            // フェーズタブを検出:
            // - 絶: P1_xxx, P2_xxx 形式
            // - 零式: M9S, M10S, M12S-1 形式
            let phaseTabs = tabs.filter(t =>
                /^P\d/.test(t.name) || /^M\d+S/.test(t.name)
            );

            // tabFilter が指定されている場合、さらにフィルタリング
            if (config.tabFilter) {
                phaseTabs = phaseTabs.filter(t => config.tabFilter(t.name));
            }
            console.log(`   📑 Found ${tabs.length} tabs, ${phaseTabs.length} phase tabs: ${phaseTabs.map(t => t.name).join(', ')}`);

            if (phaseTabs.length === 0) {
                console.log(`   ❌ フェーズタブが見つかりません`);
                failed += ids.length;
                continue;
            }

            // 各フェーズのデータを取得
            const allEvents = [];
            const phases = [];
            let currentTimeSec = 0;

            for (let pi = 0; pi < phaseTabs.length; pi++) {
                const tab = phaseTabs[pi];
                console.log(`   📥 ${tab.name} (gid=${tab.gid})...`);

                const csv = await fetchSheetCSV(config.sheetId, tab.name);
                const rows = parseCSV(csv);
                const events = parseTimelineSheet(rows);

                // フェーズ開始時刻を記録
                phases.push({
                    id: pi + 1,
                    startTimeSec: currentTimeSec,
                    name: tab.name.replace(/^P\d+_/, ''), // "P1_蒼天騎士" → "蒼天騎士"
                });

                // イベントの時刻をオフセット（フェーズ間で連続にする）
                // 各フェーズの最大時刻を追跡
                let maxTime = 0;
                for (const ev of events) {
                    ev.time += currentTimeSec;
                    if (ev.time > maxTime) maxTime = ev.time;
                    allEvents.push(ev);
                }

                console.log(`      → ${events.length} events`);

                // 次のフェーズの開始時刻 = このフェーズの最後のイベント + 数秒
                if (pi < phaseTabs.length - 1) {
                    currentTimeSec = maxTime + 5; // 5秒の猶予
                }
            }

            // 英語名を補完（FFLogsのJP→EN辞書を使用）
            const content0 = contents.find(c => c.id === ids[0]);
            const encId = content0?.fflogsEncounterId;
            let jpToEn = new Map();
            if (encId && fflogsToken) {
                console.log(`   🌐 Building JP→EN dictionary from FFLogs (encounter ${encId})...`);
                jpToEn = await buildJpEnDict(fflogsToken, encId);
                console.log(`      📖 ${jpToEn.size} JP→EN mappings found`);
            }

            // デバッグ: 辞書の内容とスプシ名の比較
            if (jpToEn.size > 0) {
                const ssNames = new Set(allEvents.map(e => e.name.ja));
                const dictNames = [...jpToEn.keys()];
                const unmatchedDict = dictNames.filter(d => !ssNames.has(d));
                const unmatchedSS = [...ssNames].filter(s => !jpToEn.has(s) && s !== 'AA' && !s.endsWith('_AA'));
                if (unmatchedDict.length > 0 || unmatchedSS.length > 0) {
                    console.log(`      📝 Dict names not in SS (${unmatchedDict.length}): ${unmatchedDict.slice(0,5).join(', ')}`);
                    console.log(`      📝 SS names not in dict (${unmatchedSS.length}): ${unmatchedSS.slice(0,5).join(', ')}`);
                }
            }

            const uniqueJaNames = [...new Set(allEvents.map(e => e.name.ja))];
            let resolved = 0, unresolved = 0;
            for (const ja of uniqueJaNames) {
                // AA系はそのまま（ボス名_AA → そのまま英語でも使用）
                if (ja === 'AA' || ja.endsWith('_AA')) {
                    for (const ev of allEvents) {
                        if (ev.name.ja === ja) ev.name.en = ja;
                    }
                    resolved++;
                    continue;
                }

                // FFLogs辞書で検索（完全一致 → 括弧除去 → ファジーマッチ）
                const en = jpToEn._fuzzyLookup?.(ja)
                    || jpToEn.get(ja)
                    || jpToEn.get(ja.replace(/[\(（][^）\)]*[\)）]/g, '').trim());
                if (en) {
                    for (const ev of allEvents) {
                        if (ev.name.ja === ja) ev.name.en = en;
                    }
                    resolved++;
                } else {
                    // 見つからない場合は日本語名をそのまま使用
                    for (const ev of allEvents) {
                        if (ev.name.ja === ja && !ev.name.en) ev.name.en = ja;
                    }
                    unresolved++;
                }
            }
            console.log(`      ✅ ${resolved} resolved, ⚠️ ${unresolved} unresolved (using JA name)`);

            // コンテンツごとにテンプレートを保存
            // 1つのスプシに複数コンテンツが入っている場合（零式）の対応
            if (ids.length === 1) {
                // 単一コンテンツ
                const content = contents.find(c => c.id === ids[0]);
                const phaseNames = content?.phaseNames || {};

                // フェーズ名をcontents.jsonの定義で上書き
                for (const p of phases) {
                    const phaseName = phaseNames[String(p.id)];
                    if (phaseName) {
                        p.name = typeof phaseName === 'string'
                            ? { ja: '', en: phaseName }
                            : phaseName;
                    }
                }

                // ID生成
                let counter = 0;
                const template = {
                    contentId: ids[0],
                    generatedAt: new Date().toISOString(),
                    source: 'spreadsheet',
                    sourceSheetId: config.sheetId,
                    timelineEvents: allEvents.map(ev => ({
                        id: `tpl_${counter++}_${Math.random().toString(36).slice(2, 8)}`,
                        ...ev,
                    })),
                    phases,
                };

                const outPath = resolve(TEMPLATES_DIR, `${ids[0]}.json`);
                writeFileSync(outPath, JSON.stringify(template, null, 2) + '\n', 'utf-8');
                console.log(`   💾 Saved ${ids[0]}.json (${allEvents.length} events, ${phases.length} phases)`);
                success++;
            } else if (ids.length > 1) {
                // 複数コンテンツ（零式）: タブ名からコンテンツIDにマッピング
                // タブ名: M9S → m9s, M12S-1 → m12s_p1, M12S-2 → m12s_p2
                console.log(`   📦 Multi-content sheet. Mapping tabs to contents...`);

                // タブ名 → コンテンツID の変換
                const tabToContentId = (tabName) => {
                    let cid = tabName.toLowerCase(); // M9S → m9s
                    cid = cid.replace(/-1$/, '_p1').replace(/-2$/, '_p2'); // M12S-1 → m12s_p1
                    return cid;
                };

                for (const tab of phaseTabs) {
                    const cid = tabToContentId(tab.name);
                    if (!ids.includes(cid)) {
                        console.log(`      ⏭️ Tab "${tab.name}" → "${cid}" not in target list, skipping`);
                        continue;
                    }

                    const content = contents.find(c => c.id === cid);
                    if (!content) { console.log(`      ⚠️ ${cid} not found in contents.json`); continue; }

                    console.log(`   📥 ${tab.name} → ${cid}...`);
                    const csv = await fetchSheetCSV(config.sheetId, tab.name);
                    const rows = parseCSV(csv);
                    const events = parseTimelineSheet(rows);
                    console.log(`      → ${events.length} events`);

                    // EN名解決
                    const encId = content.fflogsEncounterId;
                    let jpToEnLocal = new Map();
                    if (encId && fflogsToken) {
                        console.log(`      🌐 Building JP→EN dictionary (encounter ${encId})...`);
                        jpToEnLocal = await buildJpEnDict(fflogsToken, encId);
                        console.log(`         📖 ${jpToEnLocal.size} mappings`);
                    }
                    for (const ev of events) {
                        if (ev.name.ja.endsWith('_AA')) { ev.name.en = ev.name.ja; continue; }
                        ev.name.en = jpToEnLocal._fuzzyLookup?.(ev.name.ja)
                            || jpToEnLocal.get(ev.name.ja)
                            || ev.name.ja;
                    }

                    const phaseNames = content.phaseNames || {};
                    let counter = 0;
                    const template = {
                        contentId: cid,
                        generatedAt: new Date().toISOString(),
                        source: 'spreadsheet',
                        sourceSheetId: config.sheetId,
                        timelineEvents: events.map(ev => ({
                            id: `tpl_${counter++}_${Math.random().toString(36).slice(2, 8)}`,
                            ...ev,
                        })),
                        phases: phaseNames['1']
                            ? Object.entries(phaseNames).map(([id, name]) => ({
                                id: parseInt(id),
                                startTimeSec: 0,
                                name: typeof name === 'string' ? { ja: '', en: name } : name,
                            }))
                            : [],
                    };

                    const outPath = resolve(TEMPLATES_DIR, `${cid}.json`);
                    writeFileSync(outPath, JSON.stringify(template, null, 2) + '\n', 'utf-8');
                    console.log(`   💾 Saved ${cid}.json (${events.length} events)`);
                    success++;
                }
            }
        } catch (err) {
            console.log(`   ❌ Error: ${err.message}`);
            failed += ids.length;
        }
    }

    console.log(`\n════════════════════════════════════════════`);
    console.log(`📊 Summary`);
    console.log(`   ✅ Generated: ${success}`);
    console.log(`   ❌ Failed:    ${failed}`);
    console.log(`   📁 Output:    ${TEMPLATES_DIR}`);
    console.log(`════════════════════════════════════════════`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
