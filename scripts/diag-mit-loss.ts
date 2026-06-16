/**
 * diag-mit-loss.ts (一時調査・READ ONLY)
 * 「軽減だけ消えた」疑い = timelineMitigations=0 なのに timelineEvents が実在(>=50) かつ version>=5。
 * deleted=false(生きている)だけを対象に絞る(ゴミ箱は除外)。
 * 併せて collabToken 付きプラン全件の軽減件数も出して相関を見る。
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

async function main() {
  const snap = await db.collection('plans').get();
  const suspect: any[] = [];
  const collabPlans: any[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const d = data.data || {};
    const mit = arrLen(d.timelineMitigations);
    const pm = arrLen(d.partyMembers);
    const ev = arrLen(d.timelineEvents);
    const version = typeof data.version === 'number' ? data.version : 0;
    const deleted = data.deleted === true;
    const collab = data.activeCollabRoomToken;
    const updatedAt = data.updatedAt?.toDate?.()?.toISOString?.() || '?';
    const owner = String(data.ownerId || '').slice(0, 20);
    const row = { id: doc.id, owner, title: String(data.title || ''), version, mit, pm, ev, updatedAt, collab: collab ? 'YES' : '-', deleted };
    if (collab) collabPlans.push(row);
    if (!deleted && mit === 0 && ev >= 50 && version >= 5) suspect.push(row);
  }

  suspect.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  console.log(`=== 軽減消滅疑い(生きている・mit=0・ev>=50・version>=5): ${suspect.length} 件 ===`);
  for (const s of suspect) {
    console.log(`  v${s.version}\t${s.updatedAt}\tcollab=${s.collab}\tev=${s.ev}\tpm=${s.pm}\t"${s.title}"\t${s.id}\towner=${s.owner}`);
  }
  // owner 別件数(複数ユーザーにまたがるか)
  const byOwner = new Map<string, number>();
  for (const s of suspect) byOwner.set(s.owner, (byOwner.get(s.owner) || 0) + 1);
  console.log(`\n影響ユーザー数: ${byOwner.size}`);
  for (const [o, n] of [...byOwner.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${o}: ${n} 件`);

  console.log(`\n=== collabToken 付き全プラン ${collabPlans.length} 件(軽減件数) ===`);
  collabPlans.sort((a, b) => a.mit - b.mit);
  for (const c of collabPlans) {
    console.log(`  mit=${c.mit}\tev=${c.ev}\tv${c.version}\tdel=${c.deleted}\t${c.updatedAt}\t"${c.title}"\t${c.id}\towner=${c.owner}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
