/**
 * 人気プラン昇格API
 * POST /api/template/promote
 * body: { shareId, contentId, action: 'approve' | 'reject' }
 * 認証: Admin only
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../../src/lib/adminAuth.js';
import { writeAuditLog } from '../../../src/lib/auditLog.js';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../../src/lib/rateLimit.js';
import { sendDiscordNotification } from '../../../src/lib/discordWebhook.js';
import { FieldValue } from 'firebase-admin/firestore';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = ['https://lopoly.app', 'https://lopo-miti.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 10, 60_000))) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(403).json({ error: 'Unauthorized' });

    const { shareId, contentId, action } = req.body || {};
    if (!shareId || !contentId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'shareId, contentId, action (approve|reject) required' });
    }

    const db = getAdminFirestore();

    if (action === 'reject') {
      await db.doc(`shared_plans/${shareId}`).update({
        promotionCandidate: false,
        promotionRejectedAt: FieldValue.serverTimestamp(),
        promotionRejectedBy: adminUid,
      });
      await writeAuditLog({
        action: 'update',
        target: `promotion.reject.${shareId}`,
        adminUid,
        changes: { before: { promotionCandidate: true }, after: { promotionCandidate: false } },
      });
      return res.status(200).json({ success: true, action: 'rejected' });
    }

    // 承認: 共有プランのtimelineEventsをテンプレートに昇格
    const shareSnap = await db.doc(`shared_plans/${shareId}`).get();
    if (!shareSnap.exists) return res.status(404).json({ error: 'Shared plan not found' });
    const shareData = shareSnap.data()!;

    const planData = shareData.planData || shareData.plans?.[0]?.planData;
    if (!planData) return res.status(400).json({ error: 'No plan data in shared plan' });

    const timelineEvents = planData.timelineEvents || [];
    const phases = planData.phases || [];

    // 既存テンプレートのバックアップ
    const templateRef = db.doc(`templates/${contentId}`);
    const existing = await templateRef.get();
    if (existing.exists) {
      await db.collection('template_backups').doc(`template_${contentId}_${Date.now()}`).set({
        type: 'template',
        contentId,
        data: existing.data(),
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // テンプレート登録
    const templateData = {
      contentId,
      source: 'popular_plan',
      timelineEvents,
      phases,
      lockedAt: null,
      createdAt: existing.exists ? existing.data()!.createdAt : FieldValue.serverTimestamp(),
      lastUpdatedAt: FieldValue.serverTimestamp(),
      lastUpdatedBy: adminUid,
      candidateShareId: shareId,
    };

    await templateRef.set(templateData);
    await db.doc('master/config').set({ dataVersion: FieldValue.increment(1) }, { merge: true });

    await db.doc(`shared_plans/${shareId}`).update({
      promotionCandidate: false,
      promotedAt: FieldValue.serverTimestamp(),
      promotedBy: adminUid,
    });

    await writeAuditLog({
      action: 'create',
      target: `template.promoted.${contentId}`,
      adminUid,
      changes: { after: { ...templateData, lastUpdatedAt: '(serverTimestamp)' } },
    });

    await sendDiscordNotification({
      title: `✅ テンプレート昇格完了: ${contentId}`,
      description: `共有プラン ${shareId} からテンプレートに昇格されました`,
      color: 0x22c55e,
      fields: [
        { name: 'イベント数', value: `${timelineEvents.length}`, inline: true },
        { name: '承認者', value: adminUid, inline: true },
      ],
    });

    return res.status(201).json({ success: true, action: 'approved', contentId });
  } catch (err: any) {
    console.error('[promote] エラー:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
