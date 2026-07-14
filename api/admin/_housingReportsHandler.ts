/**
 * ハウジング通報管理 API
 *
 * GET  ?resource=housing_reports
 *      — 通報あり物件一覧 (reportCount > 0 かつ未削除)
 *      — 各 listing.reports サブコレクションも 20 件まで同梱して返す (reason/comment/createdAt)
 *      — reporterUid は管理者にも返さない (家主漏洩リスクヘッジ)
 * PATCH ?resource=housing_reports&action=hide&listingId=xxx
 *      — 物件を非表示 (isHidden=true) — 管理者の明示判断用
 * PATCH ?resource=housing_reports&action=dismiss-one&listingId=xxx&reportId=yyy
 *      — 個別通報レコードを 1 件却下 (該当 report 削除 + reportCount-1 + 閾値割れで isHidden=false)
 *
 * 認可: 全エンドポイント verifyAdmin による管理者チェック必須。
 * 物理削除 cron / BAN / 異議申し立てアプリ内 UI は公開後対応 (Phase 3 残)。
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { REPORT_AUTO_HIDE_THRESHOLD } from '../../src/constants/housing.js';
import { bumpPublicVersionDirect, bumpPublicVersionTx } from '../housing/_publicVersion.js';

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

      // 各 listing の reports サブコレクションを並列取得 (最新 20 件)。
      // reporterUid は API レスポンスに含めない (管理者 UI に出さない方針)。
      const listings = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const reportsSnap = await d.ref
            .collection('reports')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
          const reports = reportsSnap.docs.map((r) => {
            const rd = r.data();
            return {
              id: r.id,
              reason: rd.reason,
              comment: rd.comment,
              createdAt: rd.createdAt ?? 0,
            };
          });
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
            reports,
          };
        }),
      );

      return res.status(200).json({ listings });
    }

    if (req.method === 'PATCH') {
      const action = req.query?.action;
      const listingId = req.query?.listingId;
      if (!listingId || typeof listingId !== 'string') {
        return res.status(400).json({ error: 'listingId required' });
      }
      const ref = db.collection(COLLECTION).doc(listingId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'not_found' });

      if (action === 'hide') {
        await ref.update({ isHidden: true, updatedAt: Date.now() });
        await bumpPublicVersionDirect(db);
        return res.status(200).json({ success: true });
      }
      if (action === 'dismiss-one') {
        // 個別通報レコードを 1 件却下: report doc 削除 + reportCount-1 + 閾値割れで isHidden=false。
        // 2026-05-26 改修: 旧 'restore' (= 単に count-1) は「どの通報を却下したか」 が
        // 不明な UX バグだった。 reason/comment を見て個別に却下できるように変更。
        // さらに却下時は家主の対応する通知も連動削除する (reportId 紐付けで検索)。
        const reportId = req.query?.reportId;
        if (!reportId || typeof reportId !== 'string') {
          return res.status(400).json({ error: 'reportId required' });
        }
        const reportRef = ref.collection('reports').doc(reportId);
        const result = await db.runTransaction(async (tx) => {
          const [listingSnap, reportSnap] = await Promise.all([
            tx.get(ref),
            tx.get(reportRef),
          ]);
          if (!listingSnap.exists) throw new Error('not_found');
          if (!reportSnap.exists) throw new Error('report_not_found');
          const data = listingSnap.data() ?? {};
          const newCount = Math.max(0, (data.reportCount ?? 0) - 1);
          const update: Record<string, unknown> = {
            reportCount: newCount,
            updatedAt: Date.now(),
          };
          if (newCount < REPORT_AUTO_HIDE_THRESHOLD) {
            update.isHidden = false;
            if (data.isHidden === true) bumpPublicVersionTx(tx, db);
          }
          tx.delete(reportRef);
          tx.update(ref, update);
          return { reportCount: newCount, ownerUid: data.ownerUid as string | undefined };
        });

        // 家主通知を連動削除 (best-effort)。
        // 旧データ (reportId 紐付け無し) は query にヒットせず副作用ゼロ。
        // 通信エラー時は report 自体は削除済みなので 200 を返す方針 (整合性 > 完全性)。
        if (result.ownerUid) {
          try {
            const notifSnap = await db
              .collection('users')
              .doc(result.ownerUid)
              .collection('notifications')
              .where('reportId', '==', reportId)
              .limit(1)
              .get();
            if (!notifSnap.empty) {
              await notifSnap.docs[0].ref.delete();
            }
          } catch (e) {
            console.warn('[admin/housing-reports] notif cleanup failed', e);
          }
        }

        return res.status(200).json({ success: true, reportCount: result.reportCount });
      }
      return res.status(400).json({ error: 'invalid_action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[admin/housing-reports]', err);
    const msg = err?.message;
    if (msg === 'not_found' || msg === 'report_not_found') {
      return res.status(404).json({ error: msg });
    }
    return res.status(500).json({ error: msg || 'Internal error' });
  }
}
