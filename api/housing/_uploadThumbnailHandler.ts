/**
 * POST /api/housing?action=upload-thumbnail
 *
 * 物件サムネ画像のアップロード (2026-05-26 新設、 imageMode='thumbnail' 経路)。
 *
 * Body (JSON): { listingId: string, base64: string, mimeType: string }
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
 *
 * 完了動作:
 *  - Firebase Storage `housing/listings/{listingId}/main.{ext}` に保存
 *  - Firestore listing に thumbnailPath (public URL) + imageMode='thumbnail' 更新
 *  - 旧 SNS 画像情報 (postUrl/ogImageUrl/tweetId) は触らない (将来複数画像対応で並存可)
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const MAX_BYTES = 1 * 1024 * 1024; // 1MB
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
  if (!(await applyRateLimit(req, res, 10, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId, base64, mimeType } = req.body || {};
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
    const ext = ALLOWED_MIME[mimeType];
    const storage = getStorage();
    const bucket = storage.bucket();
    const filePath = `housing/listings/${listingId}/main.${ext}`;
    const file = bucket.file(filePath);
    await file.save(buf, {
      contentType: mimeType,
      // public URL を直接配信できるよう cache を長めに
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
    // 公開 URL を取得 (Firebase Storage の標準形式)
    // bucket 名 + path で signed URL なしの public URL を組み立てる
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      filePath,
    )}?alt=media`;

    await listingRef.update({
      thumbnailPath: publicUrl,
      imageMode: 'thumbnail',
      updatedAt: Date.now(),
    });

    return res.status(200).json({ success: true, thumbnailPath: publicUrl });
  } catch (error: any) {
    console.error('[housing/upload-thumbnail] error:', error);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}
