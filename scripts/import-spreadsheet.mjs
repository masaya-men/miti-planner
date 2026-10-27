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
import { buildJpEnDict } from './import-spreadsheet/fflogs.mjs';
import { SPREADSHEETS, getSheetTabs, fetchSheetCSV, parseCSV } from './import-spreadsheet/sheets.mjs';
import { parseTimelineSheet } from './import-spreadsheet/parse.mjs';

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
