/**
 * seed-skills-stats.ts
 * mockData.ts, defaultStats.ts, levelModifiers.ts のデータを
 * Firestore の /master/skills と /master/stats にマージ書き込みする
 *
 * マージ方式:
 * - mockData.tsのスキルは追加/更新される（IDで照合）
 * - 管理画面から追加されたFirestoreのみのスキルは保持される
 * - displayOrderはmockData.tsの値で上書き（表示順はコードで管理）
 * - jobs, statsは完全上書き（管理画面からの変更なし前提）
 *
 * 使い方: npx tsx scripts/seed-skills-stats.ts
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

console.log('✅ Firebase Admin 初期化完了');

// /master/skills スマートマージ書き込み
// - JOBS / MITIGATIONS は mockData.ts の値を反映、 Firestore のみに存在する admin 追加分は保持
// - displayOrder も同様 (mockData の順序を底にして Firestore のみの id を末尾追加)
const existingSkillsSnap = await db.doc('master/skills').get();
const existingSkills = existingSkillsSnap.exists ? existingSkillsSnap.data() : null;
const existingJobs: any[] = existingSkills?.jobs ?? [];
const existingMits: any[] = existingSkills?.mitigations ?? [];
const existingOrder: string[] = existingSkills?.displayOrder ?? [];

const mockJobIds = new Set(JOBS.map(j => j.id));
const mockMitIds = new Set(MITIGATIONS.map(m => m.id));
const mockOrderSet = new Set(MITIGATION_DISPLAY_ORDER);

const firestoreOnlyJobs = existingJobs.filter((j: any) => !mockJobIds.has(j.id));
const firestoreOnlyMits = existingMits.filter((m: any) => !mockMitIds.has(m.id));
const firestoreOnlyOrder = existingOrder.filter((id: string) => !mockOrderSet.has(id));

if (firestoreOnlyJobs.length > 0) {
  console.log(`📌 Firestore のみの jobs を保持: ${firestoreOnlyJobs.map((j: any) => j.id).join(', ')}`);
}
if (firestoreOnlyMits.length > 0) {
  console.log(`📌 Firestore のみの mitigations を保持: ${firestoreOnlyMits.map((m: any) => m.id).join(', ')}`);
}

const mergedJobs = [...JOBS, ...firestoreOnlyJobs];
const mergedMits = [...MITIGATIONS, ...firestoreOnlyMits];
const mergedOrder = [...MITIGATION_DISPLAY_ORDER, ...firestoreOnlyOrder];

await db.doc('master/skills').set({
  jobs: mergedJobs,
  mitigations: mergedMits,
  displayOrder: mergedOrder,
});
console.log(`✅ /master/skills 書き込み完了 (jobs: ${mergedJobs.length}, mitigations: ${mergedMits.length})`);

// /master/stats — patchStats のみスマートマージ (admin で追加した patch を保持)
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
const firestoreOnlyPatches: Record<string, unknown> = {};
for (const [k, v] of Object.entries(existingPatchStats)) {
  if (!mockPatchKeys.has(k)) firestoreOnlyPatches[k] = v;
}
if (Object.keys(firestoreOnlyPatches).length > 0) {
  console.log(`📌 Firestore のみの patchStats を保持: ${Object.keys(firestoreOnlyPatches).join(', ')}`);
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
console.log('✅ /master/stats 書き込み完了');

// dataVersion を+1
await db.doc('master/config').set(
  { dataVersion: FieldValue.increment(1) },
  { merge: true },
);
console.log('✅ dataVersion インクリメント完了');

console.log('\n🎉 スキル・ステータスのシード完了！');
