/**
 * POST /api/housing?action=resolve-report
 *
 * 家主が自分の物件への通報を「対処済み」 にして非表示を自己解除する。
 * Body: { listingId }
 *  - 認証: Bearer (Firebase Web SDK の現在ユーザー idToken) + ownerUid 認可
 *  - 動作 (transaction):
 *      1. 物件が自分のもので未削除か確認
 *      2. 既に非表示 かつ restoreCount >= MAX_SELF_RESTORE なら 403 escalation_required
 *         (= いたずら登録 + 却下連打での占有を防ぐ。 以降は Discord 異議 = 管理者対応)
 *      3. reports サブコレクションを全削除、 reportCount=0・isHidden=false に戻す
 *         非表示からの復帰時のみ restoreCount を +1
 *  - 「これは誤り (却下)」 と 「編集して修正」 の両方から呼ぶ
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { MAX_SELF_RESTORE } from '../../src/constants/housing.js';
import { bumpPublicVersionBatch } from './_publicVersion.js';

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
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    const snap = await listingRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });
    const data = snap.data()!;
    if (data.deletedAt) return res.status(404).json({ error: 'not_found' });
    if (data.ownerUid !== uid) return res.status(403).json({ error: 'forbidden' });

    const wasHidden = data.isHidden === true;
    const restoreCount = data.restoreCount || 0;
    if (wasHidden && restoreCount >= MAX_SELF_RESTORE) {
      // 自己復帰の上限。 以降は管理者対応 (Discord 異議)。
      return res.status(403).json({ error: 'escalation_required' });
    }

    // reports サブコレクションを削除 (再通報の重複判定もリセット) しつつ listing を復帰
    const reports = await listingRef.collection('reports').get();
    const batch = adminDb.batch();
    reports.docs.forEach((d) => batch.delete(d.ref));
    batch.update(listingRef, {
      isHidden: false,
      reportCount: 0,
      restoreCount: restoreCount + (wasHidden ? 1 : 0),
    });
    bumpPublicVersionBatch(batch, adminDb);
    await batch.commit();

    return res.status(200).json({ success: true, restored: wasHidden });
  } catch (error: any) {
    console.error('[housing/resolve-report] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
