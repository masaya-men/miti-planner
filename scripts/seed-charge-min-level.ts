/**
 * seed-charge-min-level.ts
 *
 * 既存スキルの `chargeMinLevel`(レベル連動チャージのゲート)だけを
 * Firestore /master/skills に狙い撃ちで反映する。
 *
 * ⚠ seed-skills-stats.ts の --force-overwrite(168件全上書き=管理画面の手編集を巻き戻すリスク)は使わず、
 *   対象スキルの該当フィールドだけを read-modify-write で追加する。他スキル・他フィールドは完全に無変更。
 *
 * 既定は dry-run(書き込まない)。実際に書き込むには --commit を付ける。
 *
 * 使い方:
 *   npx tsx scripts/seed-charge-min-level.ts            # dry-run(差分表示のみ)
 *   npx tsx scripts/seed-charge-min-level.ts --commit   # 書き込み + dataVersion++
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// 反映する対象(公式: Enhanced 特性で Lv88 にチャージ化)
const TARGETS: Record<string, number> = {
  divine_benison: 88,
  celestial_intersection: 88,
};

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

const COMMIT = process.argv.includes('--commit');
console.log(`モード: ${COMMIT ? '⚠ COMMIT(書き込む)' : 'dry-run(書き込まない)'}`);

const snap = await db.doc('master/skills').get();
if (!snap.exists) {
  console.error('❌ master/skills が存在しません');
  process.exit(1);
}
const data = snap.data() as { mitigations: Array<Record<string, unknown>>; [k: string]: unknown };
const mits = data.mitigations ?? [];

const changes: string[] = [];
for (const m of mits) {
  const id = m.id as string;
  if (id in TARGETS && m.chargeMinLevel !== TARGETS[id]) {
    changes.push(`${id}: chargeMinLevel ${m.chargeMinLevel ?? '(なし)'} → ${TARGETS[id]}`);
    if (COMMIT) m.chargeMinLevel = TARGETS[id];
  }
}

// 対象が Firestore に存在したかの健全性チェック
for (const id of Object.keys(TARGETS)) {
  if (!mits.some(m => m.id === id)) console.warn(`⚠ 対象 id "${id}" が master/skills に見つかりません`);
}

if (changes.length === 0) {
  console.log('変更なし(既に chargeMinLevel が反映済み)。');
  process.exit(0);
}
console.log('差分:');
for (const c of changes) console.log('  - ' + c);

if (!COMMIT) {
  console.log('\n[dry-run] 書き込みません。--commit で反映します。');
  process.exit(0);
}

// 読み出した data をそのまま書き戻す(対象2スキルの chargeMinLevel だけ追加・他は無変更)
await db.doc('master/skills').set(data);
await db.doc('master/config').set({ dataVersion: FieldValue.increment(1) }, { merge: true });
console.log('✅ master/skills 更新 + dataVersion++ 完了');
