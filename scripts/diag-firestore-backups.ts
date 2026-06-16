/**
 * diag-firestore-backups.ts (READ ONLY)
 * Firestore Admin REST API を service account 権限で叩き、
 *  ① (default) DB の PITR 有効/無効・location
 *  ② バックアップスケジュール(日次/週次)の有無
 *  ③ 実在するマネージドバックアップ一覧(snapshotTime)
 * を確認する。「1〜2日前に巻き戻せる材料があるか」を事実で判定する。
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

async function token(): Promise<string> {
  const t = await (credential as any).getAccessToken();
  return t.access_token as string;
}

async function api(url: string, accessToken: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const at = await token();
  const base = 'https://firestore.googleapis.com/v1';

  // ① (default) DB 情報
  const dbRes = await api(`${base}/projects/${projectId}/databases/(default)`, at);
  let location = 'nam5';
  if (dbRes.ok) {
    location = dbRes.body.locationId || location;
    console.log('=== ① (default) データベース ===');
    console.log(`  location           : ${dbRes.body.locationId}`);
    console.log(`  PITR               : ${dbRes.body.pointInTimeRecoveryEnablement || '(未設定=無効)'}`);
    console.log(`  earliestVersionTime: ${dbRes.body.earliestVersionTime || '(なし)'}`);
    console.log(`  versionRetention   : ${dbRes.body.versionRetentionPeriod || '(なし)'}`);
  } else {
    console.log('① DB 情報取得失敗:', dbRes.status, JSON.stringify(dbRes.body).slice(0, 200));
  }

  // ② バックアップスケジュール
  console.log('\n=== ② バックアップスケジュール ===');
  const schRes = await api(`${base}/projects/${projectId}/databases/(default)/backupSchedules`, at);
  if (schRes.ok) {
    const schedules = schRes.body.backupSchedules || [];
    if (schedules.length === 0) console.log('  (スケジュールなし=日次/週次バックアップは設定されていない)');
    for (const s of schedules) {
      console.log(`  - retention=${s.retention} daily=${!!s.dailyRecurrence} weekly=${JSON.stringify(s.weeklyRecurrence || '')} name=${s.name?.split('/').pop()}`);
    }
  } else {
    console.log('  取得失敗:', schRes.status, JSON.stringify(schRes.body).slice(0, 200));
  }

  // ③ 実在するバックアップ(location 配下)
  console.log(`\n=== ③ 実在するバックアップ (location=${location}) ===`);
  const bkRes = await api(`${base}/projects/${projectId}/locations/${location}/backups`, at);
  if (bkRes.ok) {
    const backups = bkRes.body.backups || [];
    if (backups.length === 0) console.log('  (バックアップなし=巻き戻せるスナップショットは存在しない)');
    for (const b of backups) {
      console.log(`  - snapshotTime=${b.snapshotTime} state=${b.state} expire=${b.expireTime} db=${b.database?.split('/').pop()}`);
    }
  } else {
    console.log('  取得失敗:', bkRes.status, JSON.stringify(bkRes.body).slice(0, 200));
    // location 違いの可能性: 主要ロケーションも試す
    for (const loc of ['asia-northeast1', 'us-central1', 'nam5', 'asia-northeast2']) {
      if (loc === location) continue;
      const r = await api(`${base}/projects/${projectId}/locations/${loc}/backups`, at);
      if (r.ok && (r.body.backups || []).length) {
        console.log(`  [${loc}] にバックアップ ${r.body.backups.length} 件:`);
        for (const b of r.body.backups) console.log(`    - snapshotTime=${b.snapshotTime} state=${b.state}`);
      }
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error('エラー:', e?.message || e); process.exit(1); });
