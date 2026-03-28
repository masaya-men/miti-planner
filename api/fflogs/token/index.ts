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

import { verifyAppCheck } from '../../../src/lib/appCheckVerify.js';

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

// ラウンドロビン用カウンター（Serverless Functionのインスタンス内で保持）
let roundRobinIndex = 0;

export default async function handler(req: any, res: any) {
    // CORS
    const origin = req.headers?.origin || '';
    const allowedOrigins = [
        'https://lopoly.app',
        'https://lopo-miti.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
    ];
    const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // App Check検証
    if (!(await verifyAppCheck(req, res))) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const pairs = getCredentialPairs();

    if (pairs.length === 0) {
        return res.status(500).json({ error: 'FFLogs API credentials are not configured on the server.' });
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
            return res.status(tokenResponse.status).json({
                error: `FFLogs token request failed (${tokenResponse.status})`,
                details: body,
            });
        }

        const data = await tokenResponse.json();

        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({
            error: 'Internal server error',
            details: String(err),
        });
    }
}
