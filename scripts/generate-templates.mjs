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

// ─── Configuration ───
const LOGS_PER_CONTENT = 3;          // Number of logs to merge per content
const API_DELAY_MS = 1500;           // Delay between API calls to respect rate limits
const XIVAPI_DELAY_MS = 200;         // XIVAPI rate limit delay
const GRAPHQL_ENDPOINT = 'https://www.fflogs.com/api/v2/client';
const TOKEN_ENDPOINT = 'https://www.fflogs.com/oauth/token';
const XIVAPI_BASE = 'https://xivapi.com';

// ─── Auto-attack names to filter ───
const AA_NAMES = new Set(['Attack', 'Shot', '攻撃', 'Attaque', 'Attacke']);

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

// ─── Token management ───
let _token = null;
let _tokenExp = 0;

async function getToken(clientId, clientSecret) {
    if (_token && Date.now() < _tokenExp - 30_000) return _token;

    const resp = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });

    if (!resp.ok) {
        throw new Error(`Token request failed (${resp.status}): ${await resp.text()}`);
    }

    const json = await resp.json();
    _token = json.access_token;
    _tokenExp = Date.now() + json.expires_in * 1000;
    return _token;
}

// ─── GraphQL helper ───
async function gql(token, query, variables = {}) {
    const resp = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`GraphQL error (${resp.status}): ${body}`);
    }

    const json = await resp.json();
    if (json.errors?.length) {
        throw new Error(`GraphQL: ${json.errors.map(e => e.message).join(', ')}`);
    }
    return json.data;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ─── XIVAPI: Fetch official JP/EN ability names by game ID ───
const _xivApiCache = new Map();

async function fetchXivApiName(guid) {
    if (_xivApiCache.has(guid)) return _xivApiCache.get(guid);
    try {
        const resp = await fetch(`${XIVAPI_BASE}/Action/${guid}?columns=Name_ja,Name_en,ID`);
        if (!resp.ok) {
            _xivApiCache.set(guid, null);
            return null;
        }
        const json = await resp.json();
        const result = { ja: json.Name_ja || '', en: json.Name_en || '' };
        _xivApiCache.set(guid, result);
        return result;
    } catch {
        _xivApiCache.set(guid, null);
        return null;
    }
}

async function buildXivApiDict(guids) {
    const dict = new Map();
    const unique = [...new Set(guids)].filter(g => g > 0 && !_xivApiCache.has(g));
    if (unique.length > 0) {
        console.log(`   🌐 XIVAPI: Looking up ${unique.length} ability names...`);
        for (const guid of unique) {
            await fetchXivApiName(guid);
            await sleep(XIVAPI_DELAY_MS);
        }
    }
    // Build dict from cache
    for (const g of guids) {
        if (g > 0) {
            const cached = _xivApiCache.get(g);
            if (cached && cached.ja) dict.set(g, cached);
        }
    }
    return dict;
}

// ─── Damage rounding (same as damageRounding.ts) ───
function roundDamageCeil(value) {
    if (value <= 999 || value <= 0) return value;
    const digits = Math.floor(Math.log10(value)) + 1;
    const divisor = Math.pow(10, digits - 3);
    return Math.ceil(value / divisor) * divisor;
}

// ─── Step 1: Discover FFLogs zones and encounters ───
async function discoverEncounters(token) {
    console.log('\n🔍 Discovering FFLogs zones and encounters...');

    const data = await gql(token, `
        query {
            worldData {
                zones {
                    id
                    name
                    frozen
                    encounters {
                        id
                        name
                    }
                }
            }
        }
    `);

    // Filter to FF14-relevant zones (Savage, Ultimate)
    const zones = data.worldData.zones;
    console.log(`   Found ${zones.length} total zones`);

    // Return flat list of encounters with zone context
    const encounters = [];
    for (const zone of zones) {
        for (const enc of zone.encounters) {
            encounters.push({
                zoneId: zone.id,
                zoneName: zone.name,
                encounterId: enc.id,
                encounterName: enc.name,
            });
        }
    }

    return encounters;
}

