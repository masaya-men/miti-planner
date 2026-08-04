/**
 * backfill-housinger-display-name-lower.ts
 *
 * 背景: 2026-08-04 のハウジンガー名検索 ownerUid ベース化 (計画書:
 * docs/superpowers/plans/2026-08-04-housing-tag-search-by-owner.md Task 3) で、
 * housing_profiles/{uid} に displayNameLower フィールドを新設した
 * (api/housing/_upsertHousingerProfileHandler.ts が upsert-housinger-profile 実行時に書き込む)。
 * しかしこの書き込みはユーザーがマイページで明示的に保存した時、 または
 * useAccountActions.ts の syncHousingerProfileBestEffort() (改名・アバター変更後) が
 * 発火した時にしか走らない。 ログイン・ページ表示だけでは走らないため、 このブランチ以前に
 * 公開済みだった housing_profiles ドキュメントには displayNameLower が一切存在しない。
 *
 * Firestore の orderBy(field) は「そのフィールドを持たないドキュメント」をクエリ結果から
 * 除外する。 このブランチで追加した以下 2 つの読み取り経路はどちらも
 * orderBy('displayNameLower') を使うため、 このバックフィルを行わずにデプロイすると
 * 既存の公開済みハウジンガー全員が両方の機能から一時的に消える
 * (本人が改名・アバター変更等で再保存するまで自然回復しない):
 *   - src/lib/housing/publishedHousingers.ts (listPublishedHousingers、 タグ検索の
 *     「ハウジンガー」チップ一覧)
 *   - api/housing/_searchHousingersHandler.ts (search-housingers、 ヘッダー検索窓のサジェスト)
 *
 * これは今回のブランチの目的 (ハウジンガー名検索を直す) を初日から破壊するため、
 * **フロントエンド/API コードのデプロイより前に、 このスクリプトの --apply を必ず実行すること**
 * (実行順序の詳細: docs/superpowers/plans/2026-08-04-housing-tag-search-by-owner.md
 *  「全タスク完了後の最終チェックリスト」)。
 *
 * 触るもの: housing_profiles コレクションの `displayNameLower` フィールドのみ。 他のフィールド・
 *   他のコレクションには一切書き込まない (読み取りのみ)。
 *
 * 動作:
 *   1. housing_profiles の全ドキュメントを取得する (このコレクションが巨大化することは想定しない)。
 *   2. 各ドキュメントについて、 displayNameLower が欠落しているか、
 *      normalizeDisplayNameForSearch(displayName) の現在の計算結果と異なる場合を更新対象とする
 *      (欠落が主目的だが、 過去の表記ゆれ等のドリフトも同時に自己修復する)。
 *   3. displayName が文字列でない (壊れた) ドキュメントはスキップし、 件数のみ報告する。
 *
 * 使い方:
 *   npx tsx scripts/backfill-housinger-display-name-lower.ts            # dry-run (既定・書き込みゼロ)
 *   npx tsx scripts/backfill-housinger-display-name-lower.ts --apply    # 本番に適用
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizeDisplayNameForSearch } from '../src/data/personalTags';

const APPLY = process.argv.includes('--apply');
const COLLECTION = 'housing_profiles';

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

console.log(`=== housing_profiles displayNameLower バックフィル (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

const snap = await db.collection(COLLECTION).get();
console.log(`対象コレクション: ${COLLECTION} (${snap.size} 件走査)\n`);

type UpdateOp = { uid: string; displayName: string; before: string | undefined; after: string };
const updates: UpdateOp[] = [];
let skippedInvalidCount = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  const displayName: unknown = data.displayName;
  if (typeof displayName !== 'string' || !displayName) {
    skippedInvalidCount++;
    console.log(`  ⚠ ${doc.id}: displayName が不正 (スキップ)`);
    continue;
  }

  const before = typeof data.displayNameLower === 'string' ? data.displayNameLower : undefined;
  const after = normalizeDisplayNameForSearch(displayName);
  if (before !== after) {
    updates.push({ uid: doc.id, displayName, before, after });
  }
}

console.log(`\n【結果】 走査: ${snap.size} 件 / 更新対象: ${updates.length} 件 / displayName不正でスキップ: ${skippedInvalidCount} 件\n`);

if (updates.length === 0) {
  console.log('更新対象はありません。何もせず終了します。');
  process.exit(0);
}

if (!APPLY) {
  console.log('🟢 DRY-RUN 完了。書き込みは行っていません。適用するには --apply を付けて再実行。');
  console.log('\n(サンプル、 最大 5 件)');
  for (const op of updates.slice(0, 5)) {
    console.log(`  ${op.uid}: displayName="${op.displayName}" / displayNameLower ${op.before ?? '(未設定)'} → ${op.after}`);
  }
  process.exit(0);
}

// Firestore バッチは 500 件/回制限。 500 件ごとに分割して commit する。
const CHUNK = 500;
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK);
  const batch = db.batch();
  for (const op of chunk) {
    batch.update(db.collection(COLLECTION).doc(op.uid), { displayNameLower: op.after });
  }
  await batch.commit();
  console.log(`  commit: ${i + chunk.length} / ${updates.length}`);
}

console.log(`\n🔴 APPLY 完了: ${updates.length} 件の housing_profiles.displayNameLower を更新しました。`);
