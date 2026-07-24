/**
 * POST /api/housing?action=upload-thumbnail
 *
 * 物件サムネ画像のアップロード (2026-05-26 新設、 imageMode='thumbnail' 経路)。
 * 2026-05-26 拡張: index parameter で 1-4 枚 (0-indexed) の複数画像を扱う。
 *
 * Body (JSON): { listingId: string, base64: string, mimeType: string, index?: number }
 *  - index: 0-3 の整数。 省略時は 0 (1 枚目)。 同じ index への再アップロードは上書き。
 *  - base64: Data URL 先頭 (data:image/avif;base64,) を含まない pure base64 を想定
 *  - mimeType: 'image/avif' | 'image/webp' | 'image/jpeg' | 'image/png'
 *
 * 認可: Firebase ID token (Bearer) + listing.ownerUid === uid の一致を server 側で検証。
 * Storage 側は rules で全クライアント直書き拒否済 (storage.rules)、 admin SDK のみ書き込み可。
 *
 * 検証:
 *  - サイズ上限 1MB (圧縮済画像を想定、 base64 デコード後の Buffer 長で判定)
 *  - MIME 許可リスト (AVIF / WebP / JPEG / PNG)
 *  - ownerUid 一致 (他人の物件に画像を上書きされないため)
 *  - index は 0-3 の整数
 *
 * 完了動作:
 *  - Firebase Storage `housing/listings/{listingId}/{randomId}.{ext}` に保存
 *    (2026-07-20〜: 並び順は Firestore の thumbnailPaths 配列だけが正典。
 *     旧 main-{index}.{ext} 形式の既存ファイル/URL はそのまま動作し続ける)
 *  - Firestore listing.thumbnailPaths 配列の index 位置を URL で更新
 *  - thumbnailPath (1 枚目 = 後方互換) も index=0 のときに更新
 *  - imageMode='thumbnail' に切替
 *  - 直前まで imageMode='sns' だった場合は SNS 由来フィールド (ogImageUrl /
 *    sourceImageUrls / sourceImageAspectRatios / tweetId / youtubeVideoId /
 *    videoUrl / videoPosterUrl / videoAspectRatio) をクリア (postUrl は維持)
 */
import { randomUUID } from 'node:crypto';
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { parseStoragePathFromPublicUrl, buildHousingImagePublicUrl } from './_imageArrayLogic.js';
import { bumpPublicVersionTx } from './_publicVersion.js';