// ─── Step 2: Match encounters to our content IDs ───
function matchEncountersToContent(contents, encounters) {
    const matched = [];
    const unmatched = [];

    for (const content of contents) {
        // If already has a mapping, use it
        if (content.fflogsEncounterId) {
            matched.push(content);
            continue;
        }

        // Try to match by name (fuzzy)
        const jaName = content.ja;
        const enName = content.en;

        // Remove phase suffixes for matching
        const cleanEn = enName
            .replace(/\s*Phase \d+$/i, '')
            .replace(/\s*\(Savage\)$/i, '')
            .replace(/\s*\(Ultimate\)$/i, '')
            .trim();

        const found = encounters.find(enc => {
            const encClean = enc.encounterName
                .replace(/\s*\(Savage\)$/i, '')
                .replace(/\s*\(Ultimate\)$/i, '')
                .trim();
            return encClean.toLowerCase() === cleanEn.toLowerCase()
                || enc.encounterName.toLowerCase().includes(cleanEn.toLowerCase());
        });

        if (found) {
            content.fflogsEncounterId = found.encounterId;
            matched.push(content);
            console.log(`   ✅ ${content.id} → encounter ${found.encounterId} (${found.encounterName})`);
        } else {
            unmatched.push(content);
            console.log(`   ❌ ${content.id}: "${enName}" — no match found`);
        }
    }

    return { matched, unmatched };
}

// ─── Step 3: Fetch rankings (slow kills) ───
async function fetchSlowKills(token, encounterId, count = 3, region = undefined) {
    // Get rankings sorted by duration (ascending = fastest, so we need page to get slowest)
    // FFLogs fightRankings metric: "speed" gives fights sorted by duration
    const regionArg = region ? `, serverRegion: "${region}"` : '';
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

    const rankings = data.worldData.encounter?.fightRankings;
    if (!rankings || !rankings.rankings || rankings.rankings.length === 0) {
        console.log(`   ⚠️  No rankings found for encounter ${encounterId}`);
        return [];
    }

    // fightRankings sorted by speed = fastest first
    // We want SLOWEST kills → take from the end
    const allRankings = rankings.rankings;
    const slowest = allRankings.slice(-count).reverse();

    return slowest.map(r => ({
        reportCode: r.report?.code,
        fightId: r.report?.fightID,
        duration: r.duration,
        startTime: r.startTime,
    })).filter(r => r.reportCode && r.fightId);
}

