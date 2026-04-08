/**
 * スキル・ステータス同期API ハンドラー
 * POST — mockData.ts / defaultStats.ts / levelModifiers.ts のデータを Firestore に書き込む
 *
 * seedスクリプト (scripts/seed-skills-stats.ts) と同じ処理をAPI経由で実行する
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { writeAuditLog } from '../../src/lib/auditLog.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { sendDiscordNotification } from '../../src/lib/discordWebhook.js';
import { FieldValue } from 'firebase-admin/firestore';
import { JOBS, MITIGATIONS, MITIGATION_DISPLAY_ORDER } from '../../src/data/mockData.js';
import {
  DT_PATCH_STATS,
  EW_PATCH_STATS,
  SHB_PATCH_STATS,
  SB_PATCH_STATS,
} from '../../src/data/defaultStats.js';
import { LEVEL_MODIFIERS } from '../../src/data/levelModifiers.js';

/** CORS設定 */
function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // App Check検証
  if (!(await verifyAppCheck(req, res))) return;

  // レート制限（5回/分 — 頻繁に叩く操作ではない）
  if (!(await applyRateLimit(req, res, 5, 60_000))) return;

  try {
    initAdmin();

    // 管理者認証
    const adminUid = await verifyAdmin(req);
    if (!adminUid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const db = getAdminFirestore();

    // /master/skills 書き込み
    await db.doc('master/skills').set({
      jobs: JOBS,
      mitigations: MITIGATIONS,
      displayOrder: MITIGATION_DISPLAY_ORDER,
    });

    // /master/stats 書き込み
    await db.doc('master/stats').set({
      levelModifiers: LEVEL_MODIFIERS,
      patchStats: {
        ...DT_PATCH_STATS,
        ...EW_PATCH_STATS,
        ...SHB_PATCH_STATS,
        ...SB_PATCH_STATS,
      },
      defaultStatsByLevel: {
        100: '7.40',
        90: '6.40',
        80: '5.40',
        70: '4.40',
      },
    });

    // dataVersion を+1
    await db.doc('master/config').set(
      { dataVersion: FieldValue.increment(1) },
      { merge: true },
    );

    // 監査ログ
    await writeAuditLog(db, {
      action: 'update',
      target: 'skills',
      adminUid,
      changes: {
        type: 'sync_from_source',
        jobs: JOBS.length,
        mitigations: MITIGATIONS.length,
      },
    });

    // Discord通知
    await sendDiscordNotification({
      title: 'スキル・ステータス同期',
      description: `ソースコードからFirestoreへ同期しました（jobs: ${JOBS.length}, mitigations: ${MITIGATIONS.length}）`,
      color: 0x3b82f6,
    });

    return res.status(200).json({
      ok: true,
      jobs: JOBS.length,
      mitigations: MITIGATIONS.length,
    });
  } catch (err: any) {
    console.error('[sync] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
