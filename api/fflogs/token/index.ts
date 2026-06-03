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
import { fetchTokenWithFailover } from '../../../src/lib/fflogsTokenFailover.js';

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
    const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/.test(origin);
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

    // ラウンドロビンの開始位置から順に試し、最初に成功したキーのトークンを返す。
    // 1 本が失効/レート制限/一時障害でも残りの正常なキーで取得できる (冗長化を実機能させる)。
    const result = await fetchTokenWithFailover(
        pairs,
        roundRobinIndex,
        fetch,
        (index, status, body) =>
            console.error(`FFLogs token request failed (key #${index}):`, status, body),
    );

    // 次回は「成功したキーの次」から開始 (死んだキーを毎回先頭で引かない + 負荷分散)。
    roundRobinIndex = result
        ? (result.usedIndex + 1) % pairs.length
        : (roundRobinIndex + 1) % pairs.length;

    if (!result) {
        // 全キーが失敗した場合のみ 502。
        return res.status(502).json({ error: 'FFLogs token request failed (all keys failed)' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(result.token);
}
