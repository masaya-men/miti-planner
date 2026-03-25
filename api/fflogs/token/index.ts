/**
 * Vercel Serverless Function — FFLogs OAuth2 Token Proxy
 *
 * Keeps the client_secret server-side so it is never exposed in the browser bundle.
 * Frontend calls POST /api/fflogs/token and receives { access_token, expires_in }.
 *
 * 複数APIキーのラウンドロビン対応:
 *   FFLOGS_CLIENT_ID / FFLOGS_CLIENT_SECRET — メインキー
 *   FFLOGS_CLIENT_ID_2〜5 / FFLOGS_CLIENT_SECRET_2〜5 — 追加キー
 *
 * リクエストごとに異なるキーを使用し、API枠を分散させる。
 */

export const config = { runtime: 'edge' };

// 利用可能なAPIキーペアを環境変数から収集
function getCredentialPairs(): { clientId: string; clientSecret: string }[] {
    const pairs: { clientId: string; clientSecret: string }[] = [];

    // メインキー
    if (process.env.FFLOGS_CLIENT_ID && process.env.FFLOGS_CLIENT_SECRET) {
        pairs.push({
            clientId: process.env.FFLOGS_CLIENT_ID,
            clientSecret: process.env.FFLOGS_CLIENT_SECRET,
        });
    }

    // 追加キー（2〜10まで対応）
    for (let i = 2; i <= 10; i++) {
        const id = process.env[`FFLOGS_CLIENT_ID_${i}`];
        const secret = process.env[`FFLOGS_CLIENT_SECRET_${i}`];
        if (id && secret) {
            pairs.push({ clientId: id, clientSecret: secret });
        }
    }

    return pairs;
}

// ラウンドロビン用カウンター（Edge Functionのインスタンス内で保持）
let roundRobinIndex = 0;

export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const pairs = getCredentialPairs();

    if (pairs.length === 0) {
        return new Response(
            JSON.stringify({ error: 'FFLogs API credentials are not configured on the server.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }

    // ラウンドロビンで次のキーを選択
    const selected = pairs[roundRobinIndex % pairs.length];
    roundRobinIndex = (roundRobinIndex + 1) % pairs.length;

    try {
        const tokenResponse = await fetch('https://www.fflogs.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: selected.clientId,
                client_secret: selected.clientSecret,
            }),
        });

        if (!tokenResponse.ok) {
            const body = await tokenResponse.text();
            return new Response(
                JSON.stringify({ error: `FFLogs token request failed (${tokenResponse.status})`, details: body }),
                { status: tokenResponse.status, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const data = await tokenResponse.json();

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: String(err) }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}
