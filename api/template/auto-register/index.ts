/**
 * テンプレート自動登録API
 * POST /api/template/auto-register
 *
 * FFLogsインポート成功後にクライアントから呼ばれる。
 * 品質チェックを通過したログのみテンプレートとして登録する。
 */
import { initAdmin, getAdminFirestore } from '../../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../../src/lib/rateLimit.js';
import { writeAuditLog } from '../../../src/lib/auditLog.js';
import { sendDiscordNotification } from '../../../src/lib/discordWebhook.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// 品質チェックの閾値
const MIN_EVENT_COUNT: Record<string, number> = {
  savage: 15,
  ultimate: 30,
  default: 10,
};

// 発見フェーズの期間
const DISCOVERY_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

interface AutoRegisterBody {
  contentId: string;
  category: string;
  timelineEvents: any[];
  phases: any[];
  kill: boolean;
  deathCount: number;
  sourceReport: string;
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!applyRateLimit(req, res, 5, 60_000)) return;

  try {
    initAdmin();

    // Firebase Auth（管理者不要・ログイン済みユーザーであればOK）
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const body = req.body as AutoRegisterBody;
    if (!body.contentId || !Array.isArray(body.timelineEvents)) {
      return res.status(400).json({ error: 'contentId and timelineEvents are required' });
    }

    // timelineEventsの各要素を検証（最低限の型チェック）
    const isValidEvent = (e: any) =>
      e && typeof e === 'object' && typeof e.time === 'number' && typeof e.name === 'string';
    if (!body.timelineEvents.every(isValidEvent)) {
      return res.status(400).json({ error: 'Invalid timelineEvents format' });
    }
    // イベント数上限（異常な大量データ防止）
    if (body.timelineEvents.length > 500) {
      return res.status(400).json({ error: 'Too many timeline events' });
    }

    const db = getAdminFirestore();
    const minEvents = MIN_EVENT_COUNT[body.category] || MIN_EVENT_COUNT.default;

    // 品質チェック
    if (!body.kill) return res.status(200).json({ registered: false, reason: 'not_a_kill' });
    if (body.deathCount > 0) return res.status(200).json({ registered: false, reason: 'has_deaths' });
    if (body.timelineEvents.length < minEvents) {
      return res.status(200).json({ registered: false, reason: 'too_few_events', minimum: minEvents });
    }

    // 既存テンプレートの確認
    const templateRef = db.doc(`templates/${body.contentId}`);
    const existing = await templateRef.get();

    if (existing.exists) {
      const data = existing.data()!;

      // ロック済みの場合は登録しない
      if (data.lockedAt) {
        return res.status(200).json({ registered: false, reason: 'template_locked' });
      }

      const createdAt = data.createdAt?.toMillis?.() || data.createdAt || 0;
      const isDiscoveryPhase = (Date.now() - createdAt) < DISCOVERY_PERIOD_MS;

      // 発見フェーズ終了後は自動ロック
      if (!isDiscoveryPhase) {
        await templateRef.update({ lockedAt: FieldValue.serverTimestamp() });
        return res.status(200).json({ registered: false, reason: 'auto_locked' });
      }

      // 既存の方がイベント数が多い場合は更新しない
      const existingEventCount = Array.isArray(data.timelineEvents) ? data.timelineEvents.length : 0;
      if (body.timelineEvents.length <= existingEventCount) {
        return res.status(200).json({ registered: false, reason: 'existing_is_better' });
      }

      // 上書き前にバックアップを作成
      await db.collection('template_backups').doc(`template_${body.contentId}_${Date.now()}`).set({
        type: 'template',
        contentId: body.contentId,
        data,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // テンプレートの登録・更新
    const templateData = {
      contentId: body.contentId,
      source: 'fflogs_import',
      timelineEvents: body.timelineEvents,
      phases: body.phases || [],
      lockedAt: null,
      createdAt: existing.exists ? existing.data()!.createdAt : FieldValue.serverTimestamp(),
      lastUpdatedAt: FieldValue.serverTimestamp(),
      lastUpdatedBy: 'auto',
      sourceReport: body.sourceReport,
      candidateShareId: null,
    };

    await templateRef.set(templateData);
    await db.doc('master/config').set({ dataVersion: FieldValue.increment(1) }, { merge: true });

    // 監査ログの記録
    await writeAuditLog({
      action: existing.exists ? 'update' : 'create',
      target: `template.${body.contentId}`,
      adminUid: `auto:${uid}`,
      changes: {
        before: existing.exists ? existing.data() : undefined,
        after: { ...templateData, lastUpdatedAt: '(serverTimestamp)' },
      },
    });

    // Discord通知
    await sendDiscordNotification({
      title: existing.exists
        ? `📋 テンプレート自動更新: ${body.contentId}`
        : `🆕 テンプレート自動登録: ${body.contentId}`,
      description: `FFLogsインポートから${existing.exists ? '更新' : '新規登録'}されました`,
      color: 0x4ade80,
      fields: [
        { name: 'イベント数', value: `${body.timelineEvents.length}`, inline: true },
        { name: 'フェーズ数', value: `${(body.phases || []).length}`, inline: true },
        { name: 'ソース', value: body.sourceReport || '不明', inline: true },
      ],
    });

    return res.status(201).json({
      registered: true,
      isNew: !existing.exists,
      contentId: body.contentId,
    });
  } catch (err: any) {
    console.error('[auto-register] エラー:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
