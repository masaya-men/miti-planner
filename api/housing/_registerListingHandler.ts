/**
 * POST /api/housing?action=register-listing
 * Body: RegistrationDraft (SNS 画像つき or 画像なし)
 *
 * 原子操作:
 *   1. housing_user_meta.canRegister 再評価
 *   2. validateRegistrationDraft で入力検証 (SNS 画像フィールド含む)
 *   3. addressKey 生成
 *   4. housing_listings に新規ドキュメント作成 (buildListingImageFields で imageMode 決定)
 *   5. housing_user_meta を applyRegistrationSuccess で更新
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { evaluateCanRegister, applyRegistrationSuccess, initialUserMeta } from '../../src/utils/housingQuota.js';
import { validateRegistrationDraft, buildListingImageFields, normalizePublishUntil, type RegistrationDraft } from '../../src/utils/housingValidation.js';
import { buildAddressKey } from '../../src/utils/housingDuplicate.js';
import type { HousingUserMeta } from '../../src/types/housing.js';
import { assertPersonalTagsAttachable, PersonalTagAttachError } from './_personalTagAttachGuard.js';

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

    // 個人タグ (personal_*) が含まれる場合、 自分の所有かつ非表示でないことを確認する
    // (validateRegistrationDraft は同期関数のため personal_ id は形式チェックのみ)。
    try {
      await assertPersonalTagsAttachable(adminDb, draft.tags ?? [], uid);
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

    const metaRef = adminDb.collection('housing_user_meta').doc(uid);
    const listingsCol = adminDb.collection('housing_listings');
    const now = Date.now();
    const addressKey = buildAddressKey(draft);

    let createdId: string | null = null;
    let newRefId: string | null = null;
    await adminDb.runTransaction(async (tx) => {
      const metaSnap = await tx.get(metaRef);
      let meta: HousingUserMeta = metaSnap.exists
        ? (metaSnap.data() as HousingUserMeta)
        : initialUserMeta(now);

      const can = evaluateCanRegister(meta, now);
      if (!can.allowed) throw new Error('quota_exhausted');
      if (can.metaAfterReset) meta = can.metaAfterReset;

      const newRef = listingsCol.doc();
      newRefId = newRef.id;

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
        // apartment の場合は号棟 (apartmentBuilding) を保存。 2026-05-27 追加。
        ...(draft.buildingType === 'apartment' && draft.apartmentBuilding ? {
          apartmentBuilding: draft.apartmentBuilding,
        } : {}),
        ...(draft.roomKind ? {
          roomKind: draft.roomKind,
          roomNumber: draft.roomNumber,
        } : {}),
        addressKey,
        ...buildListingImageFields(draft, now),
        tags: draft.tags,
        ...(draft.description ? { description: draft.description } : {}),
        createdAt: now,
        updatedAt: now,
        // 2026-05-27 (Phase 2-1): 家主が「今もあります」 ボタンで現役確認した時刻。
        // 登録時 = createdAt と同値で初期化 (= 「登録した瞬間に確認済」 と意味づけ、
        // 設計書 §3.1)。 以後は confirmListing API で更新される。
        lastConfirmedAt: now,
        isHidden: false,
        reportCount: 0,
        deletedAt: null,
        // 公開設定 (spec A-1/A-3): 未送信は 'public' を必ず書き込む (旧クライアント互換 +
        // 全 doc に visibility が載る保証 = ルール締めの前提)。
        visibility: draft.visibility === 'private' ? 'private' : 'public',
        // 過去日時も保存する (null に倒すと「期限付き公開」のつもりが無期限公開になる fail-open)。
        // 過去なら遅延評価が即・期限切れ=他人非表示にする。
        publishUntil: normalizePublishUntil(draft.publishUntil),
        ...(draft.title && draft.title.trim() ? { title: draft.title.trim() } : {}),
      };
      tx.set(newRef, listing);
      createdId = newRef.id;

      const updatedMeta = applyRegistrationSuccess(meta);
      tx.set(metaRef, updatedMeta);
    });

    // 2026-05-27 (Phase 2-4): 重複登録時のベル通知。
    // 同 addressKey に他の生きてる listing があれば、 そのオーナー全員に
    // 「同住所に新しいハウジングが登録された」 通知を作成 (= 「今もあります」
    // 確認を促す、 設計書 §3.4)。 登録 transaction 後の best-effort で実行し、
    // 失敗しても登録自体は success のまま返す (= 通知は副作用、 必須ではない)。
    try {
      const sameAddrSnap = await listingsCol
        .where('addressKey', '==', addressKey)
        .where('isHidden', '==', false)
        .limit(50)
        .get();
      const targets = sameAddrSnap.docs.filter((doc) => {
        if (doc.id === newRefId) return false;
        const d = doc.data();
        if (d.deletedAt) return false;
        if (d.ownerUid === uid) return false;
        return true;
      });
      if (targets.length > 0) {
        const batch = adminDb.batch();
        for (const doc of targets) {
          const d = doc.data();
          const notifRef = adminDb
            .collection('users')
            .doc(d.ownerUid)
            .collection('notifications')
            .doc();
          batch.set(notifRef, {
            type: 'duplicate_alert',
            listingId: doc.id,
            severity: 'normal',
            listingTitleSnapshot: d.description?.slice(0, 60) || d.addressKey,
            createdAt: now,
            read: false,
          });
        }
        await batch.commit();
      }
    } catch (notifErr) {
      console.error('[housing/register-listing] duplicate_alert notify failed:', notifErr);
    }

    return res.status(200).json({ id: createdId, addressKey });
  } catch (error: any) {
    if (error?.message === 'quota_exhausted') {
      return res.status(429).json({ error: 'quota_exhausted' });
    }
    console.error('[housing/register-listing] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
