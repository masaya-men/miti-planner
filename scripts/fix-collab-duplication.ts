/**
 * fix-collab-duplication.ts
 * 列増殖バグで data.partyMembers/timelineMitigations/timelineEvents 等に
 * 同一 id が重複連結してしまったプランを、id 一意（最初の出現を残す）に修復する。
 * 既定は dry-run（読み取りのみ・Firestore に書き込まない）。
 * --apply を付けると実際に書き込む（本番データ修復時のみ使用・ユーザー承認必須）。
 *
 * 使い方:
 *   npx tsx scripts/fix-collab-duplication.ts [--apply] [titleSubstring]
 *
 * 例:
 *   npx tsx scripts/fix-collab-duplication.ts             # 全プラン dry-run
 *   npx tsx scripts/fix-collab-duplication.ts tesuto       # "tesuto" のみ dry-run
 *   npx tsx scripts/fix-collab-duplication.ts --apply      # 全プラン 書き込み（本番修復時）
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function loadEnv(p: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('FIREBASE 認証情報が .env.local にありません (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)');
  process.exit(1);
}

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
// --apply 以外の非フラグ引数をタイトル部分文字列とする
const titleSub = (
  process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) || ''
).toLowerCase();

/**
 * id フィールドを持つ配列を id 一意に絞る（最初の出現を残す）。
 * 重複ブロックは「元の正しい配列」が先頭にあり後ろにコピーが連なる構造なので、
 * 最初の出現を残すことで元データが復元される。
 */
function dedupeById<T extends Record<string, unknown>>(arr: T[]): {
  out: T[];
  removed: number;
} {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const id =
      x && typeof x === 'object' && 'id' in x ? String(x.id) : String(x);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(x);
  }
  return { out, removed: arr.length - out.length };
}

// 修復対象のキー（id を持つ配列フィールド）
const TARGET_KEYS = [
  'partyMembers',
  'timelineMitigations',
  'timelineEvents',
  'phases',
  'labels',
  'memos',
] as const;

async function main() {
  console.log(`モード: ${APPLY ? '★ APPLY（Firestore 書き込みあり）' : 'DRY-RUN（読み取りのみ）'}`);
  if (titleSub) console.log(`フィルタ: title に "${titleSub}" を含むプランのみ`);
  console.log('');

  const snap = await db.collection('plans').get();
  console.log(`plans 総数: ${snap.size}`);
  console.log('');

  let fixedCount = 0;

  for (const doc of snap.docs) {
    const docData = doc.data();

    // タイトルフィルタ
    if (titleSub && !String(docData.title || '').toLowerCase().includes(titleSub)) {
      continue;
    }

    const planData = docData.data || {};
    const update: Record<string, unknown> = {};
    let totalRemoved = 0;
    const detail: Record<string, string> = {};

    for (const key of TARGET_KEYS) {
      if (!Array.isArray(planData[key])) continue;
      const { out, removed } = dedupeById(
        planData[key] as Record<string, unknown>[],
      );
      if (removed > 0) {
        update[`data.${key}`] = out;
        totalRemoved += removed;
        detail[key] = `${planData[key].length} → ${out.length} (-${removed})`;
      }
    }

    if (totalRemoved > 0) {
      console.log(
        `${APPLY ? 'FIX' : 'DRY'} ${doc.id}  title="${docData.title}"  合計 -${totalRemoved} 要素`,
      );
      for (const [k, v] of Object.entries(detail)) {
        console.log(`  ${k}: ${v}`);
      }

      if (APPLY) {
        update['updatedAt'] = FieldValue.serverTimestamp();
        await doc.ref.update(update);
        console.log(`  → Firestore 書き込み完了`);
      }
      fixedCount++;
      console.log('');
    }
  }

  console.log(
    `\n${APPLY ? '修復完了' : 'dry-run 対象'}: ${fixedCount} プラン`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('エラー:', e);
    process.exit(1);
  });
