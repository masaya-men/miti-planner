/**
 * ハウジング NEW リボン手動固定 管理 API (2026-08-24)
 *
 * GET   ?resource=housing_new_badge&listingId=xxx
 *       — 対象物件の最小表示情報 + 現在の pinnedNewUntil を返す (管理画面の検索結果表示用)
 * PATCH ?resource=housing_new_badge&action=pin&listingId=xxx   body: { days: number }
 *       — pinnedNewUntil = 現在時刻 + days日 を設定 (1〜90日)
 * PATCH ?resource=housing_new_badge&action=unpin&listingId=xxx
 *       — pinnedNewUntil を解除 (null)
 *
 * 認可: 全エンドポイント verifyAdmin による管理者チェック必須。
 * publishUntil (公開期限) と同じ「未来なら有効・遅延評価」設計なので、期限切れの自動解除
 * cron は不要 (探すページ側 isPinnedNew が都度 Date.now() と比較する)。
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { bumpPublicVersionDirect } from '../housing/_publicVersion.js';

const COLLECTION = 'housing_listings';
const MAX_DAYS = 90;

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(401).json({ error: 'Unauthorized' });

    const db = getAdminFirestore();
    const listingId = req.query?.listingId;
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'listingId required' });
    }
    const ref = db.collection(COLLECTION).doc(listingId);

    if (req.method === 'GET') {
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'not_found' });
      const data = snap.data()!;
      return res.status(200).json({
        id: snap.id,
        title: data.title ?? '',
        dc: data.dc,
        server: data.server,
        area: data.area,
        ward: data.ward,
        imageMode: data.imageMode,
        ogImageUrl: data.ogImageUrl,
        thumbnailPath: data.thumbnailPath,
        deletedAt: data.deletedAt ?? null,
        isHidden: data.isHidden === true,
        pinnedNewUntil: data.pinnedNewUntil ?? null,
      });
    }

    if (req.method === 'PATCH') {
      const action = req.query?.action;
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'not_found' });

      if (action === 'pin') {
        const days = Number(req.body?.days);
        if (!Number.isFinite(days) || days < 1 || days > MAX_DAYS) {
          return res.status(400).json({ error: 'invalid_days' });
        }
        const pinnedNewUntil = Date.now() + days * 24 * 60 * 60 * 1000;
        await ref.update({ pinnedNewUntil, updatedAt: Date.now() });
        await bumpPublicVersionDirect(db);
        return res.status(200).json({ success: true, pinnedNewUntil });
      }
      if (action === 'unpin') {
        await ref.update({ pinnedNewUntil: null, updatedAt: Date.now() });
        await bumpPublicVersionDirect(db);
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({ error: 'invalid_action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[admin/housing-new-badge]', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
