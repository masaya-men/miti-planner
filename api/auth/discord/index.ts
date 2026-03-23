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

import * as admin from 'firebase-admin';
import { initAdmin } from '../_initAdmin';

const DISCORD_API = 'https://discord.com/api/v10';

export default async function handler(req: any, res: any) {
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
        const customToken = await admin.auth().createCustomToken(firebaseUid, {
            provider: 'discord',
            discordId: discordUser.id,
            avatar: discordUser.avatar
                ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                : null,
        });

        // ステップ5: クライアントにトークンを返す（ポップアップ → 親ウィンドウにpostMessage）
        res.setHeader('Content-Type', 'text/html');
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>LoPo - Discord Login</title></head>
            <body>
                <script>
                    window.opener.postMessage(
                        { type: 'discord-auth', token: '${customToken}' },
                        window.location.origin
                    );
                    window.close();
                </script>
                <p>ログイン中...</p>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Discord auth error:', err);
        return res.status(500).json({
            error: 'Internal server error',
            details: String(err),
        });
    }
}
