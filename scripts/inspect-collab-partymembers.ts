/**
 * inspect-collab-partymembers.ts
 * 共同編集の列増殖バグ調査用・一回限り・READ ONLY。
 * テスト表(title に "tesuto" 等を含む)の data.partyMembers を生で覗き、
 * 重複が「同一 id の重複か / 別 id か / 何件か」を可視化する。
 * collabRooms も roomToken → planId と件数を出す。
 * 使い方: npx tsx scripts/inspect-collab-partymembers.ts [titleSubstring]
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

const titleSub = (process.argv[2] || 'tesuto').toLowerCase();

function summarizeArray(label: string, arr: any): void {
  if (!Array.isArray(arr)) { console.log(`    ${label}: (not array) ${JSON.stringify(arr)}`); return; }
  const ids = arr.map((x) => (x && typeof x === 'object' ? x.id : x));
  const idCounts = new Map<string, number>();
  for (const id of ids) idCounts.set(String(id), (idCounts.get(String(id)) || 0) + 1);
  const dupIds = [...idCounts.entries()].filter(([, c]) => c > 1);
  console.log(`    ${label}: length=${arr.length}  uniqueIds=${idCounts.size}`);
  if (dupIds.length) console.log(`      !! 重複 id: ${JSON.stringify(dupIds)}`);
}

async function main() {
  console.log(`=== plans (title に "${titleSub}" を含む) ===`);
  const plansSnap = await db.collection('plans').get();
  const matched: { id: string; data: any }[] = [];
  for (const doc of plansSnap.docs) {
    const data = doc.data();
    const title = String(data.title || '');
    if (title.toLowerCase().includes(titleSub)) matched.push({ id: doc.id, data });
  }
  console.log(`一致プラン数: ${matched.length}\n`);
  for (const { id, data } of matched) {
    const d = data.data || {};
    console.log(`plan ${id}  title="${data.title}"  contentId=${data.contentId}  deleted=${data.deleted ?? false}  version=${data.version ?? '?'}`);
    console.log(`  activeCollabRoomToken=${data.activeCollabRoomToken ?? '(none)'}`);
    summarizeArray('partyMembers', d.partyMembers);
    summarizeArray('timelineMitigations', d.timelineMitigations);
    summarizeArray('timelineEvents', d.timelineEvents);
    // partyMembers の中身を id+jobId+role で並べる(重複の正体を見る)
    if (Array.isArray(d.partyMembers)) {
      console.log('    partyMembers 詳細(id / jobId / role):');
      d.partyMembers.forEach((m: any, i: number) =>
        console.log(`      [${i}] id=${m?.id}  jobId=${m?.jobId}  role=${m?.role}`));
    }
    console.log('');
  }

  console.log(`\n=== collabRooms (matched plans を指すもの) ===`);
  const matchedIds = new Set(matched.map((m) => m.id));
  const roomsSnap = await db.collection('collabRooms').get();
  console.log(`collabRooms 総数: ${roomsSnap.size}`);
  for (const doc of roomsSnap.docs) {
    const r = doc.data();
    if (matchedIds.has(r.planId)) {
      console.log(`  roomToken=${doc.id}  planId=${r.planId}  revoked=${r.revoked ?? false}  maxParticipants=${r.maxParticipants ?? '?'}  ownerId=${r.ownerId}`);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error('エラー:', err); process.exit(1); });
