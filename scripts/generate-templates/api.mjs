import { GRAPHQL_ENDPOINT, TOKEN_ENDPOINT } from './config.mjs';

// ─── Token management ───
let _token = null;
let _tokenExp = 0;

export async function getToken(clientId, clientSecret) {
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
export async function gql(token, query, variables = {}) {
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

export function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
