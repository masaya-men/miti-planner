/**
 * 運営通知 (system_notifications) の公開読みハンドラー。
 * GET /api/template?action=public-notifications → { items: SystemNotification[] }
 *
 * - Admin SDK 経由の窓口読み (P1-M: Firestore Rules の直読みから移行する準備)。
 * - 匿名可・App Check 検証しない (公開データの GET のみ、書き込み無し)。
 * - Cache-Control: public, s-maxage=60, max-age=30 (Cloudflare 前段でのキャッシュを想定)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { rejectIfPublicApiDisabled } from '../../src/lib/publicApiGuard.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (rejectIfPublicApiDisabled(res)) return;
  if (!(await applyRateLimit(req, res, 60, 60_000, { scope: 'public-notifications', globalMax: 600 }))) return;

  try {
    initAdmin();
    const db = getAdminFirestore();

    // published===true を createdAt desc。複合インデックス(published ASC, createdAt DESC)は登録済。
    const snap = await db.collection('system_notifications')
      .where('published', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    res.setHeader('Cache-Control', 'public, s-maxage=60, max-age=30');
    return res.status(200).json({ items });
  } catch (err: any) {
    console.error('[template/public-notifications] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
