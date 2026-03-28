/**
 * Vercel Serverless Function — Discord OAuth2 → Firebase Custom Token
 *
 * フロー:
 *   1. クライアントがDiscord認証ページにリダイレクト
 *   2. Discordが認証コードをこのエンドポイントに返す
 *   3. コードをDiscordトークンに交換
 *   4. Discordユーザー情報を取得
 *   5. Firebase Admin SDKでカスタムトークンを生成
 *   6. クライアントにトークンを返す（HTMLでpostMessage経由）
 *
 * 必要な環境変数:
 *   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET,
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify';

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

export default async function handler(req: any, res: any) {
    // CORS
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // App Check検証
    if (!(await verifyAppCheck(req, res))) return;

    try {
        const { code } = req.query;

        if (!code) {
            // ステップ1: Discord認証ページにリダイレクト
            const clientId = process.env.DISCORD_CLIENT_ID;
            if (!clientId) {
                return res.status(500).json({ error: 'DISCORD_CLIENT_ID not configured' });
            }
            const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/discord`;
            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: 'identify',
            });
            return res.redirect(`https://discord.com/oauth2/authorize?${params}`);
        }

        // Firebase Admin 初期化
        initAdmin();

        const clientId = process.env.DISCORD_CLIENT_ID!;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
        const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/discord`;

        // ステップ2: コード → Discordトークン交換
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
            const err = await tokenRes.text();
            return res.status(400).json({ error: 'Discord token exchange failed', details: err });
        }

        const { access_token } = await tokenRes.json();

        // ステップ3: Discordユーザー情報取得
        const userRes = await fetch(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        if (!userRes.ok) {
            return res.status(400).json({ error: 'Failed to fetch Discord user' });
        }

        const discordUser = await userRes.json();

        // ステップ4: Firebase カスタムトークン生成
        const firebaseUid = `discord:${discordUser.id}`;
        const customToken = await getAuth().createCustomToken(firebaseUid, {
            provider: 'discord',
            discordId: discordUser.id,
            avatar: discordUser.avatar
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : null,
        });

        // ステップ5: トークンをlocalStorageに保存してアプリにリダイレクト
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
                        token: '${customToken}',
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
        return res.status(500).json({
            error: 'Internal server error',
            details: String(err),
        });
    }
}
