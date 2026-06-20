/**
 * sync-walking-dead-duration.ts
 * mockData の walkingDeadDuration を Firestore /master/skills の該当 mitigation に
 * 「そのフィールドだけ」外科的に同期する。他のフィールド・他のスキルには一切触れない。
 *
 * リビングデッド(二段階無敵)機能の本番有効化に使用。
 * --force-overwrite(全スキル上書き)を避け、admin 編集を巻き戻すリスクをゼロにするための専用ツール。
 *
 * 使い方:
 *   npx tsx scripts/sync-walking-dead-duration.ts --dry-run   # 変更内容を確認(書き込まない)
 *   npx tsx scripts/sync-walking-dead-duration.ts             # 書き込み + dataVersion++
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { MITIGATIONS } from '../src/data/mockData';

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

const DRY = process.argv.includes('--dry-run');

// mockData で walkingDeadDuration を持つスキルの { id -> 値 }
const wanted = new Map<string, number>();
for (const m of MITIGATIONS) {
  if (typeof m.walkingDeadDuration === 'number') wanted.set(m.id, m.walkingDeadDuration);
}
console.log(`対象スキル(mockData で walkingDeadDuration 保有): ${[...wanted.entries()].map(([id, v]) => `${id}=${v}`).join(', ') || '(なし)'}`);

const snap = await db.doc('master/skills').get();
if (!snap.exists) {
  console.error('❌ master/skills が存在しません');
  process.exit(1);
}
const data = snap.data()!;
const mits: any[] = Array.isArray(data.mitigations) ? data.mitigations : [];

const changes: string[] = [];
for (const m of mits) {
  if (!wanted.has(m.id)) continue;
  const target = wanted.get(m.id)!;
  const current = m.walkingDeadDuration;
  if (current === target) continue; // 既に一致 → 触らない
  changes.push(`  ${m.id}: ${current === undefined ? '(なし)' : current} → ${target}`);
  if (!DRY) m.walkingDeadDuration = target;
}

if (changes.length === 0) {
  console.log('✅ 変更なし(Firestore は既に最新)。');
  process.exit(0);
}

console.log(`変更 ${changes.length} 件:`);
console.log(changes.join('\n'));

if (DRY) {
  console.log('\n[dry-run] 書き込みません。');
  process.exit(0);
}

// mitigations 配列のみ更新(merge で他フィールド=jobs/displayOrder は保持)
await db.doc('master/skills').set({ mitigations: mits }, { merge: true });
console.log('✅ /master/skills の mitigations を更新(walkingDeadDuration のみ・他フィールドは merge 保持)');

await db.doc('master/config').set({ dataVersion: FieldValue.increment(1) }, { merge: true });
console.log('✅ dataVersion インクリメント完了');

console.log('\n🎉 walkingDeadDuration 同期完了！');
