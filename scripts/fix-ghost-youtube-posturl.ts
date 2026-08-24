/**
 * fix-ghost-youtube-posturl.ts (外科的アップデート・対象1件のみ)
 *
 * 背景 (2026-08-24 実機報告): housing_listings/9sDd0Hy5woXgXVuhkKRx は、YouTube排他仕様が
 * まだ存在していた頃 (2026-08-20以前) に「YouTube動画から登録→URL追加でXを追加」した結果、
 * Xの写真4枚だけが保存されYouTube側の動画情報 (youtubeVideoId) は失われた状態になっていた。
 * ところが sourcePostUrls にはそのYouTube URL文字列だけが「亡霊」として残り続け、
 * isDuplicatePostUrl の完全一致チェックが同じURLの再登録を永久にブロックしていた
 * (実際には youtubeVideoId は保存されていないのに「既に追加済み」と誤って弾かれる)。
 *
 * このスクリプトは対象1件の sourcePostUrls から、実際には保存されていない
 * YouTube URL (https://youtu.be/9Lg45cM9mpA) だけを取り除く。他のフィールド
 * (imageMode/tweetId/ogImageUrl/sourceImageUrls等) は一切変更しない。
 *
 * 使い方:
 *   npx tsx scripts/fix-ghost-youtube-posturl.ts          # dry-run(差分表示のみ)
 *   npx tsx scripts/fix-ghost-youtube-posturl.ts --apply  # 実書き込み
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

const APPLY = process.argv.includes('--apply');
const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));
const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const LISTING_ID = '9sDd0Hy5woXgXVuhkKRx';
const GHOST_URL = 'https://youtu.be/9Lg45cM9mpA';

async function main() {
  const ref = db.collection('housing_listings').doc(LISTING_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`❌ listing ${LISTING_ID} が存在しません`);
    process.exit(1);
  }
  const data = snap.data()!;

  if (data.youtubeVideoId) {
    console.error(`❌ 想定外: youtubeVideoId が既に保存されています (${data.youtubeVideoId})。中止。`);
    process.exit(1);
  }

  const before: string[] = data.sourcePostUrls ?? [];
  if (!before.includes(GHOST_URL)) {
    console.log('(対象URLは既に存在しません。何もしません)');
    process.exit(0);
  }
  const after = before.filter((u) => u !== GHOST_URL);

  console.log('sourcePostUrls (変更前):', JSON.stringify(before, null, 2));
  console.log('sourcePostUrls (変更後):', JSON.stringify(after, null, 2));

  if (!APPLY) {
    console.log('\n(dry-run) 実書き込みは --apply を付けて再実行');
    process.exit(0);
  }

  await ref.update({ sourcePostUrls: after });
  console.log('\n✅ 書き込み完了');
}

main();
