/**
 * delete-legacy-users.ts
 * 廃止プロバイダー (Twitter/Google) のユーザー 14 件を関連データ含めて完全削除。
 *
 * モード:
 *   - npx tsx scripts/delete-legacy-users.ts                   → Dry-Run (削除対象を pre-count するだけ)
 *   - npx tsx scripts/delete-legacy-users.ts --execute --confirm → 本実行
 *
 * 削除順 (1 uid あたり):
 *   1. Firestore documents
 *   2. Cross-references (他人の copiedBy / reports.reporterUid)
 *   3. Firebase Storage files
 *   4. Firebase Auth account (最後、 復元不能)
 *
 * 安全策:
 *   - TARGET_UIDS は docs/.private/legacy-target-uids.json から読み込み (gitignored)
 *   - prefix が twitter:/google: 以外なら abort (本人 Discord uid を構造的保護)
 *   - admin claim を持つ uid を検出したら abort
 *   - idempotent (再実行で既消去分は skip)
 *
 * 設計書: docs/superpowers/specs/2026-05-20-legacy-user-cleanup-design.md
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

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
  console.error('❌ FIREBASE 認証情報が .env.local にありません');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket });
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();

export interface ParsedFlags {
  execute: boolean;
  confirm: boolean;
}

export function parseFlags(argv: string[]): ParsedFlags {
  const set = new Set(argv);
  return { execute: set.has('--execute'), confirm: set.has('--confirm') };
}

export function loadTargetUids(jsonPath: string): string[] {
  let raw: string;
  try {
    raw = readFileSync(jsonPath, 'utf-8');
  } catch {
    throw new Error(`TARGET_UIDS ファイル ${jsonPath} が読めません。 docs/.private/2026-05-19-hash-migration-prep.md から uid を転記してください`);
  }
  const parsed = JSON.parse(raw) as { twitter?: string[]; google?: string[] };
  const uids = [...(parsed.twitter ?? []), ...(parsed.google ?? [])];
  if (uids.some((u) => u.includes('REPLACE_ME'))) {
    throw new Error(`TARGET_UIDS にプレースホルダー REPLACE_ME が残っています。 実値で置き換えてください: ${jsonPath}`);
  }
  return uids;
}

export function assertPrefixSafe(uids: string[]): void {
  if (uids.length === 0) {
    throw new Error('TARGET_UIDS is empty');
  }
  for (const uid of uids) {
    if (uid.startsWith('discord:')) {
      throw new Error(`Refusing to delete discord: uid: ${uid}. Step 1 は廃止プロバイダー専用です。`);
    }
    if (!uid.startsWith('twitter:') && !uid.startsWith('google:')) {
      throw new Error(`Unexpected prefix in TARGET_UIDS: ${uid}. twitter:/google: 以外は処理しません。`);
    }
  }
}

async function assertNoAdminClaims(uids: string[]): Promise<void> {
  for (const uid of uids) {
    try {
      const user = await auth.getUser(uid);
      const claims = user.customClaims ?? {};
      if (claims.role === 'admin') {
        throw new Error(`Refusing to delete admin user: ${uid}. admin claim をクリアしてから再実行してください。`);
      }
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        continue; // 既に消えてる → OK
      }
      throw err;
    }
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const targetUids = loadTargetUids(resolve(ROOT, 'docs/.private/legacy-target-uids.json'));

  console.log(`Mode: ${flags.execute && flags.confirm ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`Target uids: ${targetUids.length}`);

  assertPrefixSafe(targetUids);
  await assertNoAdminClaims(targetUids);
  console.log('✅ 安全チェック通過: prefix OK / admin claim なし');

  if (flags.execute && !flags.confirm) {
    console.error('❌ --execute を指定するときは --confirm も必須です (誤起動防止)');
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
