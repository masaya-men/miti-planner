/**
 * POST /api/housing?action=report-housinger
 *
 * ハウジンガー公開プロフィールの通報 (spec 2026-07-10-housinger-profile-design.md §6.2)。
 * Body: { housingerUid, reason, comment? }
 * 動作: housing_profiles/{housingerUid}/reports/{auto-id} に
 *       { reporterUid, reason, comment?, createdAt } を作成 + reportCount +1 (transaction)。
 *       同一 reporterUid × reason の既存があれば 409 duplicate_report。
 *       自己通報 (housingerUid === reporterUid) は 403 cannot_report_own。
 * §6.2 により listing 通報と異なり以下は行わない:
 *  - 閾値到達での自動非表示 (isModerationHidden は運営の明示判断のみ。強制非公開は /admin から)
 *  - 被通報者への通知作成
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import {
  isValidHousingerReportReason,
  type HousingerReportReason,
} from '../../src/lib/housing/housingerProfile.js';

const MAX_COMMENT_LENGTH = 500;

export function validateReportHousingerBody(body: any):
  | { ok: true; housingerUid: string; reason: HousingerReportReason; comment?: string }
  | { ok: false; error: 'invalid_housingerUid' | 'invalid_reason' | 'comment_required' } {
  const { housingerUid, reason, comment } = body || {};
  if (!housingerUid || typeof housingerUid !== 'string') {
    return { ok: false, error: 'invalid_housingerUid' };
  }
  if (!isValidHousingerReportReason(reason)) {
    return { ok: false, error: 'invalid_reason' };
  }
  if (
    reason === 'other' &&
    (!comment || typeof comment !== 'string' || comment.trim().length === 0)
  ) {
    return { ok: false, error: 'comment_required' };
  }
  return { ok: true, housingerUid, reason, comment };
}

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

    const v = validateReportHousingerBody(req.body);
    // 'error' in v で失敗バリアントへ narrow する(`!v.ok` の boolean discriminant narrow は
    // @vercel/node の strictNullChecks-off ビルドでは効かないため。_upsertHousingerProfileHandler.ts と同じ対処)。
    if ('error' in v) return res.status(400).json({ error: v.error });
    const { housingerUid, reason, comment } = v;

    // housingerUid = housing_profiles のドキュメント ID そのもの。
    // listing 通報と異なりドキュメントを読まなくても自己通報が判定できる (uid 直比較)。
    if (housingerUid === reporterUid) {
      return res.status(403).json({ error: 'cannot_report_own' });
    }

    const adminDb = getAdminFirestore();
    const profileRef = adminDb.collection('housing_profiles').doc(housingerUid);

    // 重複チェック (transaction 外で軽く。 _reportListingHandler.ts と同形)
    const existing = await profileRef
      .collection('reports')
      .where('reporterUid', '==', reporterUid)
      .where('reason', '==', reason)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'duplicate_report' });
    }

    const reportRef = profileRef.collection('reports').doc();

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(profileRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;

      tx.set(reportRef, {
        reporterUid,
        reason,
        ...(comment ? { comment: String(comment).slice(0, MAX_COMMENT_LENGTH) } : {}),
        createdAt: Date.now(),
      });
      tx.update(profileRef, {
        reportCount: (data.reportCount || 0) + 1,
      });
    });

    return res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('[housing/report-housinger] error:', error);
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    return res.status(500).json({ error: 'Internal error' });
  }
}
