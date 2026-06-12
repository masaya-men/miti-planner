/**
 * inspect-plan-contents.ts
 * 指定 ownerId のプランの「中身」を Firestore から直接覗く・READ ONLY・一回限り調査用。
 * partyMembers / timelineMitigations / timelineEvents の件数と updatedAt / version を出し、
 * 「中身が消えているか/残っているか」「最後の更新がいつか」を可視化する。
 * 使い方: npx tsx scripts/inspect-plan-contents.ts <ownerId>
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

const ownerId = process.argv[2];
if (!ownerId) {
  console.error('使い方: npx tsx scripts/inspect-plan-contents.ts <ownerId>');
  process.exit(1);
}

function len(arr: any): string {
  return Array.isArray(arr) ? String(arr.length) : `(not array: ${JSON.stringify(arr)})`;
}

async function main() {
  const snap = await db.collection('plans').where('ownerId', '==', ownerId).get();
  console.log(`=== ownerId="${ownerId}" のプラン: ${snap.size} 件 ===\n`);
  const rows = snap.docs.map((doc) => {
    const data = doc.data();
    const d = data.data || {};
    const updatedAt = data.updatedAt && data.updatedAt.toMillis ? data.updatedAt.toMillis() : 0;
    return {
      id: doc.id,
      title: String(data.title || ''),
      deleted: data.deleted ?? false,
      collabToken: data.activeCollabRoomToken ?? '(none)',
      version: data.version ?? '?',
      updatedAt,
      updatedAtStr: updatedAt ? new Date(updatedAt).toISOString() : '(none)',
      pm: len(d.partyMembers),
      mit: len(d.timelineMitigations),
      ev: len(d.timelineEvents),
      dataKeys: Object.keys(d).join(','),
    };
  });
  rows.sort((a, b) => b.updatedAt - a.updatedAt);
  for (const r of rows) {
    console.log(`plan ${r.id}  title="${r.title}"  deleted=${r.deleted}  version=${r.version}  collabToken=${r.collabToken}`);
    console.log(`  updatedAt=${r.updatedAtStr}`);
    console.log(`  partyMembers=${r.pm}  timelineMitigations=${r.mit}  timelineEvents=${r.ev}`);
    console.log(`  data keys: ${r.dataKeys || '(empty object)'}`);
    console.log('');
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error('エラー:', err); process.exit(1); });
