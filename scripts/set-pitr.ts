/**
 * set-pitr.ts
 * (default) Firestore DB の PITR を ON/OFF する。REST databases.patch。
 * 使い方:
 *   npx tsx scripts/set-pitr.ts off   # POINT_IN_TIME_RECOVERY_DISABLED
 *   npx tsx scripts/set-pitr.ts on    # POINT_IN_TIME_RECOVERY_ENABLED
 *   npx tsx scripts/set-pitr.ts       # 現在値の確認のみ(変更しない)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert } from 'firebase-admin/app';

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}
const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));
const projectId = env.FIREBASE_PROJECT_ID!;
const credential = cert({ projectId, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') });

const arg = (process.argv[2] || '').toLowerCase();
const target = arg === 'off' ? 'POINT_IN_TIME_RECOVERY_DISABLED' : arg === 'on' ? 'POINT_IN_TIME_RECOVERY_ENABLED' : null;

async function token() { const t = await (credential as any).getAccessToken(); return t.access_token; }
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;

async function show(t: string, label: string) {
  const res = await fetch(base, { headers: { Authorization: `Bearer ${t}` } });
  const b: any = await res.json();
  console.log(`  [${label}] PITR=${b.pointInTimeRecoveryEnablement || '?'} / retention=${b.versionRetentionPeriod || '-'} / earliest=${b.earliestVersionTime || '-'}`);
  return b;
}

async function main() {
  const t = await token();
  console.log('=== 現在の DB 設定 ===');
  await show(t, 'before');
  if (!target) { console.log('\n(変更引数なし。確認のみ。 off/on を渡すと変更します)'); return; }

  console.log(`\n=== PITR を ${target} に変更 ===`);
  const res = await fetch(`${base}?updateMask=pointInTimeRecoveryEnablement`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pointInTimeRecoveryEnablement: target }),
  });
  const body: any = await res.json();
  if (!res.ok) { console.error(`  ❌ 失敗 ${res.status}: ${JSON.stringify(body).slice(0, 300)}`); process.exit(1); }
  console.log(`  ✅ PATCH 受理 (operation: ${body.name?.split('/').pop() || JSON.stringify(body).slice(0, 120)})`);

  // 反映確認(少し待つ)
  await new Promise((r) => setTimeout(r, 4000));
  console.log('\n=== 変更後の DB 設定 ===');
  await show(await token(), 'after');
}
main().then(() => process.exit(0)).catch((e) => { console.error('エラー:', e?.message || e); process.exit(1); });
