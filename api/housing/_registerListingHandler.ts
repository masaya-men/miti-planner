/**
 * POST /api/housing?action=register-listing
 * Body: RegistrationDraft (画像なしモード固定)
 *
 * 原子操作:
 *   1. housing_user_meta.canRegister 再評価
 *   2. validateRegistrationDraft で入力検証
 *   3. addressKey 生成
 *   4. housing_listings に新規ドキュメント作成 (imageMode='none' 固定)
 *   5. housing_user_meta を applyRegistrationSuccess で更新
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { evaluateCanRegister, applyRegistrationSuccess, initialUserMeta } from '../../src/utils/housingQuota.js';
import { validateRegistrationDraft, type RegistrationDraft } from '../../src/utils/housingValidation.js';
import { buildAddressKey } from '../../src/utils/housingDuplicate.js';
import type { HousingUserMeta } from '../../src/types/housing.js';

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
  if (!(await applyRateLimit(req, res, 10, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const draft = req.body as RegistrationDraft;

    const validation = validateRegistrationDraft(draft);
    if (!validation.ok) {
      return res.status(400).json({ error: 'invalid_draft', errors: validation.errors });
    }

    const adminDb = getAdminFirestore();
    const metaRef = adminDb.collection('housing_user_meta').doc(uid);
    const listingsCol = adminDb.collection('housing_listings');
    const now = Date.now();
    const addressKey = buildAddressKey(draft);

    let createdId: string | null = null;
    await adminDb.runTransaction(async (tx) => {
      const metaSnap = await tx.get(metaRef);
      let meta: HousingUserMeta = metaSnap.exists
        ? (metaSnap.data() as HousingUserMeta)
        : initialUserMeta(now);

      const can = evaluateCanRegister(meta, now);
      if (!can.allowed) throw new Error('quota_exhausted');
      if (can.metaAfterReset) meta = can.metaAfterReset;

      const newRef = listingsCol.doc();

      const listing = {
        ownerUid: uid,
        dc: draft.dc,
        server: draft.server,
        area: draft.area,
        ward: draft.ward,
        buildingType: draft.buildingType,
        ...(draft.buildingType === 'house' ? {
          plot: draft.plot,
          size: draft.size,
        } : {}),
        ...(draft.roomKind ? {
          roomKind: draft.roomKind,
          roomNumber: draft.roomNumber,
        } : {}),
        addressKey,
        imageMode: 'none' as const,
        tags: draft.tags,
        ...(draft.description ? { description: draft.description } : {}),
        createdAt: now,
        updatedAt: now,
        isHidden: false,
        reportCount: 0,
      };
      tx.set(newRef, listing);
      createdId = newRef.id;

      const updatedMeta = applyRegistrationSuccess(meta);
      tx.set(metaRef, updatedMeta);
    });

    return res.status(200).json({ id: createdId, addressKey });
  } catch (error: any) {
    if (error?.message === 'quota_exhausted') {
      return res.status(429).json({ error: 'quota_exhausted' });
    }
    console.error('[housing/register-listing] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
