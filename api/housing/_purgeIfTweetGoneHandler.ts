/**
 * POST /api/housing?action=purge-if-tweet-gone
 *
 * SNS 連動物件のツイートが削除済みかをサーバーが再確認し、404 のときだけ soft delete する。
 * 認可: App Check + Firebase 認証 + rate limit。家主チェックはしない
 *   （削除権限の根拠は「ツイートが実際に 404 か」をサーバーが確認する点。
 *    生きているツイートの物件は第三者が叩いても消せない = いたずら削除不可）。
 * Body: { listingId }
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { checkTweetStatus } from '../../src/lib/housing/tweetSyndication.js';
import { bumpPublicVersionDirect } from './_publicVersion.js';

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
    await getAuth().verifyIdToken(token);

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);
    const snap = await listingRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });
    const data = snap.data()!;

    if (data.imageMode !== 'sns' || !data.tweetId) {
      return res.status(400).json({ error: 'not_sns' });
    }
    if (data.deletedAt) {
      return res.status(200).json({ deleted: true }); // 既に削除済み = idempotent
    }

    const status = await checkTweetStatus(String(data.tweetId));
    const now = Date.now();

    if (status === 'gone') {
      await listingRef.update({ deletedAt: now, updatedAt: now });
      await bumpPublicVersionDirect(adminDb);
      return res.status(200).json({ deleted: true });
    }
    if (status === 'alive') {
      await listingRef.update({ lastTweetCheckAt: now });
      return res.status(200).json({ deleted: false });
    }
    // status === 'error': fail-safe。何も触らず deleted:false（lastTweetCheckAt も据え置き）
    return res.status(200).json({ deleted: false });
  } catch (error: any) {
    console.error('[housing/purge-if-tweet-gone] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
