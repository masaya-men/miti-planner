/**
 * probe-fixed-plan-history.ts
 * 「固定」(live doc) を Firestore PITR で過去時刻に読み、壊れる直前の中身を探す。READ ONLY。
 * PITR が無効なら getAll(readTime) はエラー or 現在値になる。墓標候補も併記する。
 * 使い方: npx tsx scripts/probe-fixed-plan-history.ts <liveDocId>
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
const db = getFirestore();

const liveDocId = process.argv[2];
if (!liveDocId) {
  console.error('使い方: npx tsx scripts/probe-fixed-plan-history.ts <liveDocId>');
  process.exit(1);
}

function summarize(label: string, data: any) {
  if (!data) { console.log(`  ${label}: (doc なし)`); return; }
  const d = data.data || {};
  const pm = Array.isArray(d.partyMembers) ? d.partyMembers.length : '(none)';
  const mit = Array.isArray(d.timelineMitigations) ? d.timelineMitigations.length : '(none)';
  const ev = Array.isArray(d.timelineEvents) ? d.timelineEvents.length : '(none)';
  const updatedAt = data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : '?';
  console.log(`  ${label}: title="${data.title}" updatedAt=${updatedAt} partyMembers=${pm} timelineMitigations=${mit} timelineEvents=${ev}`);
}

async function main() {
  const ref = db.collection('plans').doc(liveDocId);

  console.log(`=== live 現在値 (${liveDocId}) ===`);
  const now = await ref.get();
  summarize('NOW', now.exists ? now.data() : null);

  console.log(`\n=== PITR 過去読み取り試行 ===`);
  const times = [
    '2026-06-12T00:04:00Z',
    '2026-06-12T00:00:00Z',
    '2026-06-11T23:00:00Z',
    '2026-06-11T18:00:00Z',
    '2026-06-10T12:00:00Z',
  ];
  for (const t of times) {
    try {
      const readTime = Timestamp.fromDate(new Date(t));
      const [snap] = await db.getAll(ref, { readTime } as any);
      summarize(`@${t}`, snap.exists ? snap.data() : null);
    } catch (err: any) {
      console.log(`  @${t}: PITR 読み取り不可 (${err?.message?.slice(0, 80)})`);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error('エラー:', err); process.exit(1); });
