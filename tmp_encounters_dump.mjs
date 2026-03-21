import { readFileSync, writeFileSync } from 'node:fs';

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
    writeFileSync('tmp_encounters.json', JSON.stringify(zones.data.worldData.zones, null, 2));
    console.log('Saved to tmp_encounters.json');
}

run();
