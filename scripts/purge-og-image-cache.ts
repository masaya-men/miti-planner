/**
 * scripts/purge-og-image-cache.ts
 *
 * Storage `og-images/*.png` (api/og-cache が一度生成すると永続配信し続けるキャッシュ) を
 * 一括削除する。コード側の描画修正 (inset:0 バグ等) をデプロイしても、パラメータ
 * (名前/写真URL等) が変わらなければ同じハッシュのまま古い画像がずっと配信され続けるため、
 * カード生成ロジックを直した後は必ずこれを実行して強制再生成させる必要がある。
 * Firestore og_image_meta ドキュメントは触らない (次回アクセス時に自動で再生成・再アップロードされる)。
 *
 * 使い方:
 *   npx tsx scripts/purge-og-image-cache.ts            # dry-run (既定・削除ゼロ)
 *   npx tsx scripts/purge-og-image-cache.ts --apply    # 本番に適用
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const APPLY = process.argv.includes('--apply');

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
initializeApp({
  credential: cert({
    projectId: env.FIREBASE_PROJECT_ID!,
    clientEmail: env.FIREBASE_CLIENT_EMAIL!,
    privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  }),
  storageBucket: env.FIREBASE_STORAGE_BUCKET || 'lopo-7793e.firebasestorage.app',
});
const bucket = getStorage().bucket();

async function main() {
  console.log(`=== og-images/ キャッシュ削除 (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);
  const [files] = await bucket.getFiles({ prefix: 'og-images/' });
  console.log(`対象: ${files.length}件`);
  for (const f of files.slice(0, 20)) console.log(`  - ${f.name}`);
  if (files.length > 20) console.log(`  ... 他 ${files.length - 20}件`);

  if (!APPLY) {
    console.log('\n🟢 DRY-RUN でした。問題なければ --apply を付けて再実行してください。');
    return;
  }

  let deleted = 0;
  for (const f of files) {
    try {
      await f.delete();
      deleted++;
    } catch (e) {
      console.error(`  ❌ ${f.name}: 削除失敗`, e);
    }
  }
  console.log(`\n🔴 APPLY完了: ${deleted}/${files.length}件削除しました。`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('❌ 致命的エラー:', e);
  process.exit(1);
});
