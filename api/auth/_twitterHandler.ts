/**
 * Twitter(X) OAuth 2.0 + PKCE → Firebase Custom Token ハンドラー
 *
 * フロー:
 *   1. POST: App Checkトークン付きリクエスト → リダイレクトURLを返却
 *   2. GET: Twitterからのコールバック → PKCE交換 → Firebase Custom Token生成
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as crypto from 'crypto';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';

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

/** PKCE 用: ランダムな code_verifier を生成 */
function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}

/** PKCE 用: code_verifier から code_challenge を生成（S256） */
function generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
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

export default async function handler(req: any, res: any) {
    // CORS（フロントエンドからのPOSTリクエストに対応）
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

    // POST=ステップ1（OAuth開始、App Check保護）、GET=ステップ2（コールバック）
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'OPTIONS') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const clientId = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return res.status(500).json({ error: 'Twitter OAuth credentials not configured' });
        }

        // コールバックURLは統合後のエンドポイント
        const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth?provider=twitter`;

        // ── ステップ1: POST — フロントエンドからApp Checkトークン付きで呼び出し ──
        if (req.method === 'POST') {
            if (!(await verifyAppCheck(req, res))) return;

            const codeVerifier = generateCodeVerifier();
            const codeChallenge = generateCodeChallenge(codeVerifier);
            const stateParam = crypto.randomBytes(16).toString('hex');

            // code_verifier を HttpOnly cookie に保存（5分有効）— パスは統合後の /api/auth
            res.setHeader('Set-Cookie', [
                `twitter_code_verifier=${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=300`,
                `twitter_oauth_state=${stateParam}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=300`,
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

            return res.status(200).json({ url: `${TWITTER_AUTH_URL}?${params}` });
        }

        // ── ステップ2: GET — Twitterからのコールバック ──
        const { code, state } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Missing authorization code' });
        }

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
            'twitter_code_verifier=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0',
            'twitter_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0',
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
            console.error('Twitter token exchange failed:', await tokenRes.text());
            return res.status(400).json({ error: 'Twitter token exchange failed' });
        }

        const { access_token } = await tokenRes.json();

        // ステップ4: Twitter ユーザーID取得（displayName/photoURLは取得しない）
        let twitterUserId: string;

        try {
            const userRes = await fetch(TWITTER_USER_URL, {
                headers: { Authorization: `Bearer ${access_token}` },
            });

            if (userRes.ok) {
                const { data } = await userRes.json();
                twitterUserId = data.id;
                // displayName, photoURL は取得しない
            } else {
                twitterUserId = crypto.createHash('sha256').update(access_token).digest('hex').slice(0, 16);
            }
        } catch {
            twitterUserId = crypto.createHash('sha256').update(access_token).digest('hex').slice(0, 16);
        }

        // ステップ5: Firebase カスタムトークン生成
        const firebaseUid = `twitter:${twitterUserId}`;
        const customToken = await getAuth().createCustomToken(firebaseUid, {
            provider: 'twitter',
        });

        res.setHeader('Content-Type', 'text/html');
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>LoPo - Twitter Login</title></head>
            <body>
                <script>
                    localStorage.setItem('lopo_auth_pending', JSON.stringify({
                        provider: 'twitter',
                        token: ${JSON.stringify(customToken)}
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
    } catch (err) {
        console.error('Twitter auth error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
