#!/usr/bin/env node

/**
 * scripts/generate-templates.mjs
 *
 * Generates template JSON files for all content by fetching data from FFLogs.
 *
 * Steps:
 *   1. Reads contents.json
 *   2. Discovers FFLogs encounter IDs via worldData API (if not already mapped)
 *   3. For each content, fetches 3-5 slow kills from Rankings API
 *   4. Fetches damage events for each kill (EN + JP)
 *   5. Merges multiple logs into a single comprehensive timeline
 *   6. Applies damage rounding (3 significant digits, ceiling)
 *   7. Saves templates to src/data/templates/{contentId}.json
 *
 * Usage:
 *   npm run generate-templates
 *   npm run generate-templates -- --content m4s       (single content)
 *   npm run generate-templates -- --discover-only     (just discover encounter IDs)
 *
 * Requires VITE_FFLOGS_CLIENT_ID and VITE_FFLOGS_CLIENT_SECRET in .env.local
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENTS_PATH = resolve(__dirname, '../src/data/contents.json');
const TEMPLATES_DIR = resolve(__dirname, '../src/data/templates');
const ENV_PATH = resolve(__dirname, '../.env.local');

import { API_DELAY_MS } from './generate-templates/config.mjs';
import { getToken, sleep } from './generate-templates/api.mjs';
import { buildXivApiDict } from './generate-templates/xivapi.mjs';
import { discoverEncounters, matchEncountersToContent } from './generate-templates/encounters.mjs';
import { findBestLog, fetchFightMeta, fetchDamageEvents, fetchCastEvents, fetchDeathEvents } from './generate-templates/fflogs-fetch.mjs';
import { mapEventsToTimeline } from './generate-templates/map-events.mjs';
import { mergeTimelines, finalizeTimeline, extractPhases } from './generate-templates/merge.mjs';

// ─── Env parsing ───
function loadEnv() {
    if (!existsSync(ENV_PATH)) {
        throw new Error('.env.local not found. Please create it with VITE_FFLOGS_CLIENT_ID and VITE_FFLOGS_CLIENT_SECRET.');
    }
    const lines = readFileSync(ENV_PATH, 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
    return env;
}
// ─── Main ───
async function main() {
    const args = process.argv.slice(2);
    const singleContent = args.find(a => a.startsWith('--content'))
        ? args[args.indexOf('--content') + 1] || args.find(a => a.startsWith('--content='))?.split('=')[1]
        : null;
    const discoverOnly = args.includes('--discover-only');

    console.log('');
    console.log('┌───────────────────────────────────────────┐');
    console.log('│   LoPo Template Generator                 │');
    console.log('│   FFLogs → Template JSON                  │');
    console.log('└───────────────────────────────────────────┘');

    // Load env
    const env = loadEnv();
    const clientId = env.VITE_FFLOGS_CLIENT_ID;
    const clientSecret = env.VITE_FFLOGS_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('VITE_FFLOGS_CLIENT_ID and VITE_FFLOGS_CLIENT_SECRET required in .env.local');
    }

    // Get token
    console.log('\n🔑 Authenticating with FFLogs...');
    const token = await getToken(clientId, clientSecret);
    console.log('   ✅ Token obtained');

    // Load contents
    const contents = JSON.parse(readFileSync(CONTENTS_PATH, 'utf-8'));
    const targetContents = singleContent
        ? contents.filter(c => c.id === singleContent)
        : contents;

    if (singleContent && targetContents.length === 0) {
        throw new Error(`Content "${singleContent}" not found in contents.json`);
    }

    // Step 1: Discover encounter IDs
    const encounters = await discoverEncounters(token);
    await sleep(API_DELAY_MS);

    // Step 2: Match encounters
    console.log('\n📋 Matching encounters to content...');
    const { matched, unmatched } = matchEncountersToContent(targetContents, encounters);

    // Save encounter IDs back to contents.json
    let dirty = false;
    for (const m of matched) {
        const orig = contents.find(c => c.id === m.id);
        if (orig && !orig.fflogsEncounterId && m.fflogsEncounterId) {
            orig.fflogsEncounterId = m.fflogsEncounterId;
            dirty = true;
        }
    }
    if (dirty) {
        writeFileSync(CONTENTS_PATH, JSON.stringify(contents, null, 2) + '\n', 'utf-8');
        console.log('   💾 Updated contents.json with encounter IDs');
    }

    if (discoverOnly) {
        console.log('\n✅ Discovery complete.');
        console.log(`   Matched: ${matched.length}, Unmatched: ${unmatched.length}`);
        if (unmatched.length > 0) {
            console.log('   Unmatched content:');
            for (const u of unmatched) {
                console.log(`     - ${u.id}: "${u.en}"`);
            }
        }
        return;
    }

    // Step 3: Generate templates
    mkdirSync(TEMPLATES_DIR, { recursive: true });

    let success = 0;
    let skipped = 0;
    let failed = 0;

    // Group p1/p2 content that shares the same encounter
    const contentGroups = new Map();
    for (const content of matched) {
        const baseId = content.id.replace(/_p[12]$/, '');
        if (!contentGroups.has(baseId)) contentGroups.set(baseId, []);
        contentGroups.get(baseId).push(content);
    }

    for (const [baseId, groupContents] of contentGroups) {
        const primary = groupContents[0];
        const encId = primary.fflogsEncounterId;
        if (!encId) { skipped++; continue; }

        console.log(`\n────────────────────────────────────────`);
        console.log(`📦 ${primary.en} (encounter ${encId})`);

        try {
            // 単一ログ方式：死亡0のJP遅いキルを1つ探す
            console.log(`   🔍 Searching for best deathless log (JP preferred, slowest kill)...`);
            const best = await findBestLog(token, encId);

            if (!best) {
                console.log(`   ⚠️  No log found — skipping`);
                skipped += groupContents.length;
                continue;
            }

            const { reportCode, fightId, fight, deaths } = best;
            console.log(`   📥 Using: ${reportCode}#${fightId} (${Math.round(best.duration / 1000)}s, ${deaths.length} deaths)`);

            const eventsEn = await fetchDamageEvents(token, reportCode, fight, true);
            await sleep(API_DELAY_MS);

            const eventsJp = await fetchDamageEvents(token, reportCode, fight, false);
            await sleep(API_DELAY_MS);

            // キャストイベント取得（ダメージなし詠唱をタイムラインに含めるため）
            const castEn = await fetchCastEvents(token, reportCode, fight, true);
            await sleep(API_DELAY_MS);

            const castJp = await fetchCastEvents(token, reportCode, fight, false);
            await sleep(API_DELAY_MS);

            // Collect all unique ability GUIDs for XIVAPI lookup
            const allGuids = [...eventsEn, ...eventsJp, ...castEn, ...castJp]
                .map(e => e.ability?.guid ?? e.abilityGameID)
                .filter(g => g !== undefined && g > 0);
            const xivApiDict = await buildXivApiDict(allGuids);

            const timeline = mapEventsToTimeline(eventsEn, eventsJp, fight, xivApiDict, deaths, castEn, castJp);
            console.log(`      → ${timeline.length} events`);

            const finalized = finalizeTimeline(timeline);
            console.log(`   → ${finalized.length} events`);

            // Get phases
            const phaseNames = primary.phaseNames || {};
            const phases = fight.phaseTransitions?.length > 0
                ? extractPhases(fight, phaseNames)
                : [];

            // Handle phase splitting for checkpoint content
            if (groupContents.length > 1 && groupContents.some(c => c.hasCheckpoint)) {
                if (phases.length >= 2) {
                    const p2Start = phases[1].startTimeSec;

                    for (const content of groupContents) {
                        const isP1 = content.id.endsWith('_p1');
                        const phaseEvents = isP1
                            ? finalized.filter(ev => ev.time < p2Start)
                            : finalized.filter(ev => ev.time >= p2Start).map(ev => ({
                                ...ev,
                                time: ev.time - p2Start,
                            }));

                        const template = {
                            contentId: content.id,
                            generatedAt: new Date().toISOString(),
                            sourceLogsCount: 1,
                            sourceLog: `${reportCode}#${fightId}`,
                            timelineEvents: phaseEvents,
                            phases: isP1
                                ? phases.filter(p => p.startTimeSec < p2Start)
                                : phases.filter(p => p.startTimeSec >= p2Start).map(p => ({
                                    ...p,
                                    startTimeSec: p.startTimeSec - p2Start,
                                })),
                        };

                        const outPath = resolve(TEMPLATES_DIR, `${content.id}.json`);
                        writeFileSync(outPath, JSON.stringify(template, null, 2) + '\n', 'utf-8');
                        console.log(`   💾 Saved ${content.id}.json (${phaseEvents.length} events)`);
                        success++;
                    }
                } else {
                    console.log(`   ⚠️  No phase data for splitting — saving full timeline for each`);
                    for (const content of groupContents) {
                        const template = {
                            contentId: content.id,
                            generatedAt: new Date().toISOString(),
                            sourceLogsCount: 1,
                            sourceLog: `${reportCode}#${fightId}`,
                            timelineEvents: finalized,
                            phases,
                            _warning: 'Phase split data not available; full timeline included',
                        };

                        const outPath = resolve(TEMPLATES_DIR, `${content.id}.json`);
                        writeFileSync(outPath, JSON.stringify(template, null, 2) + '\n', 'utf-8');
                        console.log(`   💾 Saved ${content.id}.json (${finalized.length} events, full)`);
                        success++;
                    }
                }
            } else {
                const content = groupContents[0];
                const template = {
                    contentId: content.id,
                    generatedAt: new Date().toISOString(),
                    sourceLogsCount: 1,
                    sourceLog: `${reportCode}#${fightId}`,
                    timelineEvents: finalized,
                    phases,
                };

                const outPath = resolve(TEMPLATES_DIR, `${content.id}.json`);
                writeFileSync(outPath, JSON.stringify(template, null, 2) + '\n', 'utf-8');
                console.log(`   💾 Saved ${content.id}.json (${finalized.length} events)`);
                success++;
            }

        } catch (err) {
            console.log(`   ❌ Failed: ${err.message}`);
            failed += groupContents.length;
        }
    }

    // Summary
    console.log('\n════════════════════════════════════════════');
    console.log('📊 Summary');
    console.log(`   ✅ Generated: ${success}`);
    console.log(`   ⚠️  Skipped:   ${skipped}`);
    console.log(`   ❌ Failed:    ${failed}`);
    console.log(`   📁 Output:    ${TEMPLATES_DIR}`);
    console.log('════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
});
