/**
 * テンプレート管理API — マスターデータ更新(PUT type=config / skills / servers / stats)
 */
import { FieldValue } from 'firebase-admin/firestore';
import { writeAuditLog } from '../../src/lib/auditLog.js';
import { sendDiscordNotification } from '../../src/lib/discordWebhook.js';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';
import { bumpDataVersion } from './_templatesShared.js';

/** スキル差分比較で使う項目だけの型 */
interface MitigationLike {
  value?: unknown;
  duration?: unknown;
  recast?: unknown;
}

export async function handleConfigPut(
  req: ApiRequest,
  res: ApiResponse,
  db: FirebaseFirestore.Firestore,
  adminUid: string,
) {
  const configRef = db.doc('master/config');
  const updates = req.body;
  const allowed = ['featureFlags', 'newListingWindowDays'];
  const filtered: Record<string, unknown> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }
  // newListingWindowDays: 1〜90の整数のみ許可 (2026-08-16、ハウジング探すページのNEW表示日数)。
  if (filtered.newListingWindowDays !== undefined) {
    const days = filtered.newListingWindowDays as number;
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      return res.status(400).json({ error: 'newListingWindowDays must be an integer between 1 and 90' });
    }
  }
  if (Object.keys(filtered).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  const before = (await configRef.get()).data() || {};
  await configRef.set(filtered, { merge: true });
  await writeAuditLog({ action: 'update', target: 'config', adminUid, changes: { before, after: filtered } });
  return res.status(200).json({ success: true });
}

export async function handleSkillsPut(
  req: ApiRequest,
  res: ApiResponse,
  db: FirebaseFirestore.Firestore,
  adminUid: string,
) {
  const { jobs, mitigations, displayOrder } = req.body;
  if (!Array.isArray(jobs) || !Array.isArray(mitigations) || !Array.isArray(displayOrder)) {
    return res.status(400).json({ error: 'jobs, mitigations, displayOrder arrays are required' });
  }

  const skillsRef = db.doc('master/skills');
  const current = await skillsRef.get();
  if (current.exists) {
    await db.collection('master_backups').doc(`skills_${Date.now()}`).set({
      type: 'skills',
      data: current.data(),
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 差分検出（ユーザー向け通知用）
  const prevData = current.exists ? current.data()! : { jobs: [], mitigations: [] };
  const prevJobs = prevData.jobs || [];
  const prevMits = prevData.mitigations || [];

  // 新規ジョブ
  const prevJobIds = new Set(prevJobs.map((j) => j.id));
  const newJobs = jobs.filter((j) => !prevJobIds.has(j.id));

  // 新規スキル
  const prevMitIds = new Set(prevMits.map((m) => m.id));
  const newMits = mitigations.filter((m) => !prevMitIds.has(m.id));

  // 値が変わったスキル
  const prevMitMap = new Map<string, MitigationLike>(prevMits.map((m) => [m.id, m]));
  const changedMits = mitigations.filter((m) => {
    const prev = prevMitMap.get(m.id);
    if (!prev) return false;
    return m.value !== prev.value || m.duration !== prev.duration || m.recast !== prev.recast;
  });

  await skillsRef.set({ jobs, mitigations, displayOrder });
  await bumpDataVersion(db);
  await writeAuditLog({
    action: 'update',
    target: 'skills',
    adminUid,
    changes: { after: { jobCount: jobs.length, mitigationCount: mitigations.length } },
  });

  // ユーザー向けDiscord通知（変更があった場合のみ）
  const lines: string[] = [];
  for (const j of newJobs) {
    lines.push(`🆕 ジョブ追加: **${j.name?.ja || j.id}**`);
  }
  for (const m of newMits) {
    lines.push(`🆕 スキル追加: **${m.name?.ja || m.id}**`);
  }
  for (const m of changedMits) {
    const prev = prevMitMap.get(m.id);
    const diffs: string[] = [];
    if (m.value !== prev.value) diffs.push(`軽減率 ${prev.value}%→${m.value}%`);
    if (m.duration !== prev.duration) diffs.push(`効果時間 ${prev.duration}s→${m.duration}s`);
    if (m.recast !== prev.recast) diffs.push(`リキャスト ${prev.recast}s→${m.recast}s`);
    lines.push(`📝 **${m.name?.ja || m.id}** — ${diffs.join('、')}`);
  }
  if (lines.length > 0) {
    sendDiscordNotification({
      title: '⚔️ スキルデータ更新',
      description: lines.join('\n'),
      color: 0x000000,
    });
  }

  return res.status(200).json({ success: true });
}

export async function handleServersPut(
  req: ApiRequest,
  res: ApiResponse,
  db: FirebaseFirestore.Firestore,
  adminUid: string,
) {
  const docRef = db.doc('master/servers');
  // バックアップ
  const current = await docRef.get();
  if (current.exists) {
    await db.collection('master_backups').doc(`servers_${Date.now()}`).set({
      type: 'servers',
      data: current.data(),
      createdAt: FieldValue.serverTimestamp(),
    });
  }
   
  const { type: _, ...serversData } = req.body;
  // 許可するフィールドのみ保存（任意フィールド混入防止）
  const allowedFields = ['dataCenters', 'dataVersion'];
  const filtered: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in serversData) filtered[key] = serversData[key];
  }
  await docRef.set(filtered);
  await bumpDataVersion(db);
  await writeAuditLog({
    action: 'update',
    target: 'servers',
    adminUid,
    changes: {},
  });

  return res.status(200).json({ success: true });
}

export async function handleStatsPut(
  req: ApiRequest,
  res: ApiResponse,
  db: FirebaseFirestore.Firestore,
  adminUid: string,
) {
  const { levelModifiers, patchStats, defaultStatsByLevel } = req.body;
  if (!levelModifiers || !patchStats || !defaultStatsByLevel) {
    return res.status(400).json({ error: 'levelModifiers, patchStats, defaultStatsByLevel are required' });
  }

  const statsRef = db.doc('master/stats');
  const current = await statsRef.get();
  if (current.exists) {
    await db.collection('master_backups').doc(`stats_${Date.now()}`).set({
      type: 'stats',
      data: current.data(),
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 新規パッチの検出
  const prevPatches = current.exists ? Object.keys((current.data() as FirebaseFirestore.DocumentData)?.patchStats || {}) : [];
  const newPatches = Object.keys(patchStats).filter((p: string) => !prevPatches.includes(p));

  await statsRef.set({ levelModifiers, patchStats, defaultStatsByLevel });
  await bumpDataVersion(db);
  await writeAuditLog({
    action: 'update',
    target: 'stats',
    adminUid,
    changes: {},
  });

  // ユーザー向けDiscord通知（新パッチ追加時のみ）
  if (newPatches.length > 0) {
    sendDiscordNotification({
      title: '📊 ステータスデータ更新',
      description: `パッチ ${newPatches.join(', ')} のデフォルトステータスが追加されました`,
      color: 0x000000,
    });
  }

  return res.status(200).json({ success: true });
}
