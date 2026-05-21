/**
 * POST /api/housing?action=mark-notification-read
 *
 * Body: { notificationId } または { all: true }
 *  - 認証: Bearer (Firebase Web SDK の現在ユーザー idToken)
 *  - notificationId 指定なら 1 件のみ既読化
 *  - all=true で未読 100 件まで batch 既読化
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 60, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { notificationId, all } = req.body || {};
    const adminDb = getAdminFirestore();
    const colRef = adminDb.collection('users').doc(uid).collection('notifications');

    if (all === true) {
      // 全件既読化 (batched、 一度に最大 100 件)
      const snap = await colRef.where('read', '==', false).limit(100).get();
      const batch = adminDb.batch();
      const now = Date.now();
      snap.docs.forEach((d) => batch.update(d.ref, { read: true, readAt: now }));
      await batch.commit();
      return res.status(200).json({ success: true, updated: snap.size });
    }

    if (!notificationId || typeof notificationId !== 'string') {
      return res.status(400).json({ error: 'invalid_notificationId' });
    }
    await colRef.doc(notificationId).update({ read: true, readAt: Date.now() });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[housing/mark-notification-read] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
