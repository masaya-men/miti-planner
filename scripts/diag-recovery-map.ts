/**
 * diag-recovery-map.ts (一時調査・READ ONLY)
 * 「軽減消滅疑い」プラン(mit=0, ev>=50, version>=5, 生存) ごとに、
 * 同一オーナーの「軽減付き兄弟コピー」を探し、復旧可否と被害確度を判定する。
 *
 * 出力の見方:
 *  - sibling 列: 同一オーナーで mit>0 のうち、イベント数が近い最良候補(復旧元)
 *  - class:
 *      RECOVERABLE      = イベント数が近い軽減付き兄弟あり → 巻き戻し可能・被害ほぼ確定
 *      WEAK_SIBLING     = 軽減付き兄弟はあるがイベント数が離れる(別表かも)
 *      LIKELY_VICTIM    = 兄弟なし but version 高(>=30) → 被害だが復旧元なし
 *      AMBIGUOUS        = 兄弟なし・version 低 → 元から軽減なし(誤検知)の可能性
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
const iso = (t: any) => t?.toDate?.()?.toISOString?.() || '?';

interface Row {
  id: string; owner: string; title: string; mit: number; ev: number; pm: number;
  version: number; deleted: boolean; collab: boolean; updatedAt: string;
}

async function main() {
  const snap = await db.collection('plans').get();
  const all: Row[] = snap.docs.map((doc) => {
    const data = doc.data();
    const d = data.data || {};
    return {
      id: doc.id, owner: String(data.ownerId || ''), title: String(data.title || ''),
      mit: arrLen(d.timelineMitigations), ev: arrLen(d.timelineEvents), pm: arrLen(d.partyMembers),
      version: typeof data.version === 'number' ? data.version : 0,
      deleted: data.deleted === true, collab: !!data.activeCollabRoomToken, updatedAt: iso(data.updatedAt),
    };
  });

  // オーナー別インデックス(軽減付きのみ)
  const byOwner = new Map<string, Row[]>();
  for (const r of all) {
    if (r.mit > 0) {
      const list = byOwner.get(r.owner) || [];
      list.push(r);
      byOwner.set(r.owner, list);
    }
  }

  const suspects = all.filter((r) => !r.deleted && r.mit === 0 && r.ev >= 50 && r.version >= 5);
  suspects.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  let recoverable = 0, weak = 0, likely = 0, ambiguous = 0;
  console.log(`=== 被害候補 ${suspects.length} 件 の復旧マップ ===\n`);
  for (const s of suspects) {
    const siblings = (byOwner.get(s.owner) || []).filter((x) => x.id !== s.id);
    // イベント数が最も近い軽減付き兄弟
    let best: Row | null = null;
    let bestDelta = Infinity;
    for (const sib of siblings) {
      const delta = Math.abs(sib.ev - s.ev);
      if (delta < bestDelta || (delta === bestDelta && best && sib.mit > best.mit)) { best = sib; bestDelta = delta; }
    }
    let cls = '';
    const evTol = Math.max(5, Math.round(s.ev * 0.05));
    if (best && bestDelta <= evTol) { cls = 'RECOVERABLE'; recoverable++; }
    else if (best) { cls = 'WEAK_SIBLING'; weak++; }
    else if (s.version >= 30) { cls = 'LIKELY_VICTIM'; likely++; }
    else { cls = 'AMBIGUOUS'; ambiguous++; }

    const sibStr = best
      ? `mit=${best.mit} ev=${best.ev} v${best.version} del=${best.deleted} ${best.updatedAt} "${best.title}" ${best.id}`
      : '(軽減付き兄弟なし)';
    console.log(`[${cls}] "${s.title}" ${s.id}`);
    console.log(`   被害: ev=${s.ev} v${s.version} collab=${s.collab} zeroed@${s.updatedAt} owner=${s.owner.slice(0,20)}`);
    console.log(`   復旧元: ${sibStr}`);
  }
  console.log(`\n=== 集計 ===`);
  console.log(`  RECOVERABLE (復旧可・被害確定): ${recoverable}`);
  console.log(`  WEAK_SIBLING (兄弟あるが別表かも): ${weak}`);
  console.log(`  LIKELY_VICTIM (被害だが復旧元なし): ${likely}`);
  console.log(`  AMBIGUOUS   (誤検知の可能性): ${ambiguous}`);

  // バグが生きているか: RECOVERABLE/LIKELY のうち「修正後の日付」で空にされたもの
  console.log(`\n=== バグ継続の証拠: 被害確度の高いものを zeroed 日時降順で ===`);
  const confirmed = suspects.filter((s) => {
    const siblings = (byOwner.get(s.owner) || []).filter((x) => x.id !== s.id);
    return siblings.some((sib) => Math.abs(sib.ev - s.ev) <= Math.max(5, Math.round(s.ev * 0.05)));
  });
  confirmed.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  for (const s of confirmed.slice(0, 15)) {
    console.log(`  zeroed@${s.updatedAt} collab=${s.collab} v${s.version} ev=${s.ev} "${s.title}" ${s.id}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
