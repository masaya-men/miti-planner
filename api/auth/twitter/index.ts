/**
 * Vercel Serverless Function — Twitter(X) OAuth 2.0 + PKCE → Firebase Custom Token
 *
 * フロー:
 *   1. クライアントがこのエンドポイントにアクセス
 *   2. code_verifier を生成し cookie に保存、Twitter 認証ページにリダイレクト
 *   3. Twitter がコールバックで code を返す
 *   4. cookie の code_verifier を使って code → アクセストークン交換
 *   5. Twitter ユーザー情報を取得
 *   6. Firebase Admin SDK でカスタムトークンを生成
 *   7. クライアントにトークンを返す（HTML で postMessage 経由）
 *
 * 必要な環境変数:
 *   TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET,
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as crypto from 'crypto';

const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

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
const TWITTER_USER_URL = 'https://api.twitter.com/2/users/me';

/** PKCE 用: ランダムな code_verifier を生成（43〜128文字の URL-safe 文字列） */
function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}

/** PKCE 用: code_verifier から code_challenge を生成（S256） */
function generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export default async function handler(req: any, res: any) {
    try {
        const { code, state } = req.query;
        const clientId = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return res.status(500).json({ error: 'Twitter OAuth credentials not configured' });
        }

        const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/twitter`;

        if (!code) {
            // ステップ1: code_verifier 生成 → cookie 保存 → Twitter 認証ページにリダイレクト
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = generateCodeChallenge(codeVerifier);
            const stateParam = crypto.randomBytes(16).toString('hex');

            // code_verifier を HttpOnly cookie に保存（5分有効）
            res.setHeader('Set-Cookie', [
                `twitter_code_verifier=${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/twitter; Max-Age=300`,
                `twitter_oauth_state=${stateParam}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/twitter; Max-Age=300`,
            ]);

            const params = new URLSearchParams({
                response_type: 'code',
                client_id: clientId,
                redirect_uri: redirectUri,
                scope: 'users.read',
                state: stateParam,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
            });

            return res.redirect(`${TWITTER_AUTH_URL}?${params}`);
        }

        // ステップ2: コールバック処理
        // cookie から code_verifier と state を取得
        const cookies = parseCookies(req.headers.cookie || '');
        const codeVerifier = cookies['twitter_code_verifier'];
        const savedState = cookies['twitter_oauth_state'];

        if (!codeVerifier) {
            return res.status(400).json({ error: 'Missing code_verifier cookie. Please try again.' });
        }

        if (state !== savedState) {
            return res.status(400).json({ error: 'State mismatch. Please try again.' });
        }

        // cookie をクリア
        res.setHeader('Set-Cookie', [
            'twitter_code_verifier=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/twitter; Max-Age=0',
            'twitter_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/twitter; Max-Age=0',
        ]);

        // Firebase Admin 初期化
        initAdmin();

        // ステップ3: code → アクセストークン交換
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenRes = await fetch(TWITTER_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code as string,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            return res.status(400).json({ error: 'Twitter token exchange failed', details: err });
        }

        const { access_token } = await tokenRes.json();

        // ステップ4: Twitter ユーザー情報取得
        const userRes = await fetch(`${TWITTER_USER_URL}?user.fields=profile_image_url,name,username`, {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        if (!userRes.ok) {
            return res.status(400).json({ error: 'Failed to fetch Twitter user' });
        }

        const { data: twitterUser } = await userRes.json();

        // ステップ5: Firebase カスタムトークン生成
        const firebaseUid = `twitter:${twitterUser.id}`;
        const customToken = await getAuth().createCustomToken(firebaseUid, {
            provider: 'twitter',
            twitterId: twitterUser.id,
            username: twitterUser.username,
            avatar: twitterUser.profile_image_url || null,
        });

        // ステップ6: クライアントにトークンを返す（ポップアップ → 親ウィンドウに postMessage）
        const displayName = twitterUser.name || twitterUser.username;
        const photoURL = twitterUser.profile_image_url || null;

        res.setHeader('Content-Type', 'text/html');
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>LoPo - Twitter Login</title></head>
            <body>
                <script>
                    window.opener.postMessage(
                        {
                            type: 'twitter-auth',
                            token: '${customToken}',
                            displayName: ${JSON.stringify(displayName)},
                            photoURL: ${JSON.stringify(photoURL)}
                        },
                        window.location.origin
                    );
                    window.close();
                </script>
                <p>ログイン中...</p>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Twitter auth error:', err);
        return res.status(500).json({
            error: 'Internal server error',
            details: String(err),
        });
    }
}

/** Cookie ヘッダーをパースしてオブジェクトに変換 */
function parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    for (const pair of cookieHeader.split(';')) {
        const [key, ...rest] = pair.trim().split('=');
        if (key) cookies[key] = rest.join('=');
    }
    return cookies;
}
