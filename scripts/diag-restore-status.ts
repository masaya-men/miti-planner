/**
 * diag-restore-status.ts (READ ONLY)
 * recovery-0608 の復元状況を確認する。
 *  ① REST databases.list で全DBと作成時刻を一覧
 *  ② admin SDK で recovery-0608 を実読みできるか(=復元完了の目安)
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}
const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));
const projectId = env.FIREBASE_PROJECT_ID!;
const credential = cert({ projectId, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') });
const app = initializeApp({ credential });

async function main() {
  // ① databases.list
  try {
    const t = await (credential as any).getAccessToken();
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases`, { headers: { Authorization: `Bearer ${t.access_token}` } });
    const body = await res.json();
    console.log('=== ① データベース一覧 ===');
    if (body.databases) {
      for (const d of body.databases) {
        console.log(`  ${d.name?.split('/').pop()}  createTime=${d.createTime || '?'}  type=${d.type || '?'}  loc=${d.locationId || '?'}`);
      }
    } else {
      console.log('  ', res.status, JSON.stringify(body).slice(0, 200));
    }
  } catch (e: any) { console.log('① 失敗:', e?.message); }

  // ② recovery-0608 を実読み
  console.log('\n=== ② recovery-0608 読み取りテスト ===');
  try {
    const bkDb = getFirestore(app, 'recovery-0608');
    const cnt = await bkDb.collection('plans').count().get();
    console.log(`  ✅ 読めました! plans 件数 = ${cnt.data().count} → 復元はほぼ完了しています`);
  } catch (e: any) {
    console.log(`  まだ読めません: ${String(e?.message || e).slice(0, 160)}`);
    console.log('  → まだ復元中の可能性が高いです(エラー内容で判断)');
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error('エラー:', e?.message || e); process.exit(1); });
