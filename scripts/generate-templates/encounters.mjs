import { gql } from './api.mjs';

// ─── Step 1: Discover FFLogs zones and encounters ───
export async function discoverEncounters(token) {
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
export function matchEncountersToContent(contents, encounters) {
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
