/**
 * seed-skills-stats.ts
 * mockData.ts, defaultStats.ts, levelModifiers.ts のデータを
 * Firestore の /master/skills と /master/stats に書き込む
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

// /master/skills
const skillsDoc = {
  jobs: JOBS,
  mitigations: MITIGATIONS,
  displayOrder: MITIGATION_DISPLAY_ORDER,
};
await db.doc('master/skills').set(skillsDoc);
console.log(`✅ /master/skills 書き込み完了 (jobs: ${JOBS.length}, mitigations: ${MITIGATIONS.length})`);

// /master/stats
const statsDoc = {
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
};
await db.doc('master/stats').set(statsDoc);
console.log('✅ /master/stats 書き込み完了');

// dataVersion を+1
await db.doc('master/config').set(
  { dataVersion: FieldValue.increment(1) },
  { merge: true },
);
console.log('✅ dataVersion インクリメント完了');

console.log('\n🎉 スキル・ステータスのシード完了！');
