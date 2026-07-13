/**
 * POST /api/housing?action=report-personal-tag
 *
 * 個人タグの通報 (軽量モデレーション、 計画書 Phase B-4)。
 * Body: { tagId, comment? }
 *  - 認証: Bearer (Firebase idToken) 必須
 *  - dedup: personal_tags/{tagId}/reports/{reporterUid} を doc ID = reporterUid にして
 *    「1 ユーザー 1 通報」を自然に強制 (既存なら 409 duplicate_report)
 *  - reportCount が REPORT_AUTO_HIDE_THRESHOLD に達したら isHidden=true (自動非表示)
 *  - NG ワード自動チェックは MVP に含めない (計画書で合意済み)
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { computePersonalTagReportOutcome } from '../../src/data/personalTags.js';
import { REPORT_AUTO_HIDE_THRESHOLD } from '../../src/constants/housing.js';

const COLLECTION = 'personal_tags';
const MAX_COMMENT_LENGTH = 500;

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
    const reporterUid = decoded.uid;

    const { tagId, comment } = req.body || {};
    if (!tagId || typeof tagId !== 'string') {
      return res.status(400).json({ error: 'invalid_tagId' });
    }

    const adminDb = getAdminFirestore();
    const tagRef = adminDb.collection(COLLECTION).doc(tagId);
    const reportRef = tagRef.collection('reports').doc(reporterUid);

    await adminDb.runTransaction(async (tx) => {
      const [tagSnap, reportSnap] = await Promise.all([tx.get(tagRef), tx.get(reportRef)]);
      if (!tagSnap.exists) throw new Error('not_found');
      const data = tagSnap.data()!;
      if (data.ownerUid === reporterUid) throw new Error('cannot_report_own');
      if (reportSnap.exists) throw new Error('duplicate_report');

      const { newCount, shouldHide } = computePersonalTagReportOutcome(
        data.reportCount || 0,
        REPORT_AUTO_HIDE_THRESHOLD,
      );

      tx.set(reportRef, {
        ...(comment ? { comment: String(comment).slice(0, MAX_COMMENT_LENGTH) } : {}),
        createdAt: Date.now(),
      });
      tx.update(tagRef, {
        reportCount: newCount,
        ...(shouldHide ? { isHidden: true } : {}),
      });
    });

    return res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('[housing/report-personal-tag] error:', error);
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'cannot_report_own') return res.status(403).json({ error: 'cannot_report_own' });
    if (error?.message === 'duplicate_report') return res.status(409).json({ error: 'duplicate_report' });
    return res.status(500).json({ error: 'Internal error' });
  }
}
