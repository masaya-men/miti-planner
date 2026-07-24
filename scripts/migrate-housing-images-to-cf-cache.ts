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
import { getFirestore } from 'firebase-admin/firestore';

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

/** api/housing/_imageArrayLogic.ts の buildHousingImagePublicUrl と同一規則。 */
function buildNewUrl(listingId: string, filename: string): string {
  return `https://lopoly.app/housing-media/${listingId}/${filename}`;
}

/** 旧形式URL (firebasestorage.googleapis.com) かどうかの判定 + ファイル名抽出。 */
function extractFilenameFromOldUrl(url: string, listingId: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'firebasestorage.googleapis.com') return null;
    const marker = '/o/';
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const decoded = decodeURIComponent(u.pathname.slice(idx + marker.length));
    const expectedPrefix = `housing/listings/${listingId}/`;
    if (!decoded.startsWith(expectedPrefix)) return null;
    return decoded.slice(expectedPrefix.length);
  } catch {
    return null;
  }
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

async function verifyUrlResolves(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
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

  for (const doc of snap.docs) {
    const listingId = doc.id;
    const data = doc.data();
    const thumbnailPaths: string[] = Array.isArray(data.thumbnailPaths) ? data.thumbnailPaths : [];

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
      const filename = extractFilenameFromOldUrl(oldUrl, listingId);
      if (!filename) {
        console.error(`  ⚠ ${listingId}: 旧URL形式を解析できず (skip): ${oldUrl}`);
        listingOk = false;
        break;
      }
      const newUrl = buildNewUrl(listingId, filename);
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
      try {
        await db.collection('housing_listings').doc(listingId).update({
          thumbnailPaths: newPaths,
          thumbnailPath: newPaths[0] ?? null,
          updatedAt: Date.now(),
        });
      } catch (e) {
        console.error(`  ❌ ${listingId}: Firestore書き込み失敗:`, e);
        failed++;
        continue;
      }
    }
    migrated++;
  }

  console.log('\n=== 結果 ===');
  console.log(`移行対象として処理: ${migrated}件`);
  console.log(`既に新形式でスキップ: ${alreadyMigrated}件`);
  console.log(`画像なしでスキップ: ${skippedNoOldUrl}件`);
  console.log(`検証失敗: ${failed}件`);
  if (!COMMIT) {
    console.log('\nドライランでした。問題なければ --commit を付けて再実行してください。');
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ 致命的エラー:', e);
  process.exit(1);
});