const MAX_BYTES = 1 * 1024 * 1024; // 1MB
const MAX_IMAGES_PER_LISTING = 4;
const ALLOWED_MIME: Record<string, string> = {
  'image/avif': 'avif',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

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
  // scope 必須: 未指定だと他 housing ハンドラー (register-listing/check-duplicate/can-register 等)
  // と同じ 'global' バケットを共有し、それらの呼び出しが先に消費した分だけ本来成功するはずの
  // 画像アップロードが 429 で失敗する (2026-07-20 実ユーザー報告の根因の一つ)。
  if (!(await applyRateLimit(req, res, 10, 60_000, { scope: 'housing-upload-thumbnail' }))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId, base64, mimeType, index } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'invalid_base64' });
    }
    if (!mimeType || typeof mimeType !== 'string' || !ALLOWED_MIME[mimeType]) {
      return res.status(400).json({
        error: 'invalid_mimeType',
        allowed: Object.keys(ALLOWED_MIME),
      });
    }
    // index は省略時 0、 整数 0..3 のみ許可。
    const imageIndex = index === undefined ? 0 : Number(index);
    if (
      !Number.isInteger(imageIndex) ||
      imageIndex < 0 ||
      imageIndex >= MAX_IMAGES_PER_LISTING
    ) {
      return res.status(400).json({ error: 'invalid_index', max: MAX_IMAGES_PER_LISTING });
    }

    // base64 → Buffer に decode してサイズ検証
    const buf = Buffer.from(base64, 'base64');
    if (buf.length === 0) return res.status(400).json({ error: 'empty_image' });
    if (buf.length > MAX_BYTES) {
      return res.status(413).json({ error: 'too_large', maxBytes: MAX_BYTES, gotBytes: buf.length });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);
    const listingSnap = await listingRef.get();
    if (!listingSnap.exists) return res.status(404).json({ error: 'listing_not_found' });
    const listing = listingSnap.data()!;
    if (listing.ownerUid !== uid) return res.status(403).json({ error: 'forbidden' });
    if (listing.deletedAt) return res.status(404).json({ error: 'listing_deleted' });

    // Storage に保存。 ext は ALLOWED_MIME から確定 (ユーザー入力に依存しない)。
    // path: ランダムID (上書き不可の新規ファイル)。 並び順(index)とは無関係にし、
    // Firestore の thumbnailPaths 配列だけを並び順の正典とする (2026-07-20 編集ページ
    // 画像管理設計、 delete-thumbnail / reorder-thumbnails が Storage 側のファイル移動
    // を必要としないため)。 既存の main-{index}.{ext} 形式の URL はそのまま不透明な
    // 文字列として動作し続けるため、 過去データの移行は不要。
    const ext = ALLOWED_MIME[mimeType];
    const storage = getStorage();
    const bucket = storage.bucket();
    const filePath = `housing/listings/${listingId}/${randomUUID()}.${ext}`;
    const file = bucket.file(filePath);
    await file.save(buf, {
      contentType: mimeType,
      // public URL を直接配信できるよう cache を長めに
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
    // 公開 URL: Cloudflareキャッシュ経由の新形式 (2026-07-24〜)。
    // filePath = `housing/listings/{listingId}/{uuid}.{ext}` なので
    // ファイル名部分だけを渡す (listingId は既に変数として存在)。
    const fileName = filePath.split('/').pop()!;
    const publicUrl = buildHousingImagePublicUrl(listingId, fileName);

    // thumbnailPaths 配列の index 位置を更新 (transaction で race condition 回避)。
    // 同じスロットへの再アップロードで置き換えられる旧 URL をトランザクション内で捕捉し、
    // トランザクション成功後に Storage 側の旧ファイルを削除する (孤児化防止)。
    let previousUrl: string | undefined;
    const newPaths = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      const data = snap.data() ?? {};
      const existing: string[] = Array.isArray(data.thumbnailPaths)
        ? [...data.thumbnailPaths]
        : data.thumbnailPath
          ? [data.thumbnailPath] // 旧データを 1 件配列に正規化
          : [];
      // index 位置を確保 (足りなければ pad)
      while (existing.length <= imageIndex) existing.push('');
      // 上書き前の値を保持 (空文字列プレースホルダーは「元々何もない」= undefined に変換)。
      previousUrl = existing[imageIndex] || undefined;
      existing[imageIndex] = publicUrl;
      // 空文字列を末尾から除去 (中間の空は維持してインデックス一意性を保つ)
      while (existing.length > 0 && existing[existing.length - 1] === '') existing.pop();

      const update: Record<string, unknown> = {
        thumbnailPaths: existing,
        imageMode: 'thumbnail',
        updatedAt: Date.now(),
      };
      // 後方互換: 1 枚目を thumbnailPath にもコピー
      if (imageIndex === 0 || (data.thumbnailPath ?? '') === '') {
        update.thumbnailPath = existing[0];
      }
      // sns→thumbnail の登録方法切替 (2026-07-20 編集ページ画像管理設計): このアップロードが
      // 「URL経由だった物件に初めて直接アップロード画像を追加した」ケースなら、SNS由来の
      // フィールドをクリアする。postUrl (元投稿へのリンク) だけは imageMode と独立した
      // フィールドとして扱う既存方針 (2026-07-20 別修正) により残す。
      if (data.imageMode === 'sns') {
        update.ogImageUrl = FieldValue.delete();
        update.sourceImageUrls = FieldValue.delete();
        update.sourceImageAspectRatios = FieldValue.delete();
        update.tweetId = FieldValue.delete();
        update.youtubeVideoId = FieldValue.delete();
        update.videoUrl = FieldValue.delete();
        update.videoPosterUrl = FieldValue.delete();
        update.videoAspectRatio = FieldValue.delete();
      }
      tx.update(listingRef, update);
      bumpPublicVersionTx(tx, adminDb);
      return existing;
    });

    // 同一スロットへの再アップロードで置き換えられた旧 Storage オブジェクトの削除は
    // トランザクション成功後のみ行う (delete-thumbnail と同じ理由: Storage削除の失敗で
    // 既に成功したレスポンス/Firestore更新に影響させない)。
    if (previousUrl) {
      const oldPath = parseStoragePathFromPublicUrl(previousUrl);
      if (oldPath) {
        try {
          await getStorage().bucket().file(oldPath).delete();
        } catch (e) {
          console.error('[housing/upload-thumbnail] old file cleanup failed (non-fatal):', e);
        }
      }
    }

    return res.status(200).json({ success: true, thumbnailPath: publicUrl, thumbnailPaths: newPaths });
  } catch (error: any) {
    console.error('[housing/upload-thumbnail] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
