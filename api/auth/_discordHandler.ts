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
import { hashUid } from '../_lib/hashUid.js';

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

/**
 * OAuth失敗時(キャンセル/state不一致/トークン交換失敗等)に、SPAの元いた画面へ戻すHTML。
 * このエンドポイントはDiscordからのトップレベル遷移でしか呼ばれないため、失敗時に生JSONを
 * 返すと「ログイン状態は変えず、素の画面に戻る」体験にならずブラウザにJSONがそのまま表示されてしまう
 * (実機指摘・2026-08-12)。成功時(ステップ6)と同じ returnUrl 読み出し/検証ロジックを踏襲するが、
 * lopo_auth_pending は書かない(ログインは成立していないため)。
 */
function sendAuthFailureRedirect(res: any): void {
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head><title>LoPo</title></head>
        <body>
            <script>
                var returnUrl = localStorage.getItem('lopo_auth_return_url') || '/';
                localStorage.removeItem('lopo_auth_return_url');
                try {
                    var u = new URL(returnUrl, window.location.origin);
                    if (u.origin !== window.location.origin) returnUrl = '/';
                } catch(e) { returnUrl = '/'; }
                window.location.href = returnUrl;
            </script>
        </body>
        </html>
    `);
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
            // ユーザーがDiscordの認可画面でキャンセルした場合もここに来る(code無し・error=access_denied付き)。
            // stateクッキーは使われないまま残っても実害は小さいが(5分で自然失効)、ついでに片付ける。
            res.setHeader('Set-Cookie',
                'discord_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0'
            );
            return sendAuthFailureRedirect(res);
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const savedState = cookies['discord_oauth_state'];

        if (!savedState || state !== savedState) {
            res.setHeader('Set-Cookie',
                'discord_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0'
            );
            return sendAuthFailureRedirect(res);
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
            return sendAuthFailureRedirect(res);
        }

        const { access_token } = await tokenRes.json();

        // ステップ4: Discordユーザー情報取得
        const userRes = await fetch(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        if (!userRes.ok) {
            console.error('Discord user fetch failed:', userRes.status);
            return sendAuthFailureRedirect(res);
        }

        // idのみ取り出し、他の個人情報は即破棄
        const { id: discordUserId } = await userRes.json();

        // ステップ5: Firebase カスタムトークン生成 (hash 化済、 元 Discord ID は LoPo 内部からも復元不能)
        const secret = process.env.LOPO_PSEUDONYM_SECRET;
        if (!secret) {
            console.error('LOPO_PSEUDONYM_SECRET 未設定');
            return sendAuthFailureRedirect(res);
        }
        const firebaseUid = hashUid(discordUserId, secret);
        const customToken = await getAuth().createCustomToken(firebaseUid, {
            provider: 'discord',
        });

        // ステップ6: トークンをlocalStorageに保存してアプリにリダイレクト
        res.setHeader('Content-Type', 'text/html');
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>LoPo - Discord Login</title></head>
            <body>
                <script>
                    localStorage.setItem('lopo_auth_pending', JSON.stringify({
                        provider: 'discord',
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
    } catch (err: any) {
        console.error('Discord auth error:', err);
        // GET(Discordからのトップレベル遷移)は生JSONを見せず元画面へ戻す。POSTはフロントの
        // fetch呼び出しが待っているため、従来どおりJSONで返す(フロント側のエラーハンドリングを維持)。
        if (req.method === 'GET') return sendAuthFailureRedirect(res);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
