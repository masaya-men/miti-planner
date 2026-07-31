/**
 * scripts/backfill-avatar-png.ts
 *
 * 背景: アバターアップロードは2026-07-31よりWebP本体+PNG派生版の両方を保存し
 * (src/utils/avatarUpload.ts)、Firestore users/{uid}.avatarPngUrl に記録するように
 * なった。OGPカード生成 (satori) はWebP非対応で、avatarPngUrl が無いユーザーは
 * アイコンがイニシャル文字にフォールバックしてしまう。この修正より前にアバターを
 * アップロードした既存ユーザーは avatarPngUrl が未設定のままなので、このスクリプトで
 * 既存の avatar.webp を読み込んでPNGに変換し、Storage + Firestore の両方を今すぐ埋める。
 *
 * 触るもの:
 *  - Storage: users/{uid}/avatar.png (新規作成のみ、avatar.webp は変更しない)
 *  - Firestore: users/{uid}.avatarPngUrl
 *  - Firestore: housing_profiles/{uid}.avatarPngUrl (ハウジンガー公開プロフィールが
 *    存在する場合のみ。upsert-housinger-profile を待たず即座にOGPカードへ反映するため。
 *    api/housing/_upsertHousingerProfileHandler.ts の通常のコピー処理と同じ変換元)
 *
 * 使い方:
 *   npx tsx scripts/backfill-avatar-png.ts            # dry-run (既定・書き込みゼロ)
 *   npx tsx scripts/backfill-avatar-png.ts --apply    # 本番に適用
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { convertToPngIfNeeded } from '../api/housing/_imageFormatConvert.js';

const APPLY = process.argv.includes('--apply');
const USERS_COLLECTION = 'users';
const PROFILE_COLLECTION = 'housing_profiles';

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

console.log(`=== avatarPngUrl バックフィル (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

/**
 * Firebase Storage の公開ダウンロードURL (クライアントSDK getDownloadURL と同形式) を組み立てる。
 * scripts/fix-avatar-urls-for-uid.ts と同じ手順 (firebaseStorageDownloadTokens をメタデータに
 * 保存し、?alt=media&token= 付きURLを返す)。
 */
async function buildDownloadUrl(filePath: string): Promise<string> {
  const file = bucket.file(filePath);
  const token = randomUUID();
  await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  const encodedPath = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

async function main() {
  // avatarUrl を持つユーザーのみ対象 (単一フィールドの範囲クエリなので複合インデックス不要)。
  // avatarPngUrl の有無は Firestore クエリでは絞らずJS側でフィルタする
  // (backfill-personal-tag-avatars.ts と同じ方針)。
  const usersSnap = await db.collection(USERS_COLLECTION).where('avatarUrl', '>', '').get();
  console.log(`対象候補: ${usersSnap.size}件 (avatarUrlあり)\n`);

  let alreadyDone = 0;
  let skippedNoFile = 0;
  let converted = 0;
  let failed = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    if (typeof data.avatarPngUrl === 'string' && data.avatarPngUrl) {
      alreadyDone++;
      continue;
    }

    // avatarUrl の中身 (トークン付きURL) はパース不要。この app のアップロード経路は
    // 常に users/{uid}/avatar.webp 固定パスなので、そこを直接見に行く (src/utils/avatarUpload.ts)。
    try {
      const webpFile = bucket.file(`users/${uid}/avatar.webp`);
      const [exists] = await webpFile.exists();
      if (!exists) {
        skippedNoFile++;
        continue;
      }

      const [buf] = await webpFile.download();
      const pngBuf = await convertToPngIfNeeded(buf, 'image/webp');
      if (!pngBuf) {
        console.error(`  ⚠ ${uid}: PNG変換に失敗 (skip)`);
        failed++;
        continue;
      }

      console.log(`  ✅ ${uid}: 変換OK (${buf.length}B → ${pngBuf.length}B)${APPLY ? ' → 書き込み中' : ' (dry-run)'}`);

      if (APPLY) {
        const pngPath = `users/${uid}/avatar.png`;
        await bucket.file(pngPath).save(pngBuf, {
          contentType: 'image/png',
          metadata: { cacheControl: 'public, max-age=31536000, immutable' },
        });
        const avatarPngUrl = await buildDownloadUrl(pngPath);

        await db.collection(USERS_COLLECTION).doc(uid).update({ avatarPngUrl });

        const profileRef = db.collection(PROFILE_COLLECTION).doc(uid);
        const profileSnap = await profileRef.get();
        if (profileSnap.exists) {
          await profileRef.update({ avatarPngUrl });
        }
      }
      converted++;
    } catch (e) {
      console.error(`  ❌ ${uid}: 想定外のエラーで失敗 (skip):`, e);
      failed++;
    }
  }

  console.log('\n=== 結果 ===');
  console.log(`変換${APPLY ? '・書き込み' : '対象'}: ${converted}件`);
  console.log(`既にavatarPngUrlあり: ${alreadyDone}件`);
  console.log(`avatar.webpファイルなしでスキップ: ${skippedNoFile}件`);
  console.log(`失敗: ${failed}件`);
  if (!APPLY) {
    console.log('\n🟢 DRY-RUN でした。問題なければ --apply を付けて再実行してください。');
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ 致命的エラー:', e);
  process.exit(1);
});
