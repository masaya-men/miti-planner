/**
 * Vercel Serverless Function — Discord OAuth2 → Firebase Custom Token
 *
 * フロー:
 *   1. クライアントがDiscord認証ページにリダイレクト（CSRF対策のstateパラメータ付き）
 *   2. Discordが認証コードをこのエンドポイントに返す
 *   3. state検証 → コードをDiscordトークンに交換
 *   4. Discordユーザー情報を取得
 *   5. Firebase Admin SDKでカスタムトークンを生成
 *   6. クライアントにトークンを返す（HTMLでlocalStorage経由）
 *
 * 必要な環境変数:
 *   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET,
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as crypto from 'crypto';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify.js';

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
    // CORS
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // HTTPメソッド制限（GETのみ — OAuth認証フロー）
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code, state } = req.query;

        // App Check検証（ステップ1のみ — コールバック時は外部リダイレクトのためヘッダー付与不可）
        // コールバックはstate+cookie検証でCSRF保護済み
        if (!code) {
            if (!(await verifyAppCheck(req, res))) return;
            // ステップ1: state生成 → cookie保存 → Discord認証ページにリダイレクト
            const clientId = process.env.DISCORD_CLIENT_ID;
            if (!clientId) {
                return res.status(500).json({ error: 'Server configuration error' });
            }
            const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/discord`;
            const stateParam = crypto.randomBytes(16).toString('hex');

            // stateをHttpOnly cookieに保存（5分有効）
            res.setHeader('Set-Cookie',
                `discord_oauth_state=${stateParam}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/discord; Max-Age=300`
            );

            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: 'identify',
                state: stateParam,
            });
            return res.redirect(`https://discord.com/oauth2/authorize?${params}`);
        }

        // ステップ2: コールバック — state検証（CSRF保護）
        const cookies = parseCookies(req.headers.cookie || '');
        const savedState = cookies['discord_oauth_state'];

        if (!savedState || state !== savedState) {
            return res.status(400).json({ error: 'State mismatch. Please try again.' });
        }

        // cookieをクリア
        res.setHeader('Set-Cookie',
            'discord_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/discord; Max-Age=0'
        );

        // Firebase Admin 初期化
        initAdmin();

        const clientId = process.env.DISCORD_CLIENT_ID!;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
        const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/discord`;

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
