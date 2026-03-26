/**
 * Vercel Serverless Function — 人気プランAPI
 *
 * GET  /api/popular?contentIds=m9s,m10s,...  — コンテンツごとに上位2プランを取得
 * POST /api/popular  { shareId }             — copyCount を1増加
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'shared_plans';

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
    const origin = req.headers?.origin || '';
    const allowedOrigins = [
        'https://lopoly.app',
        'https://lopo-miti.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
    ];
    const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        initAdmin();
        const db = getFirestore();

        if (req.method === 'GET') {
            // ── 人気プラン取得 ──
            const { contentIds } = req.query;
            if (!contentIds) {
                return res.status(400).json({ error: 'contentIds is required' });
            }

            const ids: string[] = (contentIds as string).split(',').map(s => s.trim()).filter(Boolean);
            if (ids.length === 0) {
                return res.status(400).json({ error: 'contentIds is empty' });
            }

            // 各コンテンツIDについて上位2件を並列取得
            const results = await Promise.all(
                ids.map(async (id) => {
                    const snap = await db
                        .collection(COLLECTION)
                        .where('contentId', '==', id)
                        .orderBy('copyCount', 'desc')
                        .limit(2)
                        .get();

                    const plans = snap.docs.map(doc => {
                        const data = doc.data();
                        // 必要なフィールドのみ返す
                        const partyMembers = data.planData?.partyMembers?.map((m: any) => ({
                            id: m.id,
                            jobId: m.jobId,
                            role: m.role,
                        })) ?? [];
                        return {
                            shareId: data.shareId,
                            title: data.title ?? '',
                            contentId: data.contentId,
                            copyCount: data.copyCount ?? 0,
                            createdAt: data.createdAt,
                            partyMembers,
                        };
                    });

                    return { contentId: id, plans };
                })
            );

            // キャッシュヘッダー設定
            res.setHeader('Cache-Control', 'public, s-maxage=900, max-age=300');
            return res.status(200).json({ results });

        } else if (req.method === 'POST') {
            // ── コピーカウント増加 ──
            const { shareId } = req.body;
            if (!shareId) {
                return res.status(400).json({ error: 'shareId is required' });
            }

            const docRef = db.collection(COLLECTION).doc(shareId as string);
            const snap = await docRef.get();
            if (!snap.exists) {
                return res.status(404).json({ error: 'not found' });
            }

            await docRef.update({
                copyCount: FieldValue.increment(1),
            });

            return res.status(200).json({ ok: true });

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (err: any) {
        console.error('Popular API error:', err);
        return res.status(500).json({ error: 'Internal server error', details: String(err) });
    }
}
