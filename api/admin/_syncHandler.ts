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

    // /master/skills スマートマージ書き込み
    // - JOBS / MITIGATIONS: mockData.ts の値を反映、 ただし Firestore のみに存在する admin 追加分は保持
    // - displayOrder: mockData.ts の順序を底に、 Firestore のみの id を末尾追加
    const existingSkillsSnap = await db.doc('master/skills').get();
    const existingSkills = existingSkillsSnap.exists ? existingSkillsSnap.data() : null;
    const existingJobs: any[] = existingSkills?.jobs ?? [];
    const existingMits: any[] = existingSkills?.mitigations ?? [];
    const existingOrder: string[] = existingSkills?.displayOrder ?? [];

    const mockJobIds = new Set(JOBS.map((j) => j.id));
    const mockMitIds = new Set(MITIGATIONS.map((m) => m.id));
    const mockOrderSet = new Set(MITIGATION_DISPLAY_ORDER);

    const firestoreOnlyJobs = existingJobs.filter((j: any) => !mockJobIds.has(j.id));
    const firestoreOnlyMits = existingMits.filter((m: any) => !mockMitIds.has(m.id));
    const firestoreOnlyOrder = existingOrder.filter((id: string) => !mockOrderSet.has(id));

    const mergedJobs = [...JOBS, ...firestoreOnlyJobs];
    const mergedMits = [...MITIGATIONS, ...firestoreOnlyMits];
    const mergedOrder = [...MITIGATION_DISPLAY_ORDER, ...firestoreOnlyOrder];

    await db.doc('master/skills').set({
      jobs: mergedJobs,
      mitigations: mergedMits,
      displayOrder: mergedOrder,
    });

    // /master/stats 書き込み (patchStats のみスマートマージ、 admin 追加した patch を保持)
    const existingStatsSnap = await db.doc('master/stats').get();
    const existingStats = existingStatsSnap.exists ? existingStatsSnap.data() : null;
    const existingPatchStats: Record<string, unknown> = existingStats?.patchStats ?? {};

    const mockPatchStats = {
      ...DT_PATCH_STATS,
      ...EW_PATCH_STATS,
      ...SHB_PATCH_STATS,
      ...SB_PATCH_STATS,
    };
    const mockPatchKeys = new Set(Object.keys(mockPatchStats));
    // Firestore にしかない patch を抽出
    const firestoreOnlyPatches: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(existingPatchStats)) {
      if (!mockPatchKeys.has(k)) firestoreOnlyPatches[k] = v;
    }

    await db.doc('master/stats').set({
      levelModifiers: LEVEL_MODIFIERS,
      patchStats: { ...mockPatchStats, ...firestoreOnlyPatches },
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
    await writeAuditLog({
      action: 'update',
      target: 'skills',
      adminUid,
      changes: {
        after: {
          type: 'sync_from_source_smart_merge',
          mockJobs: JOBS.length,
          mockMitigations: MITIGATIONS.length,
          preservedJobs: firestoreOnlyJobs.length,
          preservedMitigations: firestoreOnlyMits.length,
          preservedPatchStats: Object.keys(firestoreOnlyPatches).length,
          finalJobs: mergedJobs.length,
          finalMitigations: mergedMits.length,
        },
      },
    });

    // Discord通知
    await sendDiscordNotification({
      title: 'スキル・ステータス同期',
      description: `ソースコードからFirestoreへ同期しました（ジョブ ${mergedJobs.length} = mockData ${JOBS.length} + 保持 ${firestoreOnlyJobs.length}, スキル ${mergedMits.length} = mockData ${MITIGATIONS.length} + 保持 ${firestoreOnlyMits.length}）`,
      color: 0x3b82f6,
    });

    return res.status(200).json({
      ok: true,
      jobs: mergedJobs.length,
      mitigations: mergedMits.length,
      preservedJobs: firestoreOnlyJobs.length,
      preservedMitigations: firestoreOnlyMits.length,
      preservedPatchStats: Object.keys(firestoreOnlyPatches).length,
    });
  } catch (err: any) {
    console.error('[sync] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
