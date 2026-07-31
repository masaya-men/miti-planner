/**
 * scripts/backfill-listing-thumbnail-png.ts
 *
 * 背景: 物件写真の直接アップロード (imageMode='thumbnail') はブラウザ側でWebP優先圧縮
 * されるが、OGPカード生成 (satori) はWebP/AVIF非対応で、代表作が黙って読み飛ばされる
 * (2026-07-31 実機で発覚)。2026-07-31 以降のアップロードは api/housing/_uploadThumbnailHandler.ts
 * が .png 兄弟ファイルを自動で並行保存するようになったが、それより前にアップロード済みの
 * 既存画像には .png 版が無い。このスクリプトで既存の thumbnailPaths を一括変換する。
 *
 * 設計: Firestoreスキーマは変更しない。PNG版は同じディレクトリ・同じファイル名で拡張子だけ
 * .png に変えた「兄弟ファイル」として保存する (api/housing/_imageArrayLogic.ts の
 * toPngSiblingPath と同じ命名規則)。OGP生成側 (api/share/_housingerPageHandler.ts) は
 * 常にこの兄弟パスを優先して参照するため、ここでファイルさえ用意すればよい。
 *
 * 対象: imageMode='thumbnail' な全listingの thumbnailPaths 配列内の全画像
 * (代表作=先頭だけでなく全スロット。並び替えで別の画像が代表作に繰り上がっても
 * 既に変換済みにしておくため)。
 *
 * 触るもの: Storage内の .png 兄弟ファイルの新規作成のみ。元のWebP/AVIFファイルも
 * Firestoreのどのフィールドも一切変更しない。
 *
 * 使い方:
 *   npx tsx scripts/backfill-listing-thumbnail-png.ts            # dry-run (既定・書き込みゼロ)
 *   npx tsx scripts/backfill-listing-thumbnail-png.ts --apply    # 本番に適用
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { convertToPngIfNeeded, LISTING_THUMBNAIL_PNG_MAX_DIMENSION } from '../api/housing/_imageFormatConvert.js';
import { parseStoragePathFromPublicUrl, toPngSiblingPath } from '../api/housing/_imageArrayLogic.js';

const APPLY = process.argv.includes('--apply');
const LISTING_COLLECTION = 'housing_listings';

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

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  storageBucket: env.FIREBASE_STORAGE_BUCKET || 'lopo-7793e.firebasestorage.app',
});
const db = getFirestore();
const bucket = getStorage().bucket();

console.log(`=== 物件サムネ .png 兄弟ファイル バックフィル (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

function mimeFromExt(path: string): string | null {
  if (/\.webp$/i.test(path)) return 'image/webp';
  if (/\.avif$/i.test(path)) return 'image/avif';
  return null;
}

async function main() {
  const snap = await db.collection(LISTING_COLLECTION).where('imageMode', '==', 'thumbnail').get();
  console.log(`対象候補: ${snap.size}件 (imageMode='thumbnail')\n`);

  let imagesSeen = 0;
  let alreadyDone = 0;
  let skippedNotWebp = 0;
  let skippedUnparsable = 0;
  let skippedSourceMissing = 0;
  let converted = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const listingId = doc.id;
    const data = doc.data();
    const urls: string[] = Array.isArray(data.thumbnailPaths)
      ? data.thumbnailPaths.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
      : typeof data.thumbnailPath === 'string' && data.thumbnailPath
        ? [data.thumbnailPath]
        : [];

    for (const url of urls) {
      imagesSeen++;
      const mimeType = mimeFromExt(url);
      if (!mimeType) {
        skippedNotWebp++;
        continue;
      }

      const srcPath = parseStoragePathFromPublicUrl(url);
      if (!srcPath) {
        console.error(`  ⚠ ${listingId}: URL解析不能 (skip): ${url}`);
        skippedUnparsable++;
        continue;
      }
      const pngPath = toPngSiblingPath(srcPath);

      try {
        const pngFile = bucket.file(pngPath);
        const [pngExists] = await pngFile.exists();
        if (pngExists) {
          alreadyDone++;
          continue;
        }

        const srcFile = bucket.file(srcPath);
        const [srcExists] = await srcFile.exists();
        if (!srcExists) {
          console.error(`  ⚠ ${listingId}: 元ファイルが存在しない (skip): ${srcPath}`);
          skippedSourceMissing++;
          continue;
        }

        const [buf] = await srcFile.download();
        const pngBuf = await convertToPngIfNeeded(buf, mimeType, { maxDimension: LISTING_THUMBNAIL_PNG_MAX_DIMENSION });
        if (!pngBuf) {
          console.error(`  ⚠ ${listingId}: PNG変換に失敗 (skip): ${srcPath}`);
          failed++;
          continue;
        }

        console.log(
          `  ✅ ${listingId}: ${srcPath} (${buf.length}B → ${pngBuf.length}B)${APPLY ? ' → 書き込み中' : ' (dry-run)'}`,
        );

        if (APPLY) {
          await pngFile.save(pngBuf, {
            contentType: 'image/png',
            metadata: { cacheControl: 'public, max-age=31536000, immutable' },
          });
        }
        converted++;
      } catch (e) {
        console.error(`  ❌ ${listingId}: 想定外のエラーで失敗 (skip): ${srcPath}`, e);
        failed++;
      }
    }
  }

  console.log('\n=== 結果 ===');
  console.log(`走査した画像: ${imagesSeen}枚`);
  console.log(`変換${APPLY ? '・書き込み' : '対象'}: ${converted}枚`);
  console.log(`既に.png兄弟ありでスキップ: ${alreadyDone}枚`);
  console.log(`WebP/AVIF以外でスキップ: ${skippedNotWebp}枚`);
  console.log(`URL解析不能でスキップ: ${skippedUnparsable}枚`);
  console.log(`元ファイル不在でスキップ: ${skippedSourceMissing}枚`);
  console.log(`失敗: ${failed}枚`);
  if (!APPLY) {
    console.log('\n🟢 DRY-RUN でした。問題なければ --apply を付けて再実行してください。');
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ 致命的エラー:', e);
  process.exit(1);
});
