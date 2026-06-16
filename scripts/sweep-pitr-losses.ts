/**
 * sweep-pitr-losses.ts (READ ONLY)
 * PITR 保持境界(earliestVersionTime)以降に「軽減が >0 → 0」に空化した全プランを洗い出し、
 * 失った軽減数と「復元に使うべき直前の健全 readTime」を確定する。
 * = PITR で復元可能な「新規被害」の完全リスト。
 *
 * 仕組み:
 *   ① 全 plans のうち deleted=false・現在 mit=0・updatedAt >= 境界 のものが候補
 *      (updatedAt が境界より前 = 境界後に書かれていない = PITR 窓内に健全版が無い → 対象外)
 *   ② 各候補を read-only tx + readTime で、updatedAt から境界まで遡って健全版(mit>0)を探す
 *   ③ 最後の健全版(mit最大・直近)を「復元元 readTime」として記録
 *
 * 使い方: npx tsx scripts/sweep-pitr-losses.ts
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

const arrLen = (a: any) => (Array.isArray(a) ? a.length : 0);
const iso = (t: any) => t?.toDate?.()?.toISOString?.() || '?';

function floorMinute(ms: number): Date { const x = new Date(ms); x.setUTCSeconds(0, 0); return x; }

async function getBoundary(): Promise<Date> {
  const t = await (credential as any).getAccessToken();
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`, { headers: { Authorization: `Bearer ${t.access_token}` } });
  const b: any = await res.json();
  return new Date(b.earliestVersionTime);
}

async function readAt(ref: FirebaseFirestore.DocumentReference, dt: Date): Promise<any> {
  return db.runTransaction(async (tx) => { const s = await tx.get(ref); return s.exists ? s.data() : null; }, { readOnly: true, readTime: Timestamp.fromDate(dt) } as any);
}

async function main() {
  const boundary = await getBoundary();
  const boundaryMs = boundary.getTime();
  console.log(`PITR 境界(earliestVersionTime) = ${boundary.toISOString()} (JST ${new Date(boundaryMs + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16)})\n`);

  const snap = await db.collection('plans').get();
  // 境界後に書かれ・現在空・実体あり(ev>0)の候補
  const cands = snap.docs.filter((d) => {
    const x = d.data();
    const pd = x.data || {};
    const ua = x.updatedAt?.toDate?.()?.getTime?.() || 0;
    return x.deleted !== true && arrLen(pd.timelineMitigations) === 0 && arrLen(pd.timelineEvents) > 0 && ua >= boundaryMs;
  });
  console.log(`境界後に書かれた「現在空」候補: ${cands.length} 件 → PITR で健全版を探索\n`);

  const recoverable: any[] = [];
  for (const doc of cands) {
    const ref = doc.ref;
    const cur = doc.data();
    const ua = cur.updatedAt?.toDate?.()?.getTime?.() || Date.now();
    // updatedAt から境界まで分グリッドで遡る(直近密)
    const offsets = [1, 2, 3, 4, 6, 8, 11, 15, 20, 26, 33, 42, 55, 75, 100, 140, 200, 300, 500, 800, 1200];
    let best: { mit: number; readDt: Date; ver: any; uaSrc: string } | null = null;
    for (const m of offsets) {
      const dtMs = ua - m * 60_000;
      if (dtMs < boundaryMs) break;
      const dt = floorMinute(dtMs);
      try {
        const data = await readAt(ref, dt);
        const mit = arrLen(data?.data?.timelineMitigations);
        if (mit > 0) { best = { mit, readDt: dt, ver: data?.version, uaSrc: iso(data?.updatedAt) }; break; } // 直近の健全版で確定
      } catch { break; } // too old = 境界越え
    }
    if (best) {
      recoverable.push({ id: doc.id, title: String(cur.title || '').replace(/\n/g, ' '), owner: String(cur.ownerId || '').slice(0, 20), curUa: iso(cur.updatedAt), curVer: cur.version, lost: best.mit, restoreReadTime: best.readDt.toISOString(), srcVer: best.ver });
    }
  }

  recoverable.sort((a, b) => b.lost - a.lost);
  console.log(`=== PITR 復元可能な新規被害: ${recoverable.length} 件 ===`);
  let total = 0;
  for (const r of recoverable) {
    total += r.lost;
    console.log(`  軽減 ${r.lost} 個喪失\t"${r.title}"\t${r.id}\n      現在=v${r.curVer}@${r.curUa} / 復元元 readTime=${r.restoreReadTime}(v${r.srcVer}) owner=${r.owner}`);
  }
  console.log(`\n  → 復元可能な軽減 合計 ${total} 個 / ${recoverable.length} 表`);
}
main().then(() => process.exit(0)).catch((e) => { console.error('エラー:', e?.message || e); process.exit(1); });
