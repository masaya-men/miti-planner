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
import { FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { validateRegistrationDraft, normalizePublishUntil, buildListingImageFields, type RegistrationDraft } from '../../src/utils/housingValidation.js';
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
      // 画像関連フィールド (2026-07-20 編集ページ画像管理設計): 編集ページで登録方法
      // (アップロード⇔URL) を切り替えたときに送られてくる。imageMode は 'sns' の
      // ときだけ意味を持つ (それ以外は validateImage が postUrl だけ見る)。
      // postUrl は imageMode と独立したフィールドとして扱う既存方針により常に含める。
      imageMode: updates.imageMode === 'sns' ? 'sns' : undefined,
      postUrl: updates.postUrl,
      ogImageUrl: updates.ogImageUrl,
      tweetId: updates.tweetId,
      youtubeVideoId: updates.youtubeVideoId,
      sourcePostUrls: updates.sourcePostUrls,
      sourceImageUrls: updates.sourceImageUrls,
      sourceImageAspectRatios: updates.sourceImageAspectRatios,
      videoUrl: updates.videoUrl,
      videoPosterUrl: updates.videoPosterUrl,
      videoAspectRatio: updates.videoAspectRatio,
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

    let switchedFromThumbnail = false;

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      // 削除済みは編集不可 (not_found を返してリーク防止)
      if (data.deletedAt) throw new Error('not_found');

      // トランザクションがリトライされても正しい値になるよう、毎回この attempt の
      // data から導出しなおす (true 固定代入だと再試行時に古い true が残留しうる。
      // 最終レビューで発見)。
      switchedFromThumbnail = draftForValidation.imageMode === 'sns' && data.imageMode === 'thumbnail';

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
      if (
        draftForValidation.visibility === 'public'
        || draftForValidation.visibility === 'unlisted'
        || draftForValidation.visibility === 'private'
      ) {
        updatePayload.visibility = draftForValidation.visibility;
      }
      if ('publishUntil' in draftForValidation) {
        // 公開期限は「公開」専用。unlisted/private への編集時は必ず null に倒す (§8.2)。
        // public のときのみ過去日時も保存 (register 側と同じ fail-closed 方針)。
        updatePayload.publishUntil =
          draftForValidation.visibility === 'unlisted' || draftForValidation.visibility === 'private'
            ? null
            : normalizePublishUntil(draftForValidation.publishUntil);
      }
      if (typeof draftForValidation.title === 'string' && draftForValidation.title.trim()) {
        updatePayload.title = draftForValidation.title.trim();
      }

      // 画像関連フィールド (2026-07-20 編集ページ画像管理設計、バリデーション済みの
      // draftForValidation から読む。生の req.body を直接使わない → セキュリティ上の要点参照)。
      if (typeof draftForValidation.postUrl === 'string') {
        updatePayload.postUrl = draftForValidation.postUrl;
      }
      if (draftForValidation.imageMode === 'sns') {
        // sns 経路のフィールド選択は register-listing と同じ buildListingImageFields に委譲する
        // (source = Twitter/YouTube/OGP ごとに保存して良いフィールドが異なり、videoUrl/videoPosterUrl
        // は Twitter 以外では validateImage が host allowlist 検証をしていないため手書きでは書けない)。
        // imageMode:'none' フォールバック (postUrl/ogImageUrl 欠落時) は既存データを壊さないよう無視する。
        const imageFields = buildListingImageFields(draftForValidation, Date.now());
        if (imageFields.imageMode === 'sns') {
          Object.assign(updatePayload, imageFields);

          // 同じ imageMode==='sns' 内でのソース切替 (例: Twitter→YouTube) 時、旧ソースの
          // フィールドが Firestore に残留しないようにする (tx.update はマージのため上書きされない)。
          // 残留した tweetId が後日 purge-if-tweet-gone に拾われ、有効な物件が誤って
          // soft-delete されるデータロス経路を防ぐ (最終レビューで発見)。
          const SNS_SUBFIELDS = [
            'tweetId',
            'youtubeVideoId',
            'sourceImageUrls',
            'sourceImageAspectRatios',
            'videoUrl',
            'videoPosterUrl',
            'videoAspectRatio',
            'lastTweetCheckAt',
            'sourcePostUrls',
          ] as const;
          for (const field of SNS_SUBFIELDS) {
            if (!(field in imageFields)) {
              updatePayload[field] = FieldValue.delete();
            }
          }
        }

        // thumbnail→sns の登録方法切替クリーンアップ: 保存済みが thumbnail で、今回
        // sns に切り替わるなら、Storage 上の画像ファイルを全削除し
        // thumbnailPaths/thumbnailPath をクリアする (実ファイル削除はトランザクションの外側)。
        if (data.imageMode === 'thumbnail') {
          updatePayload.thumbnailPaths = FieldValue.delete();
          updatePayload.thumbnailPath = FieldValue.delete();
        }
      }

      tx.update(listingRef, updatePayload);
      bumpPublicVersionTx(tx, adminDb);
    });

    // Storageファイルの実削除はトランザクション成功後 (Task 2 の delete-thumbnail と同じ理由:
    // Storage削除の失敗でFirestoreの更新を巻き戻さない)。
    if (switchedFromThumbnail) {
      try {
        await getStorage().bucket().deleteFiles({ prefix: `housing/listings/${listingId}/` });
      } catch (e) {
        console.error('[housing/update-listing] thumbnail cleanup failed (non-fatal):', e);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    console.error('[housing/update-listing] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
