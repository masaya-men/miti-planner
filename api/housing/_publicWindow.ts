/**
 * ハウジング公開読みキャッシュ窓口 (2026-07-14 P1・設計書 §4.2)。
 *
 * GET /api/housing/public?action=version                 → { version } (s-maxage=30)
 * GET /api/housing/public?action=gallery&v=N             → { listings } (s-maxage=86400)
 * GET /api/housing/public?action=housinger&uid=U&v=N     → { listings } (s-maxage=86400)
 * GET /api/housing/public?action=listing&id=X&v=N        → { listing, peers } (s-maxage=86400) / 404
 *
 * - App Check 不要 (匿名が触れる公開データ・tweet-meta 型)。Cloudflare がキャッシュする。
 * - 住所は projectPublicListing の許可リスト射影で制御 (unlisted は住所を返さない)。
 * - v は cache-buster のみ (サーバーは読まない)。版参照は version action だけ。
 * - Cookie / Vary: Cookie は付けない (edge cache 全滅を防ぐ)。
 *
 * 2026-07-14: Vercel Hobby の Serverless Function 12 個上限を超えないため、独立関数
 * (api/housing/public/index.ts) をやめて本モジュール (named export) を api/housing/index.ts
 * から委譲呼び出しする形へ変更。URL は vercel.json の rewrite (/api/housing/public →
 * /api/housing) で従来どおり /api/housing/public を維持 (Cloudflare キャッシュ境界も不変)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { projectPublicListing } from '../../src/lib/housing/publicListingProjection.js';

const COLLECTION = 'housing_listings';
const PUBLIC_VISIBILITY = ['public', 'unlisted'];

// 射影で使いうる全フィールドを .select() して Firestore→関数の転送量を削減する
// (planData 級の大フィールドは無いが、方針を api/popular と揃える)。
const SELECT_FIELDS = [
  'ownerUid', 'visibility', 'isHidden', 'deletedAt', 'createdAt', 'publishUntil',
  'dc', 'server', 'area', 'ward', 'plot', 'size', 'apartmentBuilding', 'roomNumber', 'addressKey',
  'title', 'description', 'tags', 'imageMode', 'postUrl', 'ogImageUrl',
  'thumbnailPath', 'thumbnailPaths', 'sourceImageUrls', 'sourceImageAspectRatios',
  'youtubeVideoId', 'videoUrl', 'videoPosterUrl', 'videoAspectRatio', 'tweetId',
  'buildingType', 'roomKind', 'lastConfirmedAt',
];

function isPubliclyViewable(d: any, now: number): boolean {
  if (d.deletedAt != null) return false;
  if (d.isHidden === true) return false;
  if (!PUBLIC_VISIBILITY.includes(d.visibility ?? 'public')) return false;
  if (d.publishUntil != null && now >= d.publishUntil) return false;
  return true;
}

export async function publicWindowHandler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    initAdmin();
    const db = getAdminFirestore();
    const action = req.query?.action;
    const now = Date.now();

    if (action === 'version') {
      const snap = await db.doc('housing_meta/public').get();
      const version = snap.exists ? (snap.data()?.version ?? 0) : 0;
      res.setHeader('Cache-Control', 'public, s-maxage=30, max-age=30');
      return res.status(200).json({ version });
    }

    if (action === 'gallery') {
      const snap = await db.collection(COLLECTION)
        .where('isHidden', '==', false)
        .where('visibility', 'in', PUBLIC_VISIBILITY)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .select(...SELECT_FIELDS)
        .get();
      const listings = snap.docs
        .filter((doc) => doc.data().deletedAt == null)
        .map((doc) => projectPublicListing(doc.id, doc.data()));
      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
      return res.status(200).json({ listings });
    }

    if (action === 'housinger') {
      const uid = req.query?.uid;
      if (!uid || typeof uid !== 'string') {
        return res.status(400).json({ error: 'uid required' });
      }
      const snap = await db.collection(COLLECTION)
        .where('ownerUid', '==', uid)
        .where('visibility', 'in', PUBLIC_VISIBILITY)
        .where('isHidden', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(200)
        .select(...SELECT_FIELDS)
        .get();
      const listings = snap.docs
        .filter((doc) => doc.data().deletedAt == null)
        .map((doc) => projectPublicListing(doc.id, doc.data()));
      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
      return res.status(200).json({ listings });
    }

    if (action === 'listing') {
      const id = req.query?.id;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'id required' });
      }
      const snap = await db.collection(COLLECTION).doc(id).get();
      if (!snap.exists) {
        res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
        return res.status(404).json({ error: 'not_found' });
      }
      const data = snap.data()!;
      if (!isPubliclyViewable(data, now)) {
        // オーナー本人向けの非公開/非表示/期限切れは窓口では返さない (本人は getDoc で直読み)。
        res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
        return res.status(404).json({ error: 'not_found' });
      }
      const listing = projectPublicListing(id, data);

      // peers: 同 addressKey の他 public 生存 listing (設計 §8.5 で unlisted は peers 無し)。
      let peers: Record<string, unknown>[] = [];
      if ((data.visibility ?? 'public') === 'public' && typeof data.addressKey === 'string') {
        const peerSnap = await db.collection(COLLECTION)
          .where('addressKey', '==', data.addressKey)
          .where('isHidden', '==', false)
          .where('visibility', '==', 'public')
          .limit(10)
          .select(...SELECT_FIELDS)
          .get();
        peers = peerSnap.docs
          .filter((d) => d.id !== id && d.data().deletedAt == null)
          .map((d) => projectPublicListing(d.id, d.data()));
      }
      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
      return res.status(200).json({ listing, peers });
    }

    return res.status(400).json({ error: 'invalid action. use version|gallery|housinger|listing' });
  } catch (err: any) {
    console.error('[housing/public] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
