/**
 * seed-skills-stats.ts
 * mockData.ts, defaultStats.ts, levelModifiers.ts のデータを
 * Firestore の /master/skills と /master/stats に書き込む
 *
 * ⚠ 既定は ADDITIVE モード（既存データを絶対に上書きしない・追加のみ）。
 *   管理画面(Firestore)で編集した値が seed で巻き戻る事故を防ぐため。
 *
 * モード:
 * - 既定 (ADDITIVE): Firestore に存在する id の skill/job は一切変更しない。
 *   mockData にしか無い「新しい id」だけを追加する。stats/levelModifiers も既存優先。
 *   → 管理画面の編集は永久に安全。mockData は「新規スキルの種まき」専用。
 * - --force-overwrite: 旧挙動。mockData の値で既存skillを上書き（admin 追加分のみ保持）。
 *   mockData 側で意図的に既存skillを直したい開発者向け。実行前に必ず内容を理解すること。
 * - --dry-run: 書き込まず、何が変わるかだけ表示。
 *
 * 使い方:
 *   npx tsx scripts/seed-skills-stats.ts                 # 追加のみ(安全)
 *   npx tsx scripts/seed-skills-stats.ts --dry-run       # 確認のみ
 *   npx tsx scripts/seed-skills-stats.ts --force-overwrite --dry-run  # 上書き内容を確認
 *   npx tsx scripts/seed-skills-stats.ts --force-overwrite           # 既存も上書き
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { JOBS, MITIGATIONS, MITIGATION_DISPLAY_ORDER } from '../src/data/mockData';
import {
  DT_PATCH_STATS,
  EW_PATCH_STATS,
  SHB_PATCH_STATS,
  SB_PATCH_STATS,
} from '../src/data/defaultStats';
import { LEVEL_MODIFIERS } from '../src/data/levelModifiers';

// .env.local 読み込み
function loadEnv(filePath: string): Record<string, string> {
  const text = readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const FORCE = process.argv.includes('--force-overwrite');
const DRY = process.argv.includes('--dry-run');

console.log('✅ Firebase Admin 初期化完了');
console.log(`モード: ${FORCE ? '⚠ FORCE-OVERWRITE (既存skillも mockData の値で上書き)' : 'ADDITIVE (既存は保護・新規idのみ追加)'}${DRY ? ' [dry-run: 書き込まない]' : ''}`);

const DEFAULT_STATS_BY_LEVEL = { 100: '7.40', 90: '6.40', 80: '5.40', 70: '4.40' };
const mockPatchStats = { ...DT_PATCH_STATS, ...EW_PATCH_STATS, ...SHB_PATCH_STATS, ...SB_PATCH_STATS };

// 既存データ読み込み
const existingSkillsSnap = await db.doc('master/skills').get();
const existingSkills = existingSkillsSnap.exists ? existingSkillsSnap.data() : null;
const existingJobs: any[] = existingSkills?.jobs ?? [];
const existingMits: any[] = existingSkills?.mitigations ?? [];
const existingOrder: string[] = existingSkills?.displayOrder ?? [];

const existingStatsSnap = await db.doc('master/stats').get();
const existingStats = existingStatsSnap.exists ? existingStatsSnap.data() : null;
const existingPatchStats: Record<string, unknown> = existingStats?.patchStats ?? {};

let mergedJobs: any[];
let mergedMits: any[];
let mergedOrder: string[];
let mergedLevelMods: unknown;
let mergedPatch: Record<string, unknown>;
let mergedDefaults: unknown;

if (FORCE) {
  // 旧挙動: mockData が既存を上書き。admin 追加分(Firestoreのみのid)は保持。
  const mockJobIds = new Set(JOBS.map(j => j.id));
  const mockMitIds = new Set(MITIGATIONS.map(m => m.id));
  const mockOrderSet = new Set(MITIGATION_DISPLAY_ORDER);
  mergedJobs = [...JOBS, ...existingJobs.filter(j => !mockJobIds.has(j.id))];
  mergedMits = [...MITIGATIONS, ...existingMits.filter(m => !mockMitIds.has(m.id))];
  mergedOrder = [...MITIGATION_DISPLAY_ORDER, ...existingOrder.filter(id => !mockOrderSet.has(id))];
  mergedLevelMods = LEVEL_MODIFIERS;
  mergedPatch = { ...mockPatchStats, ...Object.fromEntries(Object.entries(existingPatchStats).filter(([k]) => !(k in mockPatchStats))) };
  mergedDefaults = DEFAULT_STATS_BY_LEVEL;
  const overwritten = MITIGATIONS.filter(m => existingMits.some(e => e.id === m.id)).length;
  console.log(`⚠ 既存 ${overwritten} skill を mockData 値で上書きします`);
} else {
  // ADDITIVE: 既存 id は一切触らず、mockData にしか無い「新規 id」だけ追加。
  const existingJobIds = new Set(existingJobs.map(j => j.id));
  const existingMitIds = new Set(existingMits.map(m => m.id));
  const addJobs = JOBS.filter(j => !existingJobIds.has(j.id));
  const addMits = MITIGATIONS.filter(m => !existingMitIds.has(m.id));
  const addOrder = MITIGATION_DISPLAY_ORDER.filter(id => !existingOrder.includes(id));
  mergedJobs = [...existingJobs, ...addJobs];
  mergedMits = [...existingMits, ...addMits];
  mergedOrder = [...existingOrder, ...addOrder];
  // stats は既存優先(初回のみ mockData を種まき)
  mergedLevelMods = existingStats?.levelModifiers ?? LEVEL_MODIFIERS;
  mergedPatch = { ...mockPatchStats, ...existingPatchStats }; // 既存が勝つ
  mergedDefaults = existingStats?.defaultStatsByLevel ?? DEFAULT_STATS_BY_LEVEL;
  console.log(`追加: jobs +${addJobs.length}, mitigations +${addMits.length}(新規id), displayOrder +${addOrder.length}`);
  if (addJobs.length) console.log(`  + jobs: ${addJobs.map(j => j.id).join(', ')}`);
  if (addMits.length) console.log(`  + skills: ${[...new Set(addMits.map(m => m.id))].join(', ')}`);
  if (!addJobs.length && !addMits.length && !addOrder.length) console.log('  (追加なし=Firestore は既に最新。既存値は無変更)');
}

if (DRY) {
  console.log(`\n[dry-run] 書き込みません。結果: jobs ${mergedJobs.length}, mitigations ${mergedMits.length}, displayOrder ${mergedOrder.length}`);
  process.exit(0);
}

await db.doc('master/skills').set({ jobs: mergedJobs, mitigations: mergedMits, displayOrder: mergedOrder });
console.log(`✅ /master/skills 書き込み完了 (jobs: ${mergedJobs.length}, mitigations: ${mergedMits.length})`);

await db.doc('master/stats').set({ levelModifiers: mergedLevelMods, patchStats: mergedPatch, defaultStatsByLevel: mergedDefaults });
console.log('✅ /master/stats 書き込み完了');

await db.doc('master/config').set({ dataVersion: FieldValue.increment(1) }, { merge: true });
console.log('✅ dataVersion インクリメント完了');

console.log('\n🎉 スキル・ステータスのシード完了！');
