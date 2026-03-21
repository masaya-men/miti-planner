import { readFileSync } from 'node:fs';

const TOKEN_ENDPOINT = 'https://www.fflogs.com/oauth/token';
const GRAPHQL_ENDPOINT = 'https://www.fflogs.com/api/v2/client';

const env = readFileSync('.env.local', 'utf-8');
let clientId, clientSecret;
for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_FFLOGS_CLIENT_ID=')) clientId = trimmed.split('=')[1];
    if (trimmed.startsWith('VITE_FFLOGS_CLIENT_SECRET=')) clientSecret = trimmed.split('=')[1];
}

async function run() {
    const resp = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });
    const { access_token } = await resp.json();

    const qEncounters = `
        query {
            worldData {
                zones {
                    id
                    name
                    encounters {
                        id
                        name
                    }
                }
            }
        }
    `;
    const gRespZones = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
        body: JSON.stringify({ query: qEncounters }),
    });
    const zones = await gRespZones.json();
    const arcadia = zones.data.worldData.zones.find(z => z.name.includes('AAC Light-Heavyweight'));
    const m4s = arcadia.encounters.find(e => e.name.includes('Wicked Thunder'));
    console.log('M4S ID:', m4s.id);

    // 1. Get a JP log for M4S
    const qRankings = `
        query {
            worldData {
                encounter(id: ${m4s.id}) {
                    name
                    fightRankings(page: 1, metric: speed, serverRegion: "JP")
                }
            }
        }
    `;

    const gResp1 = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
        body: JSON.stringify({ query: qRankings }),
    });
    const json1 = await gResp1.json();
    const rankings = json1.data.worldData.encounter.fightRankings.rankings;
    
    // Check multiple logs
    for (let i = Math.max(0, rankings.length - 5); i < rankings.length; i++) {
        const slowKill = rankings[i];
        
        // 2. Get fight start/end
        const qFight = `
            query {
                reportData {
                    report(code: "${slowKill.report.code}") {
                        fights(killType: Kills) { id startTime endTime }
                    }
                }
            }
        `;
        const gResp2 = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
            body: JSON.stringify({ query: qFight }),
        });
        const json2 = await gResp2.json();
        const fight = json2.data.reportData.report.fights.find(f => f.id === slowKill.report.fightID) || json2.data.reportData.report.fights[0];

        // 3. Request events translation false
        const qEvents = `
            query {
                reportData {
                    report(code: "${slowKill.report.code}") {
                        events(
                            dataType: DamageDone
                            fightIDs: [${fight.id}]
                            hostilityType: Enemies
                            startTime: ${fight.startTime}
                            endTime: ${fight.endTime}
                            limit: 10
                            translate: false
                        ) { data }
                    }
                }
            }
        `;
        const gResp3 = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
            body: JSON.stringify({ query: qEvents }),
        });
        const res = await gResp3.json();
        const names = res.data?.reportData?.report?.events?.data?.map(e => e.ability?.name).filter(Boolean) || [];
        console.log("Log " + i + ":", Array.from(new Set(names)).join(', '));
    }
}

run();
