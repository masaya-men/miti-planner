/**
 * POST /api/housing?action=confirm-listing
 *
 * ハウジング「今もあります」 確認ハンドラ (2026-05-27 Phase 2-2 新設)
 * 認可: ownerUid 一致のみ
 * Body: { listingId }
 * 動作: housing_listings/{id}.lastConfirmedAt = Date.now() / .updatedAt = Date.now()
 *   - 既に soft delete 済み (deletedAt 有) の listing は 404 扱い
 *   - 既に hidden (isHidden=true) の listing は forbidden (= 通報で隠されてる物件を
 *     家主が「現役確認」 で復活させる経路は別途 resolve-report がある)
 *   - 連打防止に rate limit 20/分 (= delete-listing と同等)
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
  if (!(await applyRateLimit(req, res, 20, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    let lastConfirmedAt = 0;
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('not_found');
      if (data.isHidden) throw new Error('forbidden_hidden');

      const now = Date.now();
      tx.update(listingRef, {
        lastConfirmedAt: now,
        updatedAt: now,
      });
      lastConfirmedAt = now;
    });

    return res.status(200).json({ success: true, lastConfirmedAt });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    if (error?.message === 'forbidden_hidden') {
      return res.status(403).json({ error: 'forbidden_hidden' });
    }
    console.error('[housing/confirm-listing] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
