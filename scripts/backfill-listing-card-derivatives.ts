/**
 * scripts/backfill-listing-card-derivatives.ts
 *
 * 既存の直接アップロード物件(imageMode='thumbnail')の画像に、カード用の縮小 WebP 派生
 * (480/960/1440)を作り置きする。同時に欠けている .png 兄弟を再生成し、代表画像の
 * coverThumbHash を計算して Firestore に保存する。
 *
 * 設計書: docs/superpowers/specs/2026-08-31-housing-card-image-optimization-phase1-design.md
 *
 * Firestore 変更: coverThumbHash の追加のみ(thumbnailPaths 等はいじらない)。
 * Storage 変更: {uuid}-{w}.webp / {uuid}.png の新規作成のみ(元ファイルは不変)。
 *
 * 冪等: 生成済みファイル / 設定済み coverThumbHash は .exists() / フィールド存在で skip。
 * 何度でも再実行してよい。
 *
 * dry-run は「完全に読み取り専用 かつ ダウンロードゼロ」。元画像の DL / sharp 変換は
 * --apply 時のみ。dry-run は .exists() チェックと coverThumbHash フィールドの有無だけで
 * 「生成予定か」を判定する(元画像を DL しない = egress を消費しない)。
 *
 * 使い方:
 *   npx tsx scripts/backfill-listing-card-derivatives.ts            # dry-run(既定・書き込みゼロ・DL ゼロ)
 *   npx tsx scripts/backfill-listing-card-derivatives.ts --apply    # 本番に適用
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
  parseStoragePathFromPublicUrl,
  toPngSiblingPath,
  toDerivativePath,
  HOUSING_CARD_DERIVATIVE_WIDTHS,
} from '../api/housing/_imageArrayLogic.js';
import { convertToPngIfNeeded, LISTING_THUMBNAIL_PNG_MAX_DIMENSION, resizeToWebp } from '../api/housing/_imageFormatConvert.js';
import { computeCoverThumbHash } from '../api/housing/_coverThumbHash.js';
import { bumpPublicVersionDirect } from '../api/housing/_publicVersion.js';

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

function mimeFromExt(path: string): string | null {
  if (/\.webp$/i.test(path)) return 'image/webp';
  if (/\.avif$/i.test(path)) return 'image/avif';
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
  if (/\.png$/i.test(path)) return 'image/png';
  return null;
}

console.log(`=== カード画像派生バックフィル (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

async function main() {
  const snap = await db.collection(LISTING_COLLECTION).where('imageMode', '==', 'thumbnail').get();
  const docs = snap.docs.filter((d) => d.data().deletedAt == null);
  console.log(`対象: ${docs.length}件 (imageMode='thumbnail' / 未削除)\n`);

  let listings = 0;
  let derivativesMade = 0;
  let pngMade = 0;
  let hashesWritten = 0;
  let failed = 0;

  for (const doc of docs) {
    listings++;
    const listingId = doc.id;
    const data = doc.data();
    const urls: string[] = Array.isArray(data.thumbnailPaths)
      ? data.thumbnailPaths.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
      : typeof data.thumbnailPath === 'string' && data.thumbnailPath
        ? [data.thumbnailPath]
        : [];
    if (urls.length === 0) continue;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const srcPath = parseStoragePathFromPublicUrl(url);
      const mimeType = mimeFromExt(url);
      if (!srcPath || !mimeType) {
        console.error(`  ⚠ ${listingId}: URL 解析不能 (skip): ${url}`);
        continue;
      }

      // 派生 3 サイズ
      let srcBuf: Buffer | null = null;
      const ensureBuf = async (): Promise<Buffer | null> => {
        if (srcBuf) return srcBuf;
        const srcFile = bucket.file(srcPath);
        const [exists] = await srcFile.exists();
        if (!exists) {
          console.error(`  ⚠ ${listingId}: 元ファイル不在 (skip): ${srcPath}`);
          return null;
        }
        [srcBuf] = await srcFile.download();
        return srcBuf;
      };

      // dry-run 専用: 元ファイルの存在確認(メタデータのみ・DL なし・srcPath ごとに 1 回)。
      // これが無いと元ファイルが Storage から消えている物件で dry-run が生成予定を水増しし
      // (--apply は if (!buf) break で何も作らない)、「再 dry-run で生成予定 0」ゲートが不正確になる。
      let srcExistsCache: boolean | null = null;
      let srcMissingLogged = false;
      const srcExistsForDryRun = async (): Promise<boolean> => {
        if (srcExistsCache === null) {
          [srcExistsCache] = await bucket.file(srcPath).exists();
        }
        if (!srcExistsCache && !srcMissingLogged) {
          console.error(`  ⚠ ${listingId}: 元ファイル不在 (skip): ${srcPath}`);
          srcMissingLogged = true;
        }
        return srcExistsCache;
      };

      for (const w of HOUSING_CARD_DERIVATIVE_WIDTHS) {
        const dstPath = toDerivativePath(srcPath, w);
        try {
          const [exists] = await bucket.file(dstPath).exists();
          if (exists) continue;
          if (!APPLY) {
            // dry-run: 派生が無い = 生成予定。元画像は DL しない(存在確認のみ)。
            // 元ファイルが消えていれば --apply は if (!buf) break で何も作らないので、ここでも数えず break。
            if (!(await srcExistsForDryRun())) break;
            console.log(`  · ${listingId}: ${dstPath}`);
            derivativesMade++;
            continue;
          }
          const buf = await ensureBuf();
          if (!buf) break;
          console.log(`  ✅ ${listingId}: ${dstPath}`);
          const out = await resizeToWebp(buf, w);
          await bucket.file(dstPath).save(out, {
            contentType: 'image/webp',
            metadata: { cacheControl: 'public, max-age=31536000, immutable' },
          });
          derivativesMade++;
        } catch (e) {
          console.error(`  ❌ ${listingId}: 派生 ${w}w 失敗: ${dstPath}`, e);
          failed++;
        }
      }

      // .png 兄弟(webp/avif 元のみ・欠けていれば)
      if (mimeType === 'image/webp' || mimeType === 'image/avif') {
        const pngPath = toPngSiblingPath(srcPath);
        try {
          const [exists] = await bucket.file(pngPath).exists();
          if (!exists) {
            if (!APPLY) {
              // dry-run: webp/avif 元 かつ .png 兄弟が無い = 生成予定。
              // (jpeg/png 元は convertToPngIfNeeded が null を返すので --apply でも作らない → ここに来ない)
              // 元ファイルが消えていれば --apply は ensureBuf が null で作らないので、ここでも数えない。
              if (await srcExistsForDryRun()) {
                console.log(`  · ${listingId}: ${pngPath} (png兄弟)`);
                pngMade++;
              }
            } else {
              const buf = await ensureBuf();
              if (buf) {
                const pngBuf = await convertToPngIfNeeded(buf, mimeType, {
                  maxDimension: LISTING_THUMBNAIL_PNG_MAX_DIMENSION,
                });
                if (pngBuf) {
                  console.log(`  ✅ ${listingId}: ${pngPath} (png兄弟)`);
                  await bucket.file(pngPath).save(pngBuf, {
                    contentType: 'image/png',
                    metadata: { cacheControl: 'public, max-age=31536000, immutable' },
                  });
                  pngMade++;
                }
              }
            }
          }
        } catch (e) {
          console.error(`  ❌ ${listingId}: png 兄弟失敗: ${pngPath}`, e);
          failed++;
        }
      }

      // coverThumbHash(代表画像 = i===0・未設定なら)
      if (i === 0 && !data.coverThumbHash) {
        try {
          if (!APPLY) {
            // dry-run: 代表画像 かつ coverThumbHash 未設定 = 計算予定。元画像は DL しない(存在確認のみ)。
            // 元ファイルが消えていれば --apply は ensureBuf が null で計算しないので、ここでも数えない。
            if (await srcExistsForDryRun()) {
              console.log(`  · ${listingId}: coverThumbHash`);
              hashesWritten++;
            }
          } else {
            const buf = await ensureBuf();
            if (buf) {
              const hash = await computeCoverThumbHash(buf);
              if (hash) {
                console.log(`  ✅ ${listingId}: coverThumbHash`);
                await doc.ref.update({ coverThumbHash: hash, updatedAt: Date.now() });
                hashesWritten++;
              }
            }
          }
        } catch (e) {
          console.error(`  ❌ ${listingId}: coverThumbHash 失敗`, e);
          failed++;
        }
      }
    }
  }

  if (APPLY && hashesWritten > 0) {
    await bumpPublicVersionDirect(db);
    console.log('\n公開データ版番号を +1(古いギャラリーキャッシュを失効させる)');
  }

  console.log('\n=== 結果 ===');
  console.log(`対象物件: ${listings}件`);
  console.log(`派生 webp ${APPLY ? '生成' : '生成予定'}: ${derivativesMade}枚`);
  console.log(`png 兄弟 ${APPLY ? '生成' : '生成予定'}: ${pngMade}枚`);
  console.log(`coverThumbHash ${APPLY ? '保存' : '保存予定'}: ${hashesWritten}件`);
  console.log(`失敗: ${failed}件`);
  if (failed > 0) console.error('\n⚠ 失敗が 0 でない。表示側デプロイの前に原因を潰すこと。');
  if (!APPLY) console.log('\n🟢 DRY-RUN。問題なければ --apply で再実行。');
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ 致命的エラー:', e);
  process.exit(1);
});
