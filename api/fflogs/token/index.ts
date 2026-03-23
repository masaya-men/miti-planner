/**
 * Vercel Serverless Function — FFLogs OAuth2 Token Proxy
 *
 * Keeps the client_secret server-side so it is never exposed in the browser bundle.
 * Frontend calls POST /api/fflogs/token and receives { access_token, expires_in }.
 *
 * Required Vercel environment variables:
 *   FFLOGS_CLIENT_ID     — FFLogs API client ID
 *   FFLOGS_CLIENT_SECRET — FFLogs API client secret
 */

export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
    // Only allow POST
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const clientId = process.env.FFLOGS_CLIENT_ID;
    const clientSecret = process.env.FFLOGS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return new Response(
            JSON.stringify({ error: 'FFLogs API credentials are not configured on the server.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }

    try {
        const tokenResponse = await fetch('https://www.fflogs.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
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
