/**
 * 個人タグ通報管理 API (計画書 Phase B-4「/admin に personal_tags の通報一覧・非表示/復帰」)。
 * housing_reports (housing_listings 向け) と同じ「案 B」パターンを踏襲した軽量版。
 *
 * GET  ?resource=personal_tags
 *      — 通報あり個人タグ一覧 (reportCount > 0)、 通報数が多い順に最大 50 件
 *      — 各タグの reports サブコレクションも 20 件まで同梱 (comment/createdAt のみ、 reporterUid は返さない)
 * PATCH ?resource=personal_tags&action=hide&tagId=xxx
 *      — タグを非表示 (isHidden=true) — 管理者の明示判断用
 * PATCH ?resource=personal_tags&action=unhide&tagId=xxx
 *      — タグを表示に戻す。 reports サブコレクションを全削除 + reportCount=0 にリセットする
 *        (housing_listings の resolve-report と同じく、 復帰時は通報記録をクリアして再出発させる)
 *
 * 認可: 全エンドポイント verifyAdmin による管理者チェック必須。
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';

const COLLECTION = 'personal_tags';
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
      const snap = await db
        .collection(COLLECTION)
        .where('reportCount', '>', 0)
        .orderBy('reportCount', 'desc')
        .limit(LIST_LIMIT)
        .get();

      const tags = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const reportsSnap = await d.ref
            .collection('reports')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
          const reports = reportsSnap.docs.map((r) => {
            const rd = r.data();
            return { id: r.id, comment: rd.comment, createdAt: rd.createdAt ?? 0 };
          });
          return {
            id: d.id,
            displayName: data.displayName,
            ownerUid: data.ownerUid,
            createdAt: data.createdAt ?? 0,
            isHidden: data.isHidden === true,
            reportCount: data.reportCount ?? 0,
            reports,
          };
        }),
      );

      return res.status(200).json({ tags });
    }

    if (req.method === 'PATCH') {
      const action = req.query?.action;
      const tagId = req.query?.tagId;
      if (!tagId || typeof tagId !== 'string') {
        return res.status(400).json({ error: 'tagId required' });
      }
      const ref = db.collection(COLLECTION).doc(tagId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'not_found' });

      if (action === 'hide') {
        await ref.update({ isHidden: true });
        return res.status(200).json({ success: true });
      }

      if (action === 'unhide') {
        const reportsSnap = await ref.collection('reports').get();
        const batch = db.batch();
        reportsSnap.docs.forEach((d) => batch.delete(d.ref));
        batch.update(ref, { isHidden: false, reportCount: 0 });
        await batch.commit();
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'invalid_action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[admin/personal-tags]', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
