/**
 * ハウジング公開読みキャッシュ窓口 (2026-07-14 P1・設計書 §4.2)。
 *
 * GET /api/housing/public?action=version                 → { version } (s-maxage=30)
 * GET /api/housing/public?action=gallery&v=N             → { listings } (s-maxage=86400)
 * GET /api/housing/public?action=housinger&uid=U&v=N     → { listings, hiddenListings } (s-maxage=86400)
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
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { projectPublicListing, projectHiddenListing } from '../../src/lib/housing/publicListingProjection.js';
import type { HousingReq, HousingRes } from './_httpTypes.js';

const COLLECTION = 'housing_listings';
const PUBLIC_VISIBILITY = ['public', 'unlisted'];

// 射影で使いうる全フィールドを .select() して Firestore→関数の転送量を削減する
// (planData 級の大フィールドは無いが、大きな doc を読む他の公開 API と方針を揃える)。
const SELECT_FIELDS = [
  'ownerUid', 'visibility', 'isHidden', 'deletedAt', 'createdAt', 'publishUntil', 'pinnedNewUntil',
  'dc', 'server', 'area', 'ward', 'plot', 'size', 'apartmentBuilding', 'roomNumber', 'addressKey',
  'title', 'description', 'tags', 'imageMode', 'postUrl', 'ogImageUrl',
  'thumbnailPath', 'thumbnailPaths', 'coverThumbHash', 'sourceImageUrls', 'sourceImageAspectRatios',
  'youtubeVideoId', 'videoUrl', 'videoPosterUrl', 'videoAspectRatio', 'tweetId',
  'buildingType', 'roomKind', 'lastConfirmedAt',
];

export function isPubliclyViewable(d: FirebaseFirestore.DocumentData, now: number): boolean {
  if (d.deletedAt != null) return false;
  if (d.isHidden === true) return false;
  if (!PUBLIC_VISIBILITY.includes(d.visibility ?? 'public')) return false;
  if (d.publishUntil != null && now >= d.publishUntil) return false;
  return true;
}

export async function publicWindowHandler(req: HousingReq, res: HousingRes) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // 匿名で叩ける公開窓口の濫用対策: IP 単位 + 全体上限のレート制限
  if (!(await applyRateLimit(req, res, 60, 60_000, { scope: 'housing-public', globalMax: 600 }))) return;

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
      const [snap, hiddenSnap] = await Promise.all([
        db.collection(COLLECTION)
          .where('ownerUid', '==', uid)
          .where('visibility', 'in', PUBLIC_VISIBILITY)
          .where('isHidden', '==', false)
          .orderBy('createdAt', 'desc')
          .select(...SELECT_FIELDS)
          .get(),
        // 運営非表示 (adminHiddenScope あり) の家。 ハウジンガーページだけに「非表示の帯」 付きで出す。
        // 同じ複合インデックス (ownerUid, visibility, isHidden, createdAt) で足りる。
        db.collection(COLLECTION)
          .where('ownerUid', '==', uid)
          .where('visibility', 'in', PUBLIC_VISIBILITY)
          .where('isHidden', '==', true)
          .orderBy('createdAt', 'desc')
          .select(...SELECT_FIELDS, 'adminHiddenScope')
          .get(),
      ]);
      const listings = snap.docs
        .filter((doc) => doc.data().deletedAt == null)
        .map((doc) => projectPublicListing(doc.id, doc.data()));
      const hiddenListings = hiddenSnap.docs
        .filter((doc) => {
          const x = doc.data();
          return x.deletedAt == null && !!x.adminHiddenScope;
        })
        .map((doc) => projectHiddenListing(doc.id, doc.data()));
      res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
      return res.status(200).json({ listings, hiddenListings });
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
  } catch (err) {
    console.error('[housing/public] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
