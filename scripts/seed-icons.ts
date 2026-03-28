/**
 * seed-icons.ts
 * public/icons/ 内のすべての PNG ファイルを
 * Firebase Storage の icons/{filename} にアップロードする
 *
 * 使い方: npx tsx scripts/seed-icons.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// .env.local 読み込み
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
const storageBucket = env.FIREBASE_STORAGE_BUCKET || 'lopo-7793e.firebasestorage.app';

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket });
const bucket = getStorage().bucket();

console.log('✅ Firebase Admin 初期化完了');
console.log(`📦 バケット: ${storageBucket}`);

// public/icons/ 内の PNG ファイル一覧を取得
const ICONS_DIR = resolve(ROOT, 'public/icons');
const pngFiles = readdirSync(ICONS_DIR).filter((f) => f.endsWith('.png'));

console.log(`📂 アップロード対象: ${pngFiles.length} ファイル`);

let uploaded = 0;
let skipped = 0;
let failed = 0;

for (let i = 0; i < pngFiles.length; i++) {
  const filename = pngFiles[i];
  const destination = `icons/${filename}`;
  const localPath = resolve(ICONS_DIR, filename);

  try {
    // 既存ファイルの確認
    const file = bucket.file(destination);
    const [exists] = await file.exists();

    if (exists) {
      skipped++;
    } else {
      await bucket.upload(localPath, {
        destination,
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
      uploaded++;
    }
  } catch (err) {
    console.error(`❌ ${filename} のアップロードに失敗: ${err}`);
    failed++;
  }

  // 20ファイルごとに進捗ログ
  if ((i + 1) % 20 === 0 || i + 1 === pngFiles.length) {
    console.log(`📊 進捗: ${i + 1}/${pngFiles.length} (アップロード: ${uploaded}, スキップ: ${skipped}, 失敗: ${failed})`);
  }
}

console.log('\n🎉 アイコンアップロード完了！');
console.log(`   アップロード: ${uploaded} ファイル`);
console.log(`   スキップ:     ${skipped} ファイル（既存）`);
console.log(`   失敗:         ${failed} ファイル`);
