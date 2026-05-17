/**
 * 連携状態取得 (GET) + 連携解除 (POST) 統合エンドポイント
 *
 * GET  /api/auth/links              → { discord: boolean, twitter: boolean }
 * POST /api/auth/links  body: { provider: 'discord'|'twitter' }  → { ok: true, deletedCount: number }
 *
 * 両方とも Firebase ID Token + App Check 必須。
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';

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

function setCors(req: any, res: any) {
    const origin = req.headers?.origin || '';
    const allowedOrigins = [
        'https://lopoly.app',
        'https://lopo-miti.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
    ];
    const isAllowed = allowedOrigins.includes(origin)
        || /^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/.test(origin);
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

async function getUidFromIdToken(req: any): Promise<string | null> {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const idToken = auth.slice(7);
    initAdmin();
    try {
        const decoded = await getAuth().verifyIdToken(idToken);
        return decoded.uid;
    } catch {
        return null;
    }
}

export default async function handler(req: any, res: any) {
    setCors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    // 連携状態は変化頻度が高くキャッシュされると古い表示を招く (連携完了直後に古い未連携状態が表示される)
    // ETag 304 でブラウザが cached body を返さないよう、 全レスポンスで no-store を明示。
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    if (!(await verifyAppCheck(req, res))) return;

    const uid = await getUidFromIdToken(req);
    if (!uid) return res.status(401).json({ error: 'Invalid or missing ID token' });

    initAdmin();
    const db = getFirestore();

    if (req.method === 'GET') {
        // 現在 uid に紐づく account_links を逆引き
        const snapshot = await db.collection('account_links')
            .where('primaryUid', '==', uid)
            .get();

        const result = { discord: false, twitter: false };
        for (const doc of snapshot.docs) {
            if (doc.id.startsWith('discord:')) result.discord = true;
            if (doc.id.startsWith('twitter:')) result.twitter = true;
        }
        // 現在ログイン中のプロバイダも連携扱い
        if (uid.startsWith('discord:')) result.discord = true;
        if (uid.startsWith('twitter:')) result.twitter = true;

        return res.status(200).json(result);
    }

    if (req.method === 'POST') {
        let body: any;
        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch {
            return res.status(400).json({ error: 'Invalid JSON body' });
        }
        const { provider } = body || {};
        if (provider !== 'discord' && provider !== 'twitter') {
            return res.status(400).json({ error: 'Invalid provider' });
        }

        // 現在 uid のログイン経路と一致するプロバイダは解除拒否 (即ログアウト UX 不整合回避)
        if (uid.startsWith(`${provider}:`)) {
            return res.status(400).json({ error: 'Cannot unlink current login provider' });
        }

        // 該当プロバイダの account_links を削除
        const snapshot = await db.collection('account_links')
            .where('primaryUid', '==', uid)
            .get();

        let deletedCount = 0;
        for (const doc of snapshot.docs) {
            if (doc.id.startsWith(`${provider}:`)) {
                await doc.ref.delete();
                deletedCount++;
            }
        }

        return res.status(200).json({ ok: true, deletedCount });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
