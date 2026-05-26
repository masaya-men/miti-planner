/**
 * ハウジング通報管理 API
 *
 * GET  ?resource=housing_reports               — 通報あり物件一覧 (reportCount > 0 かつ未削除)
 * PATCH ?resource=housing_reports&action=hide&listingId=xxx — 物件を非表示 (isHidden=true)
 *
 * 認可: 全エンドポイント verifyAdmin による管理者チェック必須。
 * 復帰 (isHidden=false) / 物理削除 / BAN は公開後対応。 本ハンドラはα公開時の最小範囲。
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';

const COLLECTION = 'housing_listings';
const LIST_LIMIT = 50;

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

    if (req.method === 'GET') {
      // 通報あり物件 (reportCount>0) かつ未削除を、 通報数が多い順に取得。
      // 自動非表示しきい値 (3) 未満で表示中のものを優先的に発見できる。
      const snap = await db.collection(COLLECTION)
        .where('reportCount', '>', 0)
        .where('deletedAt', '==', null)
        .orderBy('reportCount', 'desc')
        .limit(LIST_LIMIT)
        .get();

      const listings = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerUid: data.ownerUid,
          dc: data.dc,
          server: data.server,
          area: data.area,
          ward: data.ward,
          buildingType: data.buildingType,
          plot: data.plot,
          size: data.size,
          apartmentBuilding: data.apartmentBuilding,
          roomNumber: data.roomNumber,
          imageMode: data.imageMode,
          ogImageUrl: data.ogImageUrl,
          thumbnailPath: data.thumbnailPath,
          tags: data.tags ?? [],
          description: data.description ?? '',
          createdAt: data.createdAt ?? 0,
          isHidden: data.isHidden === true,
          reportCount: data.reportCount ?? 0,
        };
      });

      return res.status(200).json({ listings });
    }

    if (req.method === 'PATCH') {
      const action = req.query?.action;
      const listingId = req.query?.listingId;
      if (!listingId || typeof listingId !== 'string') {
        return res.status(400).json({ error: 'listingId required' });
      }
      if (action !== 'hide') {
        return res.status(400).json({ error: 'invalid_action' });
      }

      const ref = db.collection(COLLECTION).doc(listingId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'not_found' });

      await ref.update({ isHidden: true, updatedAt: Date.now() });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[admin/housing-reports]', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
