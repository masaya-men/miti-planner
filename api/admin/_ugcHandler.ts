/**
 * UGC管理API
 * GET  ?resource=ugc&shareId=xxx — 共有プランのメタ情報+ロゴ取得
 * DELETE ?resource=ugc&shareId=xxx — ロゴのみ削除
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'shared_plans';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(401).json({ error: 'Unauthorized' });

    const shareId = req.query?.shareId;
    if (!shareId || typeof shareId !== 'string') {
      return res.status(400).json({ error: 'shareId is required' });
    }

    const db = getAdminFirestore();
    const docRef = db.collection(COLLECTION).doc(shareId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: 'Shared plan not found' });
    }

    if (req.method === 'GET') {
      const data = snap.data()!;
      return res.status(200).json({
        shareId: data.shareId,
        title: data.title || '',
        contentId: data.contentId || null,
        createdAt: data.createdAt || null,
        type: data.type || 'single',
        hasLogo: !!data.logoBase64,
        logoBase64: data.logoBase64 || null,
      });

    } else if (req.method === 'DELETE') {
      await docRef.update({ logoBase64: FieldValue.delete() });
      return res.status(200).json({ success: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