// ─── Step 4: Fetch fight metadata (start/end times) ───
async function fetchFightMeta(token, reportCode, fightId) {
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
async function fetchDamageEvents(token, reportCode, fight, translate = false) {
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

// ─── Step 6: Simplified mapper (Node.js version of fflogsMapper) ───
function getRawDamage(ev) {
    if (ev.unmitigatedAmount !== undefined && ev.unmitigatedAmount > 0) return ev.unmitigatedAmount;
    const visible = (ev.amount || 0) + (ev.absorbed || 0);
    return Math.floor(visible / Math.max(ev.multiplier || 1, 0.01));
}

function isAutoAttack(ev) {
    return AA_NAMES.has(ev.ability?.name?.trim() ?? '');
}

function mapDamageType(t) {
    if (t === undefined) return 'magical';
    if (t === 1 || t === 2 || t === 3 || t === 4 || t === 128) return 'physical';
    return 'magical';
}

function mapEventsToTimeline(rawEn, rawJp, fight, xivApiDict = new Map()) {
    // Deduplicate
    const deduped = new Map();
    for (const ev of rawEn) {
        const p = ev.packetID;
        if (p === undefined) continue;
        const key = `${p}:${ev.targetID ?? 0}`;
        const ex = deduped.get(key);
        if (!ex || getRawDamage(ev) > getRawDamage(ex)) deduped.set(key, ev);
    }
    const dd = [...deduped.values(), ...rawEn.filter(e => e.packetID === undefined)];

    // Filter
    const filtered = dd.filter(ev =>
        ev.tick !== true &&
        (ev.unmitigatedAmount !== undefined || ev.amount !== undefined ||
         ev.absorbed !== undefined || ev.mitigated !== undefined) &&
        getRawDamage(ev) < 999999
    );

    if (!filtered.length) return [];

    // JP names map (FFLogs fallback)
    const jpMap = new Map();
    for (const ev of rawJp) {
        const g = ev.ability?.guid ?? ev.abilityGameID;
        const n = ev.ability?.name?.trim();
        if (g !== undefined && n && !jpMap.has(g)) jpMap.set(g, n);
    }

    // Normalize — priority: XIVAPI dict > FFLogs JP > FFLogs EN
    const ref = fight.startTime;
    const GROUPING_WINDOW_MS = 800;
    const TB_DAMAGE_RATIO = 1.5;

    const norm = filtered.filter(ev => ev.timestamp >= ref).map(ev => {
        const ms = ev.timestamp - ref;
        const a = isAutoAttack(ev);
        const g = ev.ability?.guid ?? ev.abilityGameID ?? -1;
        const en = a ? 'AA' : (ev.ability?.name?.trim() || 'Unknown');

        // Resolve JP name: XIVAPI (authoritative) > FFLogs JP > fallback to EN
        let jpN;
        if (a) {
            jpN = 'AA'; // User requested AA stays as "AA"
        } else {
            const xiv = xivApiDict.get(g);
            if (xiv && xiv.ja) {
                jpN = xiv.ja;
            } else {
                const jp = jpMap.get(g);
                jpN = (jp && !AA_NAMES.has(jp)) ? jp : en;
            }
        }

        // Also fix EN name from XIVAPI if available (handles garbled names)
        let enN = en;
        if (!a) {
            const xiv = xivApiDict.get(g);
            if (xiv && xiv.en) enN = xiv.en;
        }

        return {
            timeSec: Math.floor(ms / 1000), timeMs: ms, rawDmg: getRawDamage(ev),
            aa: a, enName: enN, jpName: jpN, guid: g,
            aType: ev.ability?.type, tgtID: ev.targetID ?? -1
        };
    });

    // MT/ST identification
    const hits = new Map();
    for (const n of norm) {
        if (!n.aa) continue;
        const e = hits.get(n.tgtID);
        if (!e) hits.set(n.tgtID, { c: 1, f: n.timeMs });
        else e.c++;
    }
    const sorted = [...hits.entries()].sort((a, b) => b[1].c - a[1].c || a[1].f - b[1].f);
    const mtId = sorted[0]?.[0] ?? null;
    const stId = sorted[1]?.[0] ?? null;
    const tanks = new Set();
    if (mtId !== null) tanks.add(mtId);
    if (stId !== null) tanks.add(stId);

    // Pre-compute damage info
    const admg = new Map();
    for (const n of norm) {
        let d = admg.get(n.guid);
        if (!d) { d = { mt: 0, pt: 0, hT: false, hP: false }; admg.set(n.guid, d); }
        if (tanks.has(n.tgtID)) { d.hT = true; if (n.rawDmg > d.mt) d.mt = n.rawDmg; }
        else { d.hP = true; if (n.rawDmg > d.pt) d.pt = n.rawDmg; }
    }

    const tbSet = new Set();
    const dmgT = new Map();
    const dmgP = new Map();
    for (const [g, d] of admg) {
        if (d.hT && d.hP && d.mt > d.pt * TB_DAMAGE_RATIO) {
            tbSet.add(g);
            dmgT.set(g, Math.floor(d.mt / 1.05));
            dmgP.set(g, Math.floor(d.pt / 1.05));
        } else {
            const mx = Math.max(d.mt, d.pt);
            dmgT.set(g, Math.floor(mx / 1.05));
            dmgP.set(g, Math.floor(mx / 1.05));
        }
    }

    // Group non-AA
    const nonAA = norm.filter(n => !n.aa).sort((a, b) => a.timeMs - b.timeMs);
    const used = new Set();
    const groups = [];
    for (let i = 0; i < nonAA.length; i++) {
        if (used.has(i)) continue;
        const gr = [nonAA[i]]; used.add(i);
        for (let j = i + 1; j < nonAA.length; j++) {
            if (used.has(j) || nonAA[j].guid !== nonAA[i].guid) continue;
            if (nonAA[j].timeMs - nonAA[i].timeMs > GROUPING_WINDOW_MS) break;
            gr.push(nonAA[j]); used.add(j);
        }
        groups.push(gr);
    }

    // Post-merge same-ability same-timeSec
    for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
            if (groups[i][0].guid !== groups[j][0].guid) continue;
            if (groups[i][0].timeSec !== groups[j][0].timeSec) continue;
            groups[i].push(...groups[j]);
            groups.splice(j, 1); j--;
        }
    }

    // Build timeline
    const tl = [];

    for (const gr of groups) {
        const f = gr[0], g = f.guid, tb = tbSet.has(g);
        const uTgts = new Set(gr.map(n => n.tgtID));
        const tHits = gr.filter(n => tanks.has(n.tgtID));
        const pHits = gr.filter(n => !tanks.has(n.tgtID));

        if (tb && tHits.length > 0 && pHits.length > 0) {
            const td = dmgT.get(g) ?? 0;
            for (const tid of new Set(tHits.map(n => n.tgtID))) {
                tl.push({
                    time: f.timeSec, name: { ja: `${f.jpName} (TB)`, en: `${f.enName} (TB)` },
                    damageType: mapDamageType(f.aType),
                    damageAmount: td > 0 ? td : undefined, target: tid === stId ? 'ST' : 'MT'
                });
            }
            const pd = dmgP.get(g) ?? 0;
            tl.push({
                time: f.timeSec + 1, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: pd > 0 ? pd : undefined, target: 'AoE'
            });
        } else if (tb && tHits.length > 0) {
            const td = dmgT.get(g) ?? 0;
            for (const tid of new Set(tHits.map(n => n.tgtID))) {
                tl.push({
                    time: f.timeSec, name: { ja: `${f.jpName} (TB)`, en: `${f.enName} (TB)` },
                    damageType: mapDamageType(f.aType),
                    damageAmount: td > 0 ? td : undefined, target: tid === stId ? 'ST' : 'MT'
                });
            }
        } else if (uTgts.size >= 3) {
            const d = dmgP.get(g) ?? 0;
            tl.push({
                time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: d > 0 ? d : undefined, target: 'AoE'
            });
        } else if (uTgts.size === 2 && [...uTgts].every(id => tanks.has(id))) {
            const d = dmgP.get(g) ?? 0;
            for (const tid of uTgts) {
                tl.push({
                    time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                    damageType: mapDamageType(f.aType), damageAmount: d > 0 ? d : undefined,
                    target: tid === stId ? 'ST' : 'MT'
                });
            }
        } else {
            const [tid] = uTgts;
            const d = dmgP.get(g) ?? 0;
            const target = tid === stId ? 'ST' : (tid === mtId ? 'MT' : 'AoE');
            tl.push({
                time: f.timeSec, name: { ja: f.jpName, en: f.enName },
                damageType: mapDamageType(f.aType), damageAmount: d > 0 ? d : undefined, target
            });
        }
    }

    // AA events (grouped)
    const aaGuid = norm.find(n => n.aa)?.guid ?? -1;
    const aaInfo = admg.get(aaGuid);
    const aaMax = Math.max(aaInfo?.mt ?? 0, aaInfo?.pt ?? 0);
    const aaBD = Math.floor((aaMax / 1.05) * 0.8);

    const aaGr = new Map();
    for (const n of norm) {
        if (!n.aa) continue;
        const k = `${n.timeSec}:${n.tgtID}`;
        if (!aaGr.has(k)) aaGr.set(k, []); aaGr.get(k).push(n);
    }
    for (const [k, gr] of aaGr) {
        const [s, t] = k.split(':');
        const sec = parseInt(s, 10), tid = parseInt(t, 10);
        tl.push({
            time: sec, name: { ja: gr[0].jpName, en: gr[0].enName },
            damageType: mapDamageType(gr[0].aType), damageAmount: aaBD > 0 ? aaBD : undefined,
            target: tid === stId ? 'ST' : 'MT'
        });
    }

    // Sort
    tl.sort((a, b) => a.time !== b.time ? a.time - b.time : (a.target === 'AoE' ? 0 : 1) - (b.target === 'AoE' ? 0 : 1));

    return tl;
}

