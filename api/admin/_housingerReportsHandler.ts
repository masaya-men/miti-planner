/**
 * ハウジンガープロフィール通報管理 API (spec 2026-07-10-housinger-profile-design.md §6.2)
 *
 * GET  ?resource=housinger_reports
 *      — 「通報あり (reportCount > 0)」 と 「強制非公開中 (isModerationHidden === true)」 の
 *        和集合を uid で重複排除して返す (通報数が多い順に最大 50 件)。
 *        2クエリ (それぞれ単一フィールド where) をメモリ内でマージするため複合インデックス不要。
 *        強制非公開後に通報が全部却下され reportCount=0 になっても一覧から消えないようにする
 *        (消えると /admin の復帰ボタンに二度と到達できず Firestore 直叩きでしか救済できなくなるため)。
 *      — 各プロフィールの reports サブコレクションも 20 件まで同梱 (reason/comment/createdAt)
 *      — reporterUid は管理者にも返さない (_housingReportsHandler.ts と同方針)
 * PATCH ?resource=housinger_reports&action=hide&uid=xxx
 *      — 強制非公開: isModerationHidden=true + 対応する personal_tags のタグも isHidden=true (同一 tx)。
 *        tagId は personalTagIdForUid(uid) で決め打ちせず、ownerUid==uid クエリ + resolvePersonalTagId
 *        で解決する (旧 create-personal-tag 経路の legacy slug ID のタグも取りこぼさない)。
 * PATCH ?resource=housinger_reports&action=restore&uid=xxx
 *      — 復帰: isModerationHidden=false。タグの isHidden は isPublished && !isModerationHidden で再計算 (同一 tx、tagId 解決は hide と同じ)
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
import { resolvePersonalTagId } from '../../src/lib/housing/housingerProfile.js';

const COLLECTION = 'housing_profiles';
const LIST_LIMIT = 50;

export interface ProfileRef {
  uid: string;
  reportCount: number;
}

/**
 * 「通報あり」 クエリと 「強制非公開中」 クエリの結果 (軽量な { uid, reportCount } の配列) を
 * uid で重複排除しつつ 1 本のリストにマージする純関数。
 * ソートは reportCount 降順 (通報0件の強制非公開プロフィールは末尾寄りになるが必ず含まれる)。
 * Firestore 側では複合インデックスが要る orderBy を使わないため、 ソートはここ (メモリ内) で行う。
 */
export function mergeReportedProfileRefs(
  reportedDocs: ProfileRef[],
  hiddenDocs: ProfileRef[],
  limit: number,
): ProfileRef[] {
  const seen = new Set<string>();
  const merged: ProfileRef[] = [];
  for (const doc of reportedDocs) {
    if (seen.has(doc.uid)) continue;
    seen.add(doc.uid);
    merged.push(doc);
  }
  for (const doc of hiddenDocs) {
    if (seen.has(doc.uid)) continue;
    seen.add(doc.uid);
    merged.push(doc);
  }
  merged.sort((a, b) => b.reportCount - a.reportCount);
  return merged.slice(0, limit);
}

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
      // 「通報あり」 と 「強制非公開中」 を別クエリで取得し (単一フィールド where のみ = 複合
      // インデックス不要)、 uid で重複排除してマージする。 強制非公開後に通報が全部却下されて
      // reportCount=0 になったプロフィールも一覧から消えず、 復帰ボタンに到達できるようにする。
      const [reportedSnap, hiddenSnap] = await Promise.all([
        db.collection(COLLECTION)
          .where('reportCount', '>', 0)
          .orderBy('reportCount', 'desc')
          .limit(LIST_LIMIT)
          .get(),
        db.collection(COLLECTION)
          .where('isModerationHidden', '==', true)
          .limit(LIST_LIMIT)
          .get(),
      ]);

      const docsByUid = new Map<string, (typeof reportedSnap.docs)[number]>();
      for (const d of [...reportedSnap.docs, ...hiddenSnap.docs]) {
        if (!docsByUid.has(d.id)) docsByUid.set(d.id, d);
      }

      const mergedRefs = mergeReportedProfileRefs(
        reportedSnap.docs.map((d) => ({ uid: d.id, reportCount: d.data().reportCount ?? 0 })),
        hiddenSnap.docs.map((d) => ({ uid: d.id, reportCount: d.data().reportCount ?? 0 })),
        LIST_LIMIT,
      );

      // 各プロフィールの reports サブコレクションを並列取得 (最新 20 件)。
      // reporterUid は API レスポンスに含めない (管理者 UI に出さない方針)。
      const profiles = await Promise.all(
        mergedRefs.map(async ({ uid }) => {
          const d = docsByUid.get(uid)!;
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
      const tagsCol = db.collection('personal_tags');

      if (action === 'hide') {
        await db.runTransaction(async (tx) => {
          // tagRef を personalTagIdForUid(uid) で直接組み立てると、旧 create-personal-tag 経路の
          // legacy slug ID (ownerUid==uid だが doc ID が canonical と異なる) のタグを取りこぼす
          // (ドキュメントが見つからず no-op になり、強制非公開にしたのにタグが検索可能なまま残る)。
          // upsert ハンドラ (_upsertHousingerProfileHandler.ts) と同じく ownerUid==uid で先にクエリし、
          // resolvePersonalTagId で実在する doc ID を解決する (tx 内は読み取り→書き込みの順を維持)。
          const [profileSnap, existingTagsSnap] = await Promise.all([
            tx.get(profileRef),
            tx.get(tagsCol.where('ownerUid', '==', uid).limit(5)),
          ]);
          if (!profileSnap.exists) throw new Error('not_found');
          tx.update(profileRef, { isModerationHidden: true, updatedAt: Date.now() });
          // admin 経路はタグドキュメントを新規作成しない (既存があるときのみ更新するガードを維持)。
          if (existingTagsSnap.docs.length > 0) {
            const tagId = resolvePersonalTagId(uid, existingTagsSnap.docs.map((d) => d.id));
            tx.update(tagsCol.doc(tagId), { isHidden: true });
          }
        });
        return res.status(200).json({ success: true });
      }

      if (action === 'restore') {
        await db.runTransaction(async (tx) => {
          const [profileSnap, existingTagsSnap] = await Promise.all([
            tx.get(profileRef),
            tx.get(tagsCol.where('ownerUid', '==', uid).limit(5)),
          ]);
          if (!profileSnap.exists) throw new Error('not_found');
          const data = profileSnap.data()!;
          tx.update(profileRef, { isModerationHidden: false, updatedAt: Date.now() });
          if (existingTagsSnap.docs.length > 0) {
            const tagId = resolvePersonalTagId(uid, existingTagsSnap.docs.map((d) => d.id));
            // 復帰後の isModerationHidden は false 確定なので、タグの再表示は isPublished のみで決まる。
            tx.update(tagsCol.doc(tagId), { isHidden: !(data.isPublished === true) });
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
