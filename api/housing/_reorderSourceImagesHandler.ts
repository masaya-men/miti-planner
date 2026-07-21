/**
 * POST /api/housing?action=reorder-source-images
 *
 * URL経由画像 (imageMode='sns') の並び順を変更する。sourceImageUrls と
 * 1:1対応の sourceImageAspectRatios も同じ順序に揃える (permutation を使う)。
 *
 * Body: { listingId: string, newOrder: string[] }
 * 認可: Firebase ID token (Bearer) + listing.ownerUid === uid
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { computeArrayReorder } from './_imageArrayLogic.js';
import { bumpPublicVersionTx } from './_publicVersion.js';

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
  if (!(await applyRateLimit(req, res, 20, 60_000, { scope: 'housing-reorder-source-images' }))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId, newOrder } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }
    if (!Array.isArray(newOrder) || !newOrder.every((u) => typeof u === 'string')) {
      return res.status(400).json({ error: 'invalid_newOrder' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('not_found');

      const current: string[] = Array.isArray(data.sourceImageUrls) ? data.sourceImageUrls : [];
      if (current.length === 0) {
        throw new Error('invalid_reorder');
      }
      const result = computeArrayReorder(current, newOrder);
      if ('error' in result) throw new Error(result.error);

      const update: Record<string, unknown> = {
        sourceImageUrls: newOrder,
        ogImageUrl: newOrder[0],
        updatedAt: Date.now(),
      };
      const currentRatios: number[] | undefined = Array.isArray(data.sourceImageAspectRatios)
        ? data.sourceImageAspectRatios
        : undefined;
      if (currentRatios && currentRatios.length === current.length) {
        update.sourceImageAspectRatios = result.permutation.map((i) => currentRatios[i]);
      }

      tx.update(listingRef, update);
      bumpPublicVersionTx(tx, adminDb);
    });

    return res.status(200).json({ success: true, sourceImageUrls: newOrder });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    if (error?.message === 'invalid_reorder') return res.status(400).json({ error: 'invalid_reorder' });
    console.error('[housing/reorder-source-images] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
