/**
 * diag-owner-copies.ts (一時調査・READ ONLY)
 * 指定オーナー or 指定タイトル部分一致の全プラン(墓標含む)を列挙し、軽減件数を出す。
 * だっくん固定の復旧元(軽減付きコピー/墓標)が存在するか確認する。
 * 使い方: npx tsx scripts/diag-owner-copies.ts <ownerPrefix> <titleSubstr>
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
initializeApp({ credential: cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });
const db = getFirestore();
const arrLen = (a: any) => (Array.isArray(a) ? a.length : 0);

const ownerPrefix = process.argv[2] || '';
const titleSub = process.argv[3] || '';

async function main() {
  const snap = await db.collection('plans').get();
  const rows: any[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const owner = String(data.ownerId || '');
    const title = String(data.title || '');
    const matchOwner = ownerPrefix && owner.includes(ownerPrefix);
    const matchTitle = titleSub && title.includes(titleSub);
    if (!matchOwner && !matchTitle) continue;
    const d = data.data || {};
    rows.push({
      id: doc.id, owner: owner.slice(0, 20), title,
      mit: arrLen(d.timelineMitigations), ev: arrLen(d.timelineEvents), pm: arrLen(d.partyMembers),
      version: typeof data.version === 'number' ? data.version : 0,
      deleted: data.deleted === true,
      collab: data.activeCollabRoomToken ? 'YES' : '-',
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || '?',
    });
  }
  rows.sort((a, b) => b.mit - a.mit);
  console.log(`=== owner~"${ownerPrefix}" / title~"${titleSub}" : ${rows.length} 件 ===`);
  for (const r of rows) {
    console.log(`  mit=${r.mit}\tev=${r.ev}\tpm=${r.pm}\tv${r.version}\tdel=${r.deleted}\tcollab=${r.collab}\t${r.updatedAt}\t"${r.title}"\t${r.id}\towner=${r.owner}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