// ─── Step 7: Multi-log merge ───
function mergeTimelines(timelines) {
    if (timelines.length === 0) return [];
    if (timelines.length === 1) return timelines[0];

    // Start with first timeline as base
    const merged = timelines[0].map(ev => ({ ...ev }));
    const MERGE_WINDOW_SEC = 2;

    for (let tIdx = 1; tIdx < timelines.length; tIdx++) {
        const other = timelines[tIdx];

        for (const oEv of other) {
            // Try to find matching event in merged
            const matchIdx = merged.findIndex(mEv =>
                mEv.name.en === oEv.name.en &&
                mEv.target === oEv.target &&
                Math.abs(mEv.time - oEv.time) <= MERGE_WINDOW_SEC
            );

            if (matchIdx >= 0) {
                // Update damage to maximum
                const mEv = merged[matchIdx];
                if (oEv.damageAmount !== undefined) {
                    if (mEv.damageAmount === undefined || oEv.damageAmount > mEv.damageAmount) {
                        mEv.damageAmount = oEv.damageAmount;
                    }
                }
            } else {
                // New event not in base — add it
                merged.push({ ...oEv });
            }
        }
    }

    // Re-sort
    merged.sort((a, b) => a.time !== b.time ? a.time - b.time : (a.target === 'AoE' ? 0 : 1) - (b.target === 'AoE' ? 0 : 1));

    return merged;
}

