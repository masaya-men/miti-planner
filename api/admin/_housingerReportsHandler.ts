/**
 * ハウジンガープロフィール通報管理 API (spec 2026-07-10-housinger-profile-design.md §6.2)
 *
 * GET  ?resource=housinger_reports
 *      — 通報あり (reportCount > 0) プロフィール一覧 (通報数が多い順に最大 50 件)
 *      — 各プロフィールの reports サブコレクションも 20 件まで同梱 (reason/comment/createdAt)
 *      — reporterUid は管理者にも返さない (_housingReportsHandler.ts と同方針)
 * PATCH ?resource=housinger_reports&action=hide&uid=xxx
 *      — 強制非公開: isModerationHidden=true + 対応する personal_tags のタグも isHidden=true (同一 tx)
 * PATCH ?resource=housinger_reports&action=restore&uid=xxx
 *      — 復帰: isModerationHidden=false。タグの isHidden は isPublished && !isModerationHidden で再計算 (同一 tx)
 * PATCH ?resource=housinger_reports&action=dismiss-one&uid=xxx&reportId=yyy
 *      — 個別通報レコードを 1 件却下 (該当 report 削除 + reportCount-1)。
 *        listing と異なり通報閾値による自動非表示が無いため isModerationHidden には触れない。
 *        通知を作っていない (spec §6.2) ため連動削除も不要。
 *
 * 認可: 全エンドポイント verifyAdmin による管理者チェック必須。
 * 運営作業はこの API で完結させる (Firestore 直叩き禁止 [[feedback_housing_admin_complete]])。
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { personalTagIdForUid } from '../../src/lib/housing/housingerProfile.js';

const COLLECTION = 'housing_profiles';
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
      const snap = await db.collection(COLLECTION)
        .where('reportCount', '>', 0)
        .orderBy('reportCount', 'desc')
        .limit(LIST_LIMIT)
        .get();

      // 各プロフィールの reports サブコレクションを並列取得 (最新 20 件)。
      // reporterUid は API レスポンスに含めない (管理者 UI に出さない方針)。
      const profiles = await Promise.all(
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
            uid: d.id,
            displayName: data.displayName ?? '',
            avatarUrl: data.avatarUrl ?? null,
            bio: data.bio ?? null,
            snsUrl: data.snsUrl ?? null,
            isPublished: data.isPublished === true,
            isModerationHidden: data.isModerationHidden === true,
            reportCount: data.reportCount ?? 0,
            reports,
          };
        }),
      );

      return res.status(200).json({ profiles });
    }

    if (req.method === 'PATCH') {
      const action = req.query?.action;
      const uid = req.query?.uid;
      if (!uid || typeof uid !== 'string') {
        return res.status(400).json({ error: 'uid required' });
      }
      const profileRef = db.collection(COLLECTION).doc(uid);
      const tagRef = db.collection('personal_tags').doc(personalTagIdForUid(uid));

      if (action === 'hide') {
        await db.runTransaction(async (tx) => {
          const [profileSnap, tagSnap] = await Promise.all([tx.get(profileRef), tx.get(tagRef)]);
          if (!profileSnap.exists) throw new Error('not_found');
          tx.update(profileRef, { isModerationHidden: true, updatedAt: Date.now() });
          if (tagSnap.exists) {
            tx.update(tagRef, { isHidden: true });
          }
        });
        return res.status(200).json({ success: true });
      }

      if (action === 'restore') {
        await db.runTransaction(async (tx) => {
          const [profileSnap, tagSnap] = await Promise.all([tx.get(profileRef), tx.get(tagRef)]);
          if (!profileSnap.exists) throw new Error('not_found');
          const data = profileSnap.data()!;
          tx.update(profileRef, { isModerationHidden: false, updatedAt: Date.now() });
          if (tagSnap.exists) {
            // 復帰後の isModerationHidden は false 確定なので、タグの再表示は isPublished のみで決まる。
            tx.update(tagRef, { isHidden: !(data.isPublished === true) });
          }
        });
        return res.status(200).json({ success: true });
      }

      if (action === 'dismiss-one') {
        const reportId = req.query?.reportId;
        if (!reportId || typeof reportId !== 'string') {
          return res.status(400).json({ error: 'reportId required' });
        }
        const reportRef = profileRef.collection('reports').doc(reportId);
        const result = await db.runTransaction(async (tx) => {
          const [profileSnap, reportSnap] = await Promise.all([
            tx.get(profileRef),
            tx.get(reportRef),
          ]);
          if (!profileSnap.exists) throw new Error('not_found');
          if (!reportSnap.exists) throw new Error('report_not_found');
          const data = profileSnap.data() ?? {};
          const newCount = Math.max(0, (data.reportCount ?? 0) - 1);
          tx.delete(reportRef);
          tx.update(profileRef, { reportCount: newCount, updatedAt: Date.now() });
          return { reportCount: newCount };
        });
        return res.status(200).json({ success: true, reportCount: result.reportCount });
      }

      return res.status(400).json({ error: 'invalid_action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[admin/housinger-reports]', err);
    const msg = err?.message;
    if (msg === 'not_found' || msg === 'report_not_found') {
      return res.status(404).json({ error: msg });
    }
    return res.status(500).json({ error: msg || 'Internal error' });
  }
}
