/**
 * 管理ダッシュボード統計API
 * GET — ユーザー数・プラン数を返す
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';
import { setCors } from '../_lib/setCors.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setCors(req, res, { methods: 'GET, OPTIONS' });
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const db = getAdminFirestore();
    const [usersSnap, plansSnap] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('plans').count().get(),
    ]);

    return res.status(200).json({
      userCount: usersSnap.data().count,
      planCount: plansSnap.data().count,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message || 'Internal error' });
  }
}
