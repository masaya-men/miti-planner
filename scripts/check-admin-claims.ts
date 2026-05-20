/**
 * check-admin-claims.ts
 * 全 Firebase Auth ユーザーの Custom Claims を確認するスクリプト。
 *
 * 使い方: npx tsx scripts/check-admin-claims.ts
 *
 * 出力: 全ユーザーを provider 別にグループ化、admin claim 付きを [ADMIN] でマーク。
 * 個人情報 (email / displayName) は意図的に表示しない (uid と provider と admin 有無のみ)。
 *
 * 用途:
 *   - admin claim が誰に付いているかの網羅確認
 *   - hash 化マイグレーション前後の検証
 *   - 残骸ユーザー (Twitter / Google 廃止プロバイダー) の特定
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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
  console.error('FIREBASE 認証情報が .env.local にありません');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

function detectProvider(uid: string, providerData: any[]): string {
  if (uid.startsWith('hashed:')) return 'discord (hashed)';
  if (uid.startsWith('discord:')) return 'discord (legacy)';
  if (uid.startsWith('twitter:')) return 'twitter';
  const first = providerData[0]?.providerId;
  if (first) return first;
  return 'custom';
}

interface UserRow {
  uid: string;
  provider: string;
  isAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | undefined;
}

async function main() {
  console.log('全ユーザーの Custom Claims を確認中...\n');

  let pageToken: string | undefined = undefined;
  const allUsers: UserRow[] = [];

  do {
    const result = await getAuth().listUsers(1000, pageToken);
    for (const user of result.users) {
      const claims = user.customClaims || {};
      const isAdmin = claims.role === 'admin';
      const provider = detectProvider(user.uid, user.providerData);
      allUsers.push({
        uid: user.uid,
        provider,
        isAdmin,
        createdAt: user.metadata.creationTime,
        lastSignInAt: user.metadata.lastSignInTime,
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  const total = allUsers.length;
  const admins = allUsers.filter((u) => u.isAdmin);

  console.log(`総ユーザー数: ${total}`);
  console.log(`admin claim 付き: ${admins.length}\n`);

  console.log('=== admin claim 一覧 ===');
  if (admins.length === 0) {
    console.log('  (admin なし)');
  } else {
    for (const a of admins) {
      console.log(`  [ADMIN] ${a.uid}  (provider: ${a.provider}, created: ${a.createdAt}, lastSignIn: ${a.lastSignInAt ?? 'n/a'})`);
    }
  }

  console.log('\n=== 全ユーザー (provider 別) ===');
  const byProvider: Record<string, UserRow[]> = {};
  for (const u of allUsers) {
    (byProvider[u.provider] ??= []).push(u);
  }

  for (const [provider, users] of Object.entries(byProvider).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`\n[${provider}] ${users.length} 件`);
    for (const u of users.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const adminMark = u.isAdmin ? ' [ADMIN]' : '';
      console.log(`  ${u.uid}${adminMark}  (created: ${u.createdAt})`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('エラー:', err);
    process.exit(1);
  });
