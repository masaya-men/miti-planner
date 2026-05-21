/**
 * GET /api/housing?action=list-notifications&limit=20
 *
 * ハウジング通知一覧ハンドラ
 * - 認証: Bearer (Firebase Web SDK の現在ユーザー idToken)
 * - users/{uid}/notifications を createdAt 降順で最大 limit 件返す (limit は最大 50)
 * - 主に管理画面 / フルページ通知一覧の取得経路 (リアルタイム購読は Web SDK で別途)
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 60, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const limit = Math.min(Number(req.query?.limit) || 20, 50);
    const adminDb = getAdminFirestore();
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json({ items });
  } catch (error: any) {
    console.error('[housing/list-notifications] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
