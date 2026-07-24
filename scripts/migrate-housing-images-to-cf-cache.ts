/**
 * scripts/migrate-housing-images-to-cf-cache.ts
 *
 * housing_listings の imageMode='thumbnail' な物件の thumbnailPaths / thumbnailPath を、
 * 旧形式URL (firebasestorage.googleapis.com) から新形式URL (lopoly.app/housing-media/...) へ
 * 書き換える。URL変換規則は api/housing/_imageArrayLogic.ts の
 * buildHousingImagePublicUrl / parseStoragePathFromPublicUrl と同一 (2026-07-24 設計)。
 *
 * 安全設計:
 * - Storageファイルは一切触らない (削除・移動しない)。旧URLは書き換え後も有効なまま。
 * - --dry-run (既定): 新URLを計算し実際にHTTPで検証するだけ。Firestoreへの書き込みなし。
 * - --commit: 1件ずつ「新URLが正しく画像を返すことを確認 → その1件だけ書き込み」を行う。
 *   既に新形式になっている件は自動スキップする (再実行安全・冪等)。
 *
 * 使い方:
 *   npx tsx scripts/migrate-housing-images-to-cf-cache.ts             (ドライラン)
 *   npx tsx scripts/migrate-housing-images-to-cf-cache.ts --commit    (本実行)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  buildHousingMediaUrl,
  extractHousingMediaFilenameFromOldUrl,
  readThumbnailPaths,
} from '../src/lib/housing/housingMediaUrl.js';

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

/**
 * 新URLがHTTP的に解決し、かつ実際に画像を返すことを検証する。res.ok だけを見ると、
 * 万一 Vercel の /housing-media/* リライトが機能していない場合に vercel.json 末尾の
 * catch-all (`/(.*) → /index.html`) が拾って 200 (HTMLページ) を返してしまい、
 * 「検証OK」と誤判定してしまう。content-type が image/ で始まることまで確認する。
 */
async function verifyUrlResolves(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') ?? '';
    return contentType.startsWith('image/');
  } catch {
    return false;
  }
}

async function main() {
  console.log(COMMIT ? '=== 本実行モード (Firestoreに書き込みます) ===' : '=== ドライランモード (書き込みなし) ===');

  const snap = await db.collection('housing_listings').where('imageMode', '==', 'thumbnail').get();
  console.log(`対象候補: ${snap.size}件 (imageMode='thumbnail')`);

  let alreadyMigrated = 0;
  let migrated = 0;
  let failed = 0;
  let skippedNoOldUrl = 0;
  let skippedConcurrentEdit = 0;

  for (const doc of snap.docs) {
    const listingId = doc.id;
    // 想定外の例外 (壊れたデータ等) がこの1件を落としても他件の処理を止めない。
    try {
      const data = doc.data();
      const thumbnailPaths = readThumbnailPaths(data);

      if (thumbnailPaths.length === 0) {
        skippedNoOldUrl++;
        continue;
      }

      // 既に全部新形式なら完全スキップ (冪等性)
      const allAlreadyNew = thumbnailPaths.every((u) => !u || u.startsWith('https://lopoly.app/housing-media/'));
      if (allAlreadyNew) {
        alreadyMigrated++;
        continue;
      }

      const newPaths: string[] = [];
      let listingOk = true;
      for (const oldUrl of thumbnailPaths) {
        if (!oldUrl) {
          newPaths.push(oldUrl);
          continue;
        }
        if (oldUrl.startsWith('https://lopoly.app/housing-media/')) {
          newPaths.push(oldUrl); // 既に新形式
          continue;
        }
        const filename = extractHousingMediaFilenameFromOldUrl(oldUrl, listingId);
        if (!filename) {
          console.error(`  ⚠ ${listingId}: 旧URL形式を解析できず (skip): ${oldUrl}`);
          listingOk = false;
          break;
        }
        const newUrl = buildHousingMediaUrl(listingId, filename);
        // HTTP検証はトランザクション外 (時間がかかるため、外部呼び出しをtx内に入れない)。
        const resolves = await verifyUrlResolves(newUrl);
        if (!resolves) {
          console.error(`  ⚠ ${listingId}: 新URLが解決しない (skip): ${newUrl}`);
          listingOk = false;
          break;
        }
        newPaths.push(newUrl);
      }

      if (!listingOk) {
        failed++;
        continue;
      }

      console.log(`  ✅ ${listingId}: ${thumbnailPaths.length}枚 検証OK${COMMIT ? ' → 書き込み中' : ' (dry-run)'}`);

      if (COMMIT) {
        const docRef = db.collection('housing_listings').doc(listingId);
        try {
          // HTTP検証(時間がかかる)は完了済み。書き込み直前にドキュメントを再読み込みし、
          // 最初にこのスクリプトが読んだ時点の値と完全一致する場合のみ書き込む。
          // その間にアプリ本体側で編集(追加/削除/並び替え等)があれば一致せず、
          // 古いスナップショットで上書きしてしまうのを防ぐためスキップする。
          const applied = await db.runTransaction(async (tx) => {
            const freshSnap = await tx.get(docRef);
            const freshPaths = readThumbnailPaths(freshSnap.data() ?? {});
            const unchanged =
              freshPaths.length === thumbnailPaths.length &&
              freshPaths.every((v, i) => v === thumbnailPaths[i]);
            if (!unchanged) return false;
            tx.update(docRef, {
              thumbnailPaths: newPaths,
              thumbnailPath: newPaths[0] ?? null,
              updatedAt: Date.now(),
            });
            // 他の全書き込みハンドラー (_uploadThumbnailHandler.ts 等) と同様、公開一覧APIの
            // 長期キャッシュ (s-maxage=86400) を新版番号へ即時追従させるため、本体書き込みと
            // 同じtransaction内で housing_meta/public.version を +1 する (bumpPublicVersionTx と
            // 同一ロジック。import はモジュール解決の都合で使わず、Task4の他ロジックと同様に
            // このスクリプト内に直接実装する)。
            tx.set(db.doc('housing_meta/public'), { version: FieldValue.increment(1) }, { merge: true });
            return true;
          });
          if (!applied) {
            console.error(`  ⏭ ${listingId}: 書き込み直前に他の編集を検知 (skip・次回再実行時に処理されます)`);
            skippedConcurrentEdit++;
            continue;
          }
        } catch (e) {
          console.error(`  ❌ ${listingId}: Firestore書き込み失敗:`, e);
          failed++;
          continue;
        }
      }
      migrated++;
    } catch (e) {
      console.error(`  ❌ ${listingId}: 想定外のエラーで失敗 (skip):`, e);
      failed++;
      continue;
    }
  }

  console.log('\n=== 結果 ===');
  console.log(`移行対象として処理: ${migrated}件`);
  console.log(`既に新形式でスキップ: ${alreadyMigrated}件`);
  console.log(`画像なしでスキップ: ${skippedNoOldUrl}件`);
  console.log(`書き込み直前の競合でスキップ: ${skippedConcurrentEdit}件`);
  console.log(`検証失敗: ${failed}件`);
  if (!COMMIT) {
    console.log('\nドライランでした。問題なければ --commit を付けて再実行してください。');
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ 致命的エラー:', e);
  process.exit(1);
});