// ─── Step 8: Apply rounding and generate IDs ───
function finalizeTimeline(events) {
    let counter = 0;
    return events.map(ev => ({
        id: `tpl_${counter++}_${Math.random().toString(36).slice(2, 8)}`,
        time: ev.time,
        name: ev.name,
        damageType: ev.damageType,
        damageAmount: ev.damageAmount !== undefined ? roundDamageCeil(ev.damageAmount) : undefined,
        target: ev.target,
    }));
}

// ─── Phase extraction from fight metadata ───
function extractPhases(fight) {
    if (!fight.phaseTransitions || fight.phaseTransitions.length === 0) return [];

    const ref = fight.startTime;
    return fight.phaseTransitions.map(pt => ({
        id: pt.id,
        startTimeSec: Math.floor((pt.startTime - ref) / 1000),
    }));
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
    console.log('│   Grapl Template Generator                │');
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
            // Fetch rankings (slow kills). Mix global and JP logs to ensure translation works
            console.log(`   🔍 Fetching ${LOGS_PER_CONTENT} slow kills (Global + JP)...`);
            const globalKills = await fetchSlowKills(token, encId, LOGS_PER_CONTENT);
            await sleep(API_DELAY_MS);
            
            // To guarantee we get JP names (translate:false returns original client string), we must fetch 
            // from JP region where players are almost guaranteed to be using the Japanese client.
            const jpKills = await fetchSlowKills(token, encId, 2, 'JP');
            await sleep(API_DELAY_MS);
            
            // Combine and deduplicate kills
            const allKillsMap = new Map();
            for (const kill of [...globalKills, ...jpKills]) {
                if (!allKillsMap.has(kill.reportCode)) {
                    allKillsMap.set(kill.reportCode, kill);
                }
            }
            const kills = Array.from(allKillsMap.values());

            if (kills.length === 0) {
                console.log(`   ⚠️  No kills found — skipping`);
                skipped += groupContents.length;
                continue;
            }

            console.log(`   📊 Found ${kills.length} kills to process`);

            // Fetch events for each kill and build timelines
            const allTimelines = [];

            for (let i = 0; i < kills.length; i++) {
                const kill = kills[i];
                console.log(`   📥 Log ${i + 1}/${kills.length}: ${kill.reportCode}#${kill.fightId} (${Math.round(kill.duration / 1000)}s)`);

                try {
                    const fight = await fetchFightMeta(token, kill.reportCode, kill.fightId);
                    await sleep(API_DELAY_MS);

                    const eventsEn = await fetchDamageEvents(token, kill.reportCode, fight, true);
                    await sleep(API_DELAY_MS);

                    const eventsJp = await fetchDamageEvents(token, kill.reportCode, fight, false);
                    await sleep(API_DELAY_MS);

                    // Collect all unique ability GUIDs for XIVAPI lookup
                    const allGuids = [...eventsEn, ...eventsJp]
                        .map(e => e.ability?.guid ?? e.abilityGameID)
                        .filter(g => g !== undefined && g > 0);
                    const xivApiDict = await buildXivApiDict(allGuids);

                    const timeline = mapEventsToTimeline(eventsEn, eventsJp, fight, xivApiDict);
                    allTimelines.push({ timeline, fight });
                    console.log(`      → ${timeline.length} events`);
                } catch (err) {
                    console.log(`      ❌ Error: ${err.message}`);
                }
            }

            if (allTimelines.length === 0) {
                console.log(`   ⚠️  No valid timelines — skipping`);
                skipped += groupContents.length;
                continue;
            }

            // Merge timelines
            console.log(`   🔀 Merging ${allTimelines.length} timelines...`);
            const merged = mergeTimelines(allTimelines.map(t => t.timeline));
            const finalized = finalizeTimeline(merged);
            console.log(`   → ${finalized.length} events after merge`);

            // Get phases from the first fight that has them
            const phases = allTimelines.find(t => t.fight.phaseTransitions?.length > 0)
                ? extractPhases(allTimelines.find(t => t.fight.phaseTransitions?.length > 0).fight)
                : [];

            // Handle phase splitting for checkpoint content
            if (groupContents.length > 1 && groupContents.some(c => c.hasCheckpoint)) {
                // We have p1/p2 split — divide the timeline
                if (phases.length >= 2) {
                    // Use phase boundary to split
                    const p2Start = phases[1].startTimeSec; // Phase 2 start time

                    for (const content of groupContents) {
                        const isP1 = content.id.endsWith('_p1');
                        const phaseEvents = isP1
                            ? finalized.filter(ev => ev.time < p2Start)
                            : finalized.filter(ev => ev.time >= p2Start).map(ev => ({
                                ...ev,
                                time: ev.time - p2Start, // Normalize to 0-based
                            }));

                        const template = {
                            contentId: content.id,
                            generatedAt: new Date().toISOString(),
                            sourceLogsCount: allTimelines.length,
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
                    // No phase info — save full timeline for each, with a warning
                    console.log(`   ⚠️  No phase data for splitting — saving full timeline for each`);
                    for (const content of groupContents) {
                        const template = {
                            contentId: content.id,
                            generatedAt: new Date().toISOString(),
                            sourceLogsCount: allTimelines.length,
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
                // Single content — save as-is
                const content = groupContents[0];
                const template = {
                    contentId: content.id,
                    generatedAt: new Date().toISOString(),
                    sourceLogsCount: allTimelines.length,
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
