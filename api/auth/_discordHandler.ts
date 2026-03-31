/**
 * Discord OAuth2 → Firebase Custom Token ハンドラー
 *
 * フロー:
 *   1. POST: App Checkトークン付きリクエスト → リダイレクトURLを返却
 *   2. GET: Discordからのコールバック → トークン交換 → Firebase Custom Token生成
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as crypto from 'crypto';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';

const DISCORD_API = 'https://discord.com/api/v10';

function initAdmin() {
    if (!getApps().length) {
        let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
        if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch {} }
        pk = pk.replace(/\\n/g, '\n');
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID!,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
                privateKey: pk,
            }),
        });
    }
}

/** Cookieヘッダーをパースしてオブジェクトに変換 */
function parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    for (const pair of cookieHeader.split(';')) {
        const [key, ...rest] = pair.trim().split('=');
        if (key) cookies[key] = rest.join('=');
    }
    return cookies;
}

export default async function handler(req: any, res: any) {
    // CORS（同一オリジンからのPOSTリクエストに対応）
    const origin = req.headers?.origin || '';
    const allowedOrigins = [
        'https://lopoly.app',
        'https://lopo-miti.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
    ];
    const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/.test(origin);
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // HTTPメソッド制限（POST=ステップ1開始、GET=ステップ2コールバック）
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'OPTIONS') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // ステップ1: POST — フロントエンドからApp Checkトークン付きで呼び出し
        if (req.method === 'POST') {
            if (!(await verifyAppCheck(req, res))) return;

            const clientId = process.env.DISCORD_CLIENT_ID;
            if (!clientId) {
                return res.status(500).json({ error: 'Server configuration error' });
            }
            // コールバックURLは統合後のエンドポイント
            const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth?provider=discord`;
            const stateParam = crypto.randomBytes(16).toString('hex');

            // stateをHttpOnly cookieに保存（5分有効）— パスは統合後の /api/auth
            res.setHeader('Set-Cookie',
                `discord_oauth_state=${stateParam}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=300`
            );

            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: 'identify',
                state: stateParam,
            });
            return res.status(200).json({ url: `https://discord.com/oauth2/authorize?${params}` });
        }

        // ステップ2: GET — Discordからのコールバック（外部リダイレクトのためApp Checkスキップ）
        const { code, state } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Missing authorization code' });
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const savedState = cookies['discord_oauth_state'];

        if (!savedState || state !== savedState) {
            return res.status(400).json({ error: 'State mismatch. Please try again.' });
        }

        // cookieをクリア
        res.setHeader('Set-Cookie',
            'discord_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0'
        );

        // Firebase Admin 初期化
        initAdmin();

        const clientId = process.env.DISCORD_CLIENT_ID!;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
        const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth?provider=discord`;

        // ステップ3: コード → Discordトークン交換
        const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: code as string,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenRes.ok) {
            console.error('Discord token exchange failed:', await tokenRes.text());
            return res.status(400).json({ error: 'Discord token exchange failed' });
        }

        const { access_token } = await tokenRes.json();

        // ステップ4: Discordユーザー情報取得
        const userRes = await fetch(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        if (!userRes.ok) {
            return res.status(400).json({ error: 'Failed to fetch Discord user' });
        }

        const discordUser = await userRes.json();

        // ステップ5: Firebase カスタムトークン生成
        const firebaseUid = `discord:${discordUser.id}`;
        const customToken = await getAuth().createCustomToken(firebaseUid, {
            provider: 'discord',
            discordId: discordUser.id,
            avatar: discordUser.avatar
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : null,
        });

        // ステップ6: トークンをlocalStorageに保存してアプリにリダイレクト
        const displayName = discordUser.global_name || discordUser.username;
        const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null;

        res.setHeader('Content-Type', 'text/html');
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>LoPo - Discord Login</title></head>
            <body>
                <script>
                    localStorage.setItem('lopo_auth_pending', JSON.stringify({
                        provider: 'discord',
                        token: ${JSON.stringify(customToken)},
                        displayName: ${JSON.stringify(displayName)},
                        photoURL: ${JSON.stringify(avatarUrl)}
                    }));
                    var returnUrl = localStorage.getItem('lopo_auth_return_url') || '/';
                    localStorage.removeItem('lopo_auth_return_url');
                    try {
                        var u = new URL(returnUrl, window.location.origin);
                        if (u.origin !== window.location.origin) returnUrl = '/';
                    } catch(e) { returnUrl = '/'; }
                    window.location.href = returnUrl;
                </script>
                <p>ログイン中...</p>
            </body>
            </html>
        `);
    } catch (err: any) {
        console.error('Discord auth error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
