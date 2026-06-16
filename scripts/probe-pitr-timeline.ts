/**
 * probe-pitr-timeline.ts (READ ONLY)
 * 指定 live プランを Firestore PITR で過去時刻に遡り、mit/ev/pm/version の時系列を再構成する。
 * 目的:
 *   ① PITR の「読み取り可能な最古時刻」(=有効化時刻 or now-7日の遅い方)を経験的に特定
 *   ② timelineMitigations が >0 → 0 になった時刻を確定(=新規被害か旧被害再保存かの切り分け)
 *
 * 使い方:
 *   npx tsx scripts/probe-pitr-timeline.ts <liveDocId>
 *   npx tsx scripts/probe-pitr-timeline.ts <liveDocId> 2026-06-16T08:18:00Z 2026-06-16T08:00:00Z ...  # 任意時刻指定
 *
 * PITR 仕様メモ:
 *   - 保持 7 日。1 時間より古い readTime は「分単位(秒=0)」でないとエラー。
 *   - 有効化前の時刻は "read time is before the earliest version retained" 等でエラー → これで境界を特定。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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
initializeApp({ credential });
const db = getFirestore();

/** REST databases.get で (default) DB の PITR 設定を表示。 */
async function showDbConfig() {
  try {
    const t = await (credential as any).getAccessToken();
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`, { headers: { Authorization: `Bearer ${t.access_token}` } });
    const b: any = await res.json();
    console.log('=== (default) DB の PITR 設定 (REST databases.get) ===');
    console.log(`  pointInTimeRecoveryEnablement = ${b.pointInTimeRecoveryEnablement || '(未取得)'}`);
    console.log(`  versionRetentionPeriod        = ${b.versionRetentionPeriod || '(なし)'}`);
    console.log(`  earliestVersionTime           = ${b.earliestVersionTime || '(なし)'}`);
    console.log(`  createTime                    = ${b.createTime || '?'}`);
    if (!b.pointInTimeRecoveryEnablement) console.log(`  raw=${JSON.stringify(b).slice(0, 200)}`);
    console.log('');
  } catch (e: any) { console.log('  DB設定取得失敗:', e?.message); }
}

const docId = process.argv[2];
if (!docId) { console.error('使い方: npx tsx scripts/probe-pitr-timeline.ts <liveDocId> [ISO時刻...]'); process.exit(1); }
const explicitTimes = process.argv.slice(3);

const arrLen = (a: any) => (Array.isArray(a) ? a.length : -1);

/** 分単位に切り捨て(秒=0,ms=0)。PITR の分単位制約を満たす。 */
function floorMinute(d: Date): Date {
  const x = new Date(d.getTime());
  x.setUTCSeconds(0, 0);
  return x;
}

function buildGrid(): Date[] {
  const now = Date.now();
  // now からの分オフセット(過去方向)。最近は密、古い方は疎。7日=10080分まで。
  const offsets = [2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180, 210, 240, 300, 360, 420, 480, 540, 600, 720, 900, 1080, 1440, 2160, 2880, 4320, 5760, 7200, 8640, 10080];
  return offsets.map((m) => floorMinute(new Date(now - m * 60_000)));
}

function summarize(d: any): string {
  if (!d) return '(doc なし)';
  const pd = d.data || {};
  const mit = arrLen(pd.timelineMitigations);
  const ev = arrLen(pd.timelineEvents);
  const pm = arrLen(pd.partyMembers);
  const ver = typeof d.version === 'number' ? d.version : '?';
  const ua = d.updatedAt?.toDate?.()?.toISOString?.() || '?';
  return `mit=${mit}\tev=${ev}\tpm=${pm}\tv${ver}\tupdatedAt=${ua}\t"${String(d.title || '').replace(/\n/g, ' ')}"`;
}

/** 正しい PITR 読み取り = read-only トランザクション + readTime。 */
async function readAt(ref: FirebaseFirestore.DocumentReference, dt: Date): Promise<any> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    return snap.exists ? snap.data() : null;
  }, { readOnly: true, readTime: Timestamp.fromDate(dt) } as any);
}

async function main() {
  await showDbConfig();

  const ref = db.collection('plans').doc(docId);

  console.log(`=== live 現在値 (${docId}) ===`);
  const now = await ref.get();
  console.log(`  NOW          \t${summarize(now.exists ? now.data() : null)}`);
  const ownerId = now.exists ? String(now.data()!.ownerId || '') : '';
  console.log(`  owner=${ownerId}\n`);

  const times = explicitTimes.length > 0
    ? explicitTimes.map((t) => floorMinute(new Date(t)))
    : buildGrid();

  console.log(`=== PITR 過去読み取り (read-only tx + readTime, ${times.length} 点) ===`);
  for (const dt of times) {
    const iso = dt.toISOString();
    try {
      const data = await readAt(ref, dt);
      console.log(`  @${iso}\t${data ? summarize(data) : '(doc なし)'}`);
    } catch (err: any) {
      console.log(`  @${iso}\t❌ 読取不可: ${String(err?.message || err).slice(0, 110)}`);
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error('エラー:', e?.message || e); process.exit(1); });
