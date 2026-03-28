/**
 * マスターコンフィグ管理API
 * GET  /api/admin/config — 現在の設定取得
 * PUT  /api/admin/config — 設定更新
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../../src/lib/adminAuth.js';
import { writeAuditLog } from '../../../src/lib/auditLog.js';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../../src/lib/rateLimit.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = ['https://lopoly.app', 'https://lopo-miti.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!(await verifyAppCheck(req, res))) return;
  if (!applyRateLimit(req, res, 30, 60_000)) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(403).json({ error: 'Unauthorized' });

    const db = getAdminFirestore();
    const configRef = db.doc('master/config');

    if (req.method === 'GET') {
      const snap = await configRef.get();
      return res.status(200).json(snap.exists ? snap.data() : {});
    }

    if (req.method === 'PUT') {
      const updates = req.body || {};
      const allowed = ['promotionThreshold', 'promotionMultiplier', 'featureFlags'];
      const filtered: Record<string, any> = {};
      for (const key of allowed) {
        if (updates[key] !== undefined) filtered[key] = updates[key];
      }
      if (Object.keys(filtered).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const before = (await configRef.get()).data() || {};
      await configRef.set(filtered, { merge: true });
      await writeAuditLog({ action: 'update', target: 'config', adminUid, changes: { before, after: filtered } });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[admin/config] エラー:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
