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

            // === link mode 判定: Authorization Bearer の Firebase ID Token から primaryUid を確定 ===
            const isLinkMode = req.query?.mode === 'link';
            let primaryUid: string | null = null;

            if (isLinkMode) {
                const authHeader = req.headers.authorization;
                if (!authHeader?.startsWith('Bearer ')) {
                    return res.status(401).json({ error: 'Missing Firebase ID token for link mode' });
                }
                initAdmin();
                try {
                    const { getAuth } = await import('firebase-admin/auth');
                    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
                    primaryUid = decoded.uid;
                } catch {
                    return res.status(401).json({ error: 'Invalid Firebase ID token' });
                }
            }

            const clientId = process.env.DISCORD_CLIENT_ID;
            if (!clientId) {
                return res.status(500).json({ error: 'Server configuration error' });
            }
            // コールバックURLは統合後のエンドポイント
            const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth?provider=discord`;
            const stateParam = crypto.randomBytes(16).toString('hex');

            // link mode の場合は cookie 値に primaryUid を埋め込む (callback で取り出す)
            const cookieValue = isLinkMode ? `link:${primaryUid}:${stateParam}` : stateParam;

            // stateをHttpOnly cookieに保存（5分有効）— パスは統合後の /api/auth
            res.setHeader('Set-Cookie',
                `discord_oauth_state=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=300`
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

        // link mode 判定 (cookie 値が link:<primaryUid>:<stateParam> 形式)
        let linkPrimaryUid: string | null = null;
        let expectedState: string;
        if (savedState?.startsWith('link:')) {
            // primaryUid 自体に ':' を含む (例: discord:D1) ため、 最後の要素を stateParam として扱う
            const parts = savedState.split(':');
            expectedState = parts[parts.length - 1];
            linkPrimaryUid = parts.slice(1, -1).join(':');
        } else {
            expectedState = savedState || '';
        }

        if (!savedState || state !== expectedState) {
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

        // idのみ取り出し、他の個人情報は即破棄
        const { id: discordUserId } = await userRes.json();

        const candidateUid = `discord:${discordUserId}`;

        // === link mode の callback ===
        if (linkPrimaryUid) {
            // 自分自身に紐づけようとした (同一 provider 同一 ID) → 拒否
            if (candidateUid === linkPrimaryUid) {
                return sendLinkErrorPage(res, 'cannot_link_self');
            }

            // 既に他人に紐づけられているかチェック (乗っ取り防止)
            const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
            const linkRef = getFirestore().doc(`account_links/${candidateUid}`);
            const existing = await linkRef.get();
            if (existing.exists && existing.data()!.primaryUid !== linkPrimaryUid) {
                return sendLinkErrorPage(res, 'already_linked_to_another');
            }

            // primaryUid に紐付け書き込み
            await linkRef.set({
                primaryUid: linkPrimaryUid,
                linkedAt: FieldValue.serverTimestamp(),
            });

            // 完了画面 → return_url にリダイレクト
            return sendLinkCompletePage(res, 'discord');
        }

        // === 通常ログイン: account_links に紐付けがあれば primaryUid を使う ===
        const { getFirestore: getFs } = await import('firebase-admin/firestore');
        const linkDoc = await getFs().doc(`account_links/${candidateUid}`).get();
        const finalUid = linkDoc.exists ? linkDoc.data()!.primaryUid : candidateUid;

        // ステップ5: Firebase カスタムトークン生成
        const customToken = await getAuth().createCustomToken(finalUid, {
            provider: 'discord',
        });
        // ↑ discordId, avatar を Custom Claims から削除

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
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/** 連携完了画面 → return_url にリダイレクト + localStorage に完了通知を書く */
function sendLinkCompletePage(res: any, provider: 'discord' | 'twitter'): any {
    res.setHeader('Content-Type', 'text/html');
    return res.send(`
<!DOCTYPE html>
<html>
<head><title>LoPo - 連携完了</title></head>
<body>
    <script>
        localStorage.setItem('lopo_link_completed', JSON.stringify({ provider: ${JSON.stringify(provider)} }));
        var returnUrl = localStorage.getItem('lopo_auth_return_url') || '/';
        localStorage.removeItem('lopo_auth_return_url');
        try {
            var u = new URL(returnUrl, window.location.origin);
            if (u.origin !== window.location.origin) returnUrl = '/';
        } catch(e) { returnUrl = '/'; }
        window.location.href = returnUrl;
    </script>
    <p>連携完了... リダイレクトしています</p>
</body>
</html>
    `);
}

/** 連携エラー画面 → return_url にリダイレクト + localStorage にエラーコードを書く */
function sendLinkErrorPage(res: any, errorCode: string): any {
    res.setHeader('Content-Type', 'text/html');
    return res.send(`
<!DOCTYPE html>
<html>
<head><title>LoPo - 連携エラー</title></head>
<body>
    <script>
        localStorage.setItem('lopo_link_error', ${JSON.stringify(errorCode)});
        var returnUrl = localStorage.getItem('lopo_auth_return_url') || '/';
        localStorage.removeItem('lopo_auth_return_url');
        try {
            var u = new URL(returnUrl, window.location.origin);
            if (u.origin !== window.location.origin) returnUrl = '/';
        } catch(e) { returnUrl = '/'; }
        window.location.href = returnUrl;
    </script>
    <p>連携エラー... リダイレクトしています</p>
</body>
</html>
    `);
}
