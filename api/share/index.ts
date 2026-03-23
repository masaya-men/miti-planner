/**
 * Vercel Serverless Function — 軽減プラン共有API
 *
 * POST /api/share  — プランをFirestoreに保存し、短縮IDを返す
 * GET  /api/share?id=xxx — 短縮IDからプランデータを取得
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { nanoid } from 'nanoid';

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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        initAdmin();
        const db = getFirestore();

        if (req.method === 'POST') {
            // ── 保存 ──
            const { planData, title, contentId } = req.body;
            if (!planData) {
                return res.status(400).json({ error: 'planData is required' });
            }

            const shareId = nanoid(8);
            const doc = {
                shareId,
                title: title || '',
                contentId: contentId || null,
                planData,
                createdAt: Date.now(),
            };

            await db.collection(COLLECTION).doc(shareId).set(doc);

            return res.status(200).json({ shareId });

        } else if (req.method === 'GET') {
            // ── 取得 ──
            const { id } = req.query;
            if (!id) {
                return res.status(400).json({ error: 'id is required' });
            }

            const snap = await db.collection(COLLECTION).doc(id as string).get();
            if (!snap.exists) {
                return res.status(404).json({ error: 'not found' });
            }

            return res.status(200).json(snap.data());

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (err: any) {
        console.error('Share API error:', err);
        return res.status(500).json({ error: 'Internal server error', details: String(err) });
    }
}
