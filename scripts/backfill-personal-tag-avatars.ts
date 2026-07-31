/**
 * backfill-personal-tag-avatars.ts
 *
 * 背景: personal_tags ドキュメントに avatarUrl フィールドを新設した
 * (api/housing/_upsertHousingerProfileHandler.ts が upsert-housinger-profile 実行時に
 * users/{uid}.avatarUrl をデノーマライズしてコピーする)。 しかし新設前に作成された既存の
 * personal_tags ドキュメントには avatarUrl が入っていないため、 ハウジンガーが次にマイページを
 * 開いて upsert-housinger-profile が実行されるまでアバターがイニシャルのフォールバック表示の
 * ままになる。 これを待たずに今すぐ反映するためのバックフィルスクリプト。
 *
 * 触るもの: personal_tags コレクションの avatarUrl フィールドのみ。 他のフィールド・他の
 *   コレクション (users / housing_profiles 等) には一切書き込まない (読み取りのみ)。
 *
 * 動作:
 *   1. personal_tags の全ドキュメントを取得する。
 *   2. 各ドキュメントの ownerUid から users/{ownerUid} を読み、 avatarUrl を取得する。
 *   3. タグドキュメントの現在の avatarUrl と異なる場合のみ更新対象とする。
 *   4. owner (users/{ownerUid}) が見つからない場合はスキップし、 未発見件数としてカウントする。
 *
 * 使い方:
 *   npx tsx scripts/backfill-personal-tag-avatars.ts            # dry-run (既定・書き込みゼロ)
 *   npx tsx scripts/backfill-personal-tag-avatars.ts --apply    # 本番に適用
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const TAGS_COLLECTION = 'personal_tags';
const USERS_COLLECTION = 'users';

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

console.log(`=== personal_tags avatarUrl バックフィル (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

const tagsSnap = await db.collection(TAGS_COLLECTION).get();
console.log(`対象コレクション: ${TAGS_COLLECTION} (${tagsSnap.size} 件走査)\n`);

type UpdateOp = { tagId: string; ownerUid: string; before: string | null; after: string | null };
const updates: UpdateOp[] = [];
let ownerNotFoundCount = 0;

// users/{ownerUid} の読み込みをキャッシュ (同一ユーザーが複数タグを持つことは無い想定だが念のため)
const userAvatarCache = new Map<string, string | null | undefined>(); // undefined = 未発見

for (const tagDoc of tagsSnap.docs) {
  const data = tagDoc.data();
  const ownerUid: unknown = data.ownerUid;
  if (typeof ownerUid !== 'string' || !ownerUid) {
    console.log(`  ⚠ ${tagDoc.id}: ownerUid が不正 (スキップ)`);
    continue;
  }

  let avatarUrl = userAvatarCache.get(ownerUid);
  if (avatarUrl === undefined && !userAvatarCache.has(ownerUid)) {
    const userSnap = await db.collection(USERS_COLLECTION).doc(ownerUid).get();
    if (!userSnap.exists) {
      userAvatarCache.set(ownerUid, undefined);
      avatarUrl = undefined;
    } else {
      const userData = userSnap.data()!;
      avatarUrl = (userData.avatarUrl ?? null) as string | null;
      userAvatarCache.set(ownerUid, avatarUrl);
    }
  }

  if (avatarUrl === undefined) {
    ownerNotFoundCount++;
    console.log(`  ⚠ ${tagDoc.id}: owner (users/${ownerUid}) が見つかりません (スキップ)`);
    continue;
  }

  const before = (data.avatarUrl ?? null) as string | null;
  const after = avatarUrl;
  if (before !== after) {
    updates.push({ tagId: tagDoc.id, ownerUid, before, after });
  }
}

console.log(`\n【結果】 走査: ${tagsSnap.size} 件 / 更新対象: ${updates.length} 件 / owner未発見: ${ownerNotFoundCount} 件\n`);

if (updates.length > 0) {
  console.log('更新内容 (最大 20 件表示):');
  for (const op of updates.slice(0, 20)) {
    console.log(`  ${op.tagId} (owner=${op.ownerUid}): ${op.before ?? '(none)'} → ${op.after ?? '(none)'}`);
  }
  if (updates.length > 20) {
    console.log(`  ... 他 ${updates.length - 20} 件`);
  }
  console.log('');
}

if (updates.length === 0) {
  console.log('更新対象はありません。何もせず終了します。');
  process.exit(0);
}

if (!APPLY) {
  console.log('🟢 DRY-RUN 完了。書き込みは行っていません。適用するには --apply を付けて再実行。');
  process.exit(0);
}

// Firestore バッチは 500 件/回制限。 500 件ごとに分割して commit する。
const CHUNK = 500;
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK);
  const batch = db.batch();
  for (const op of chunk) {
    batch.update(db.collection(TAGS_COLLECTION).doc(op.tagId), { avatarUrl: op.after });
  }
  await batch.commit();
  console.log(`  commit: ${i + chunk.length} / ${updates.length}`);
}

console.log(`\n🔴 APPLY 完了: ${updates.length} 件の personal_tags.avatarUrl を更新しました。`);
