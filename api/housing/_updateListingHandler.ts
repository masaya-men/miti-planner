/**
 * POST /api/housing?action=update-listing
 *
 * ハウジング物件編集ハンドラ
 * 認可: ownerUid 一致のみ
 * Body: { listingId, ...updatedFields }
 * 更新可能フィールド: dc, server, area, ward, plot, size, buildingType,
 *   roomKind, roomNumber, imageMode, postUrl, ogImageUrl, thumbnailPath,
 *   tags, description, addressKey
 * 不変フィールド: id, ownerUid, createdAt, reportCount, isHidden, deletedAt
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { validateRegistrationDraft, normalizePublishUntil, type RegistrationDraft } from '../../src/utils/housingValidation.js';
import { buildAddressKey } from '../../src/utils/housingDuplicate.js';
import { assertPersonalTagsAttachable, PersonalTagAttachError } from './_personalTagAttachGuard.js';
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
  if (!(await applyRateLimit(req, res, 20, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId, ...updates } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }

    // validation: draft 構造を組み立てて zod 通す
    const draftForValidation: RegistrationDraft = {
      dc: updates.dc,
      server: updates.server,
      area: updates.area,
      ward: updates.ward,
      buildingType: updates.buildingType,
      ...(updates.buildingType === 'house'
        ? { plot: updates.plot, size: updates.size }
        : {}),
      // apartment: 号棟を validate 側に渡す。 抜けると validateAddress が apartmentBuilding=out_of_range で失敗
      ...(updates.buildingType === 'apartment'
        ? { apartmentBuilding: updates.apartmentBuilding }
        : {}),
      ...(updates.roomKind
        ? { roomKind: updates.roomKind, roomNumber: updates.roomNumber }
        : {}),
      tags: updates.tags ?? [],
      description: updates.description,
      title: updates.title,
      visibility: updates.visibility,
      publishUntil: updates.publishUntil,
    } as RegistrationDraft;

    const result = validateRegistrationDraft(draftForValidation);
    if (!result.ok) {
      return res.status(400).json({ error: 'invalid_request', errors: result.errors });
    }

    const addressKey = buildAddressKey(draftForValidation);

    const adminDb = getAdminFirestore();

    try {
      await assertPersonalTagsAttachable(adminDb, draftForValidation.tags ?? [], uid);
    } catch (e) {
      if (e instanceof PersonalTagAttachError) {
        return res.status(400).json({
          error: 'invalid_personal_tag',
          rejectedTagId: e.rejectedTagId,
          reason: e.reason,
        });
      }
      throw e;
    }

    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      // 削除済みは編集不可 (not_found を返してリーク防止)
      if (data.deletedAt) throw new Error('not_found');

      // 更新ペイロード: undefined のフィールドは除外して既存値を残す
      const updatePayload: Record<string, unknown> = {
        dc: draftForValidation.dc,
        server: draftForValidation.server,
        area: draftForValidation.area,
        ward: draftForValidation.ward,
        buildingType: draftForValidation.buildingType,
        addressKey,
        tags: draftForValidation.tags,
        updatedAt: Date.now(),
      };
      if (draftForValidation.buildingType === 'house') {
        updatePayload.plot = draftForValidation.plot;
        updatePayload.size = draftForValidation.size;
      }
      if (draftForValidation.buildingType === 'apartment' && draftForValidation.apartmentBuilding) {
        updatePayload.apartmentBuilding = draftForValidation.apartmentBuilding;
      }
      if (draftForValidation.roomKind) {
        updatePayload.roomKind = draftForValidation.roomKind;
        updatePayload.roomNumber = draftForValidation.roomNumber;
      }
      if (typeof draftForValidation.description === 'string') {
        updatePayload.description = draftForValidation.description;
      }
      if (draftForValidation.visibility === 'public' || draftForValidation.visibility === 'private') {
        updatePayload.visibility = draftForValidation.visibility;
      }
      if ('publishUntil' in draftForValidation) {
        // 過去日時も保存する (register 側と同じ fail-closed 方針。過去に編集=即・期限切れで
        // 他人から隠す、という意図的な操作も成立させる)。
        updatePayload.publishUntil = normalizePublishUntil(draftForValidation.publishUntil);
      }
      if (typeof draftForValidation.title === 'string' && draftForValidation.title.trim()) {
        updatePayload.title = draftForValidation.title.trim();
      }

      tx.update(listingRef, updatePayload);
      bumpPublicVersionTx(tx, adminDb);
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    console.error('[housing/update-listing] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
