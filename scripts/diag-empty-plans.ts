/**
 * diag-empty-plans.ts (一時調査・READ ONLY)
 * 全 plans を横断し「空にされた疑い(=version 高いのに中身0)」を検出する。
 * - empty 判定: timelineMitigations.length===0 && partyMembers.length<=0
 * - 破壊疑い: empty かつ version>=THRESH (かつて編集された痕跡があるのに中身0)
 * - collabToken との相関、updatedAt 日別ヒストグラムも出す。
 * 使い方: npx tsx scripts/diag-empty-plans.ts
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
  console.log(`総プラン数: ${snap.size}\n`);

  let empty = 0, emptyCollab = 0, hasCollabToken = 0;
  const suspect: any[] = [];
  const emptyByDay = new Map<string, number>();
  const nonEmptyVersions: number[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const d = data.data || {};
    const mit = arrLen(d.timelineMitigations);
    const pm = arrLen(d.partyMembers);
    const ev = arrLen(d.timelineEvents);
    const version = typeof data.version === 'number' ? data.version : 0;
    const collab = data.activeCollabRoomToken;
    const updatedAt = data.updatedAt?.toDate?.()?.toISOString?.() || '?';
    const day = updatedAt.slice(0, 10);
    if (collab) hasCollabToken++;

    const isEmpty = mit === 0 && pm === 0 && ev === 0;
    if (isEmpty) {
      empty++;
      emptyByDay.set(day, (emptyByDay.get(day) || 0) + 1);
      if (collab) emptyCollab++;
      // 破壊疑い: version>=2(=新規作成後に最低1回は更新された) で中身0
      if (version >= 2) {
        suspect.push({ id: doc.id, owner: String(data.ownerId || '').slice(0, 22), title: String(data.title || ''), version, updatedAt, collab: collab ? 'YES' : '-', mit, pm, ev });
      }
    } else {
      nonEmptyVersions.push(version);
    }
  }

  console.log(`空プラン(mit=0&pm=0&ev=0): ${empty} / ${snap.size}`);
  console.log(`  うち collabToken 付き: ${emptyCollab}`);
  console.log(`collabToken 付きプラン総数: ${hasCollabToken}`);
  console.log(`\n=== 空プランの updatedAt 日別 ===`);
  for (const [day, n] of [...emptyByDay.entries()].sort()) console.log(`  ${day}: ${n}`);

  suspect.sort((a, b) => b.version - a.version);
  console.log(`\n=== 破壊疑い(空 かつ version>=2) ${suspect.length} 件 (version 降順) ===`);
  for (const s of suspect.slice(0, 80)) {
    console.log(`  v${s.version}\t${s.updatedAt}\tcollab=${s.collab}\t"${s.title}"\t${s.id}\towner=${s.owner}`);
  }
  if (suspect.length > 80) console.log(`  ... 他 ${suspect.length - 80} 件`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
