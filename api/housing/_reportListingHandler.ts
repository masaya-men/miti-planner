/**
 * POST /api/housing?action=report-listing
 *
 * ハウジング物件通報ハンドラ
 * Body: { listingId, reason, comment? }
 * 動作: transaction で reports/{auto-id} 作成 + reportCount +1 + 通知 doc 作成
 *       同一 reporterUid × listingId × reason の既存があれば 409
 *       reportCount >= REPORT_AUTO_HIDE_THRESHOLD で isHidden=true (自動非表示)
 * 通知側に reporterUid は書かない (家主に渡らない)
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { isValidReportReason } from '../../src/types/housing.js';
import { REPORT_AUTO_HIDE_THRESHOLD } from '../../src/constants/housing.js';

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

    const { listingId, reason, comment } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }
    if (!isValidReportReason(reason)) {
      return res.status(400).json({ error: 'invalid_reason' });
    }
    if (
      reason === 'other' &&
      (!comment || typeof comment !== 'string' || comment.trim().length === 0)
    ) {
      return res.status(400).json({ error: 'comment_required' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    // 重複チェック (transaction 外で軽く)
    const existing = await listingRef
      .collection('reports')
      .where('reporterUid', '==', reporterUid)
      .where('reason', '==', reason)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'duplicate_report' });
    }

    const severity = reason === 'griefing' || reason === 'nsfw' ? 'high' : 'normal';

    // 通報 doc の ID を transaction 前に確定 (notification doc から逆参照するため)
    const reportRef = listingRef.collection('reports').doc();

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid === reporterUid) throw new Error('cannot_report_own');
      if (data.deletedAt) throw new Error('not_found');

      // 2026-05-27 §3.8: reason=wrong_info かつ同 addressKey に他生存 listing あり
      // のときは閾値 1 (= 1 撃 hide)。 他 reason / 単独 listing は既存 3 維持。
      // Firestore composite index を避けるため addressKey 単一 equality + client filter。
      let threshold = REPORT_AUTO_HIDE_THRESHOLD;
      if (reason === 'wrong_info' && data.addressKey) {
        const duplicateSnap = await tx.get(
          adminDb
            .collection('housing_listings')
            .where('addressKey', '==', data.addressKey)
            .limit(10)
        );
        const hasDuplicates = duplicateSnap.docs.some((d) => {
          if (d.id === listingId) return false;
          const peer = d.data();
          return !peer.isHidden && !peer.deletedAt;
        });
        if (hasDuplicates) threshold = 1;
      }

      const newCount = (data.reportCount || 0) + 1;
      const shouldHide = newCount >= threshold && !data.isHidden;

      // 通報 doc 作成
      tx.set(reportRef, {
        reporterUid,
        reason,
        ...(comment ? { comment: String(comment).slice(0, 500) } : {}),
        createdAt: Date.now(),
      });

      // listing 更新
      tx.update(listingRef, {
        reportCount: newCount,
        ...(shouldHide ? { isHidden: true } : {}),
      });

      // 通知 doc 作成 (家主向け、 reporterUid は書かない)
      // 2026-05-26: 管理者が通報を却下した時に連動削除できるよう reportId を保持する。
      const notifRef = adminDb
        .collection('users')
        .doc(data.ownerUid)
        .collection('notifications')
        .doc();
      tx.set(notifRef, {
        type: 'housing_report',
        listingId,
        reportId: reportRef.id,
        reason,
        severity,
        ...(comment ? { comment: String(comment).slice(0, 500) } : {}),
        listingTitleSnapshot: data.description?.slice(0, 60) || data.addressKey,
        createdAt: Date.now(),
        read: false,
      });
    });

    return res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('[housing/report-listing] error:', error);
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'cannot_report_own')
      return res.status(403).json({ error: 'cannot_report_own' });
    return res.status(500).json({ error: 'Internal error' });
  }
}
