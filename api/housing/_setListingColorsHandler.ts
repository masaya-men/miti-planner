/**
 * POST /api/housing?action=set-listing-colors
 *
 * 色で探す (2026-11-12): 家の代表の写真から利用者のブラウザで計算した色を保存する。
 * 認可: ownerUid 一致のみ
 * Body: { listingId, colorFamilies: string[], colorRule: number }
 * 検証: 13 系統の許可リスト・最大 3 件・重複なし・colorRule が現行値 (validateListingColors)
 * 動作: housing_listings/{id} に colorFamilies / colorRule を保存し、版を進めて差分に積む。
 *   - 削除済みは 404 / 他人の家は 403 / 値が不正なら 400
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { bumpPublicVersionTx } from './_publicVersion.js';
import { validatedColorFields } from './_colorFields.js';
import type { HousingReq, HousingRes } from './_httpTypes.js';
import { setCors } from '../_lib/setCors.js';

export default async function handler(req: HousingReq, res: HousingRes) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

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
    const colors = validatedColorFields(req.body);
    if (!colors) return res.status(400).json({ error: 'invalid_colors' });

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('not_found');
      tx.update(listingRef, { ...colors, updatedAt: Date.now() });
      bumpPublicVersionTx(tx, adminDb);
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    console.error('[housing/set-listing-colors] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
