/**
 * cleanup-legacy-housing-tags.ts
 *
 * 2026-07-10 タグ体系刷新 (計画書: docs/superpowers/plans/2026-07-10-housing-tag-overhaul-plan.md A-4)。
 *
 * 背景: 旧タグレジストリ (6 カテゴリ約147種、 prefix なし id) を 公式23 + 季節12 + テーマ12 +
 *   個人タグの新レジストリに刷新した。 既存 housing_listings ドキュメントの `tags` フィールドに
 *   残る旧 id (例: 'modern', 'cafe', 'cherry_blossom' 等) は新レジストリに存在しないため、
 *   表示側は落ちないが (getTagById フォールバック済み) 検索/フィルタからは実質孤立する。
 *   α 公開時点の登録は全て本人テストデータのため、 破壊的にクリーンアップして良い
 *   (memory feedback_housing_data_disposable)。
 *
 * 触るもの: housing_listings コレクションの `tags` フィールドのみ。 他のコレクション
 *   (軽減表 = plans 等) には一切触れない。
 *
 * 動作: 各ドキュメントの tags 配列から isValidTagId (新レジストリ: 公式/季節/テーマ の
 *   静的 id、 または personal_ 形式) を満たさない要素を除去する。 0 件になっても許容
 *   (タグ optional 化済み、 2026-05-27)。
 *
 * 使い方:
 *   npx tsx scripts/cleanup-legacy-housing-tags.ts            # dry-run (既定・書き込みゼロ)
 *   npx tsx scripts/cleanup-legacy-housing-tags.ts --apply    # 本番に適用
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isValidTagId } from '../src/data/housingTags';

const APPLY = process.argv.includes('--apply');
const COLLECTION = 'housing_listings';

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
  console.error('❌ .env.local に FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY が必要');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

console.log(`=== housing_listings 旧タグクリーンアップ (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

const snap = await db.collection(COLLECTION).get();
console.log(`対象コレクション: ${COLLECTION} (${snap.size} 件走査)\n`);

let touchedDocs = 0;
let removedTagsTotal = 0;
const removedTagCounts = new Map<string, number>();
const batchOps: { id: string; before: string[]; after: string[] }[] = [];

for (const doc of snap.docs) {
  const data = doc.data();
  const tags: unknown = data.tags;
  if (!Array.isArray(tags) || tags.length === 0) continue;

  const before = tags as string[];
  const after = before.filter((id) => typeof id === 'string' && isValidTagId(id));
  const removed = before.filter((id) => !after.includes(id));

  if (removed.length > 0) {
    touchedDocs++;
    removedTagsTotal += removed.length;
    for (const id of removed) {
      removedTagCounts.set(id, (removedTagCounts.get(id) ?? 0) + 1);
    }
    batchOps.push({ id: doc.id, before, after });
  }
}

console.log(`【結果】 更新対象ドキュメント: ${touchedDocs} 件 / 除去タグ延べ: ${removedTagsTotal} 件\n`);

if (removedTagCounts.size > 0) {
  console.log('除去された旧タグ id の内訳 (多い順):');
  const sorted = [...removedTagCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [id, count] of sorted) {
    console.log(`  ${id}: ${count} 件`);
  }
  console.log('');
}

if (touchedDocs === 0) {
  console.log('旧タグを含むドキュメントはありません。何もせず終了します。');
  process.exit(0);
}

if (!APPLY) {
  console.log('🟢 DRY-RUN 完了。書き込みは行っていません。適用するには --apply を付けて再実行。');
  console.log('\n(サンプル、 最大 5 件)');
  for (const op of batchOps.slice(0, 5)) {
    console.log(`  ${op.id}: [${op.before.join(', ')}] → [${op.after.join(', ')}]`);
  }
  process.exit(0);
}

// Firestore バッチは 500 件/回制限。 500 件ごとに分割して commit する。
const CHUNK = 500;
for (let i = 0; i < batchOps.length; i += CHUNK) {
  const chunk = batchOps.slice(i, i + CHUNK);
  const batch = db.batch();
  for (const op of chunk) {
    batch.update(db.collection(COLLECTION).doc(op.id), { tags: op.after });
  }
  await batch.commit();
  console.log(`  commit: ${i + chunk.length} / ${batchOps.length}`);
}

console.log(`\n🔴 APPLY 完了: ${touchedDocs} 件のドキュメントの tags を更新しました。`);
