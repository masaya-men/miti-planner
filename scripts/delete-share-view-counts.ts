/**
 * delete-share-view-counts.ts
 *
 * 共有(shared_plans)の閲覧数の名残を消す一回きりの script。
 * 閲覧数の加算は 2026-11-05 に撤去済み(api/share/_getShare.ts・持ち主承認)で、viewCount / viewers を
 * 読む所はコードに無い。残っているデータを片付ける。
 *
 * 触るもの: shared_plans/{id}/viewers サブコレクションの doc(削除)と、shared_plans/{id} の viewCount
 * フィールド(フィールドだけ削除・共有本体は残す)。ほかのコレクション・フィールドは触らない。
 *
 * 使い方:
 *   npx tsx scripts/delete-share-view-counts.ts            # dry-run (既定・数えるだけ・書き込みゼロ)
 *   npx tsx scripts/delete-share-view-counts.ts --apply    # 消す(1 回の実行で書き込み 500 件まで)
 * 残りがあれば、残り 0 件と出るまで --apply をくり返す。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const COLLECTION = 'shared_plans';
const SUB = 'viewers';
/** 1 回の実行での書き込み上限(Firestore の 1 batch の上限と同じ)。 */
const MAX_WRITES = 500;

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

/** viewers は collectionGroup で拾うので、親が shared_plans の物だけに絞る。 */
function isShareViewer(ref: FirebaseFirestore.DocumentReference): boolean {
  return ref.parent.id === SUB && ref.parent.parent?.parent.id === COLLECTION;
}

/** viewCount フィールドを持つ共有(orderBy はそのフィールドがある doc だけを返す)。 */
const withViewCount = () => db.collection(COLLECTION).orderBy('viewCount');
const viewersGroup = () => db.collectionGroup(SUB);

async function countRemaining(): Promise<{ viewers: number; viewCount: number }> {
  // count() 集計は読み取り 1000 件ごとに 1 回分の課金で済む(doc を読まない)。
  // viewers の collectionGroup には shared_plans 以外の同名サブコレクションが含まれうるが、
  // 現状コードに他の viewers は無い(2026-11-05 grep 確認)。消す時は親を確かめてから消す。
  const [v, c] = await Promise.all([viewersGroup().count().get(), withViewCount().count().get()]);
  return { viewers: v.data().count, viewCount: c.data().count };
}

console.log(`=== 共有の閲覧数の名残を消す (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

const before = await countRemaining();
console.log(`対象: ${COLLECTION}/*/${SUB} = ${before.viewers} 件 / viewCount を持つ ${COLLECTION} = ${before.viewCount} 件\n`);

if (before.viewers === 0 && before.viewCount === 0) {
  console.log('消す物はありません。終了します。');
  process.exit(0);
}

if (!APPLY) {
  console.log('🟢 DRY-RUN 完了。書き込みは行っていません。消すには --apply を付けて再実行。');
  console.log(`(1 回の --apply で書き込み ${MAX_WRITES} 件まで。全部消すには約 ${Math.ceil((before.viewers + before.viewCount) / MAX_WRITES)} 回)`);
  process.exit(0);
}

const batch = db.batch();
let viewerDeletes = 0;
let fieldDeletes = 0;
let skippedOther = 0;

// 先に viewers(数が多い方)を消す。select() で中身を読まず ref だけ取る。
const viewerSnap = await viewersGroup().select().limit(MAX_WRITES).get();
for (const doc of viewerSnap.docs) {
  if (!isShareViewer(doc.ref)) { skippedOther++; continue; }
  batch.delete(doc.ref);
  viewerDeletes++;
}

const room = MAX_WRITES - viewerDeletes;
if (room > 0) {
  const shareSnap = await withViewCount().select().limit(room).get();
  for (const doc of shareSnap.docs) {
    batch.update(doc.ref, { viewCount: FieldValue.delete() });
    fieldDeletes++;
  }
}

if (viewerDeletes + fieldDeletes > 0) await batch.commit();
console.log(`🔴 消した: viewers ${viewerDeletes} 件 / viewCount フィールド ${fieldDeletes} 件(書き込み計 ${viewerDeletes + fieldDeletes} 件)`);
if (skippedOther > 0) console.log(`⚠ shared_plans 以外の viewers ${skippedOther} 件は触らずに飛ばした`);

const after = await countRemaining();
console.log(`\n残り: viewers ${after.viewers} 件 / viewCount を持つ共有 ${after.viewCount} 件`);
if (after.viewers + after.viewCount > 0) console.log('→ 残りがあるので --apply をもう一度実行する。');
process.exit(0);
