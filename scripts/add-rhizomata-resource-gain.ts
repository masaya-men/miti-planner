/**
 * add-rhizomata-resource-gain.ts (外科的アップデート)
 * Firestore /master/skills.mitigations の rhizomata にだけ
 * resourceGain: { type: 'addersgall', amount: 1 } を付ける。
 * 他のフィールド・他スキル・jobs/displayOrder は一切変更しない。
 * 最後に dataVersion を +1 してクライアントに再取得させる。
 *
 * 背景: 2026-08-19にリゾーマタを追加した際「消費しないマーカー」として実装したため、
 * アダーガルゲージ計算(getAddersgallStacks)に一切反映されていなかった不具合の修正
 * (resourceTracker.ts 側は既にコード修正・デプロイ済み、これはFirestoreデータ側の反映)。
 *
 * 使い方:
 *   npx tsx scripts/add-rhizomata-resource-gain.ts          # dry-run(差分表示のみ)
 *   npx tsx scripts/add-rhizomata-resource-gain.ts --apply  # 実書き込み
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

const APPLY = process.argv.includes('--apply');
const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));
const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const snap = await db.doc('master/skills').get();
if (!snap.exists) { console.error('master/skills が存在しません'); process.exit(1); }
const data = snap.data()!;
const mits: any[] = data.mitigations ?? [];

const GAIN = { type: 'addersgall', amount: 1 };

const willUpdate: string[] = [];
const updated = mits.map((m) => {
  if (m.id === 'rhizomata' && JSON.stringify(m.resourceGain) !== JSON.stringify(GAIN)) {
    willUpdate.push(m.id);
    return { ...m, resourceGain: GAIN };
  }
  return m;
});

console.log(`対象(resourceGain を付ける): ${willUpdate.length} 件`);
console.log(willUpdate.join(', ') || '(なし=既に設定済み)');

// 念のため: rhizomata 以外に誤って触っていないか
const changedIds = updated.filter((m, i) => m !== mits[i]).map(m => m.id);
const unexpected = changedIds.filter(id => !willUpdate.includes(id));
if (unexpected.length) {
  console.error('❌ 想定外の変更検出、中止:', unexpected.join(', '));
  process.exit(1);
}

if (!APPLY) {
  console.log('\n(dry-run) 実書き込みは --apply を付けて再実行');
  process.exit(0);
}

await db.doc('master/skills').set({
  jobs: data.jobs ?? [],
  mitigations: updated,
  displayOrder: data.displayOrder ?? [],
});
await db.doc('master/config').set({ dataVersion: FieldValue.increment(1) }, { merge: true });
console.log(`\n✅ 書き込み完了 (${willUpdate.length} 件に resourceGain 追加) + dataVersion +1`);
