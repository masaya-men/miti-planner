/**
 * POST /api/housing?action=update-visibility
 *
 * マイページ一覧からのワンクリック公開状態切替 (update-listing の軽量版・住所や画像は変更しない)。
 * 認可: ownerUid 一致のみ
 * Body: { listingId, visibility }
 * 動作: housing_listings/{id}.visibility を更新。unlisted/private への切替時は
 *   publishUntil を null に強制する (update-listing §8.2 と同じ方針)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { bumpPublicVersionTx } from './_publicVersion.js';

const VALID_VISIBILITY = new Set(['public', 'unlisted', 'private']);

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

    const { listingId, visibility } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }
    if (typeof visibility !== 'string' || !VALID_VISIBILITY.has(visibility)) {
      return res.status(400).json({ error: 'invalid_visibility' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('not_found');

      const updatePayload: Record<string, unknown> = {
        visibility,
        updatedAt: Date.now(),
      };
      // 住所非公開2種 (unlisted/private) では公開期限を持たせない (update-listing と同じ方針)。
      if (visibility === 'unlisted' || visibility === 'private') {
        updatePayload.publishUntil = null;
      }

      tx.update(listingRef, updatePayload);
      bumpPublicVersionTx(tx, adminDb);
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    console.error('[housing/update-visibility] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
