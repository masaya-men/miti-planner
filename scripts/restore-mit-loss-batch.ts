/**
 * restore-mit-loss-batch.ts
 * 「軽減だけ消えた」被害プランを、同一オーナーの軽減付き兄弟コピーから一括復元する。
 * 既定はドライラン(書き込まない)。--apply で実書込。
 *
 * 対象の選定(被害確定 = RECOVERABLE のみ):
 *   - 生存(deleted=false)・mit=0・ev>=50・version>=5
 *   - 同一オーナーに「mit>0 かつ |ev差| <= max(5, ev*5%)」の兄弟が存在
 * 復旧元(source)の選定:
 *   - 同一オーナー・mit>0・|ev差|許容内の中から、
 *     ①正規化タイトル一致を優先 → ②mit 最多(最も完全) → ③updatedAt 最新
 * 復元仕様(restore-fixed-plan.ts と同型):
 *   - target.data = source.data 丸ごと置換 / version++ / deleted=false / title・ownerId・contentId 温存
 *   - source(兄弟)は触らない。mit が増える場合のみ書き込む(減らさない)。
 *
 * 使い方:
 *   npx tsx scripts/restore-mit-loss-batch.ts            # ドライラン(全RECOVERABLE)
 *   npx tsx scripts/restore-mit-loss-batch.ts --apply    # 実書込(既定= HIGH=同名一致のみ)
 *   npx tsx scripts/restore-mit-loss-batch.ts --apply --include-review   # REVIEW(別名)も書込
 *   npx tsx scripts/restore-mit-loss-batch.ts --only <targetId>[,<id2>...]   # 一部だけ(信頼度無視)
 *   npx tsx scripts/restore-mit-loss-batch.ts --skip-owner <ownerPrefix>     # 特定オーナー除外
 *
 * 信頼度:
 *   HIGH   = 正規化タイトル一致(自身の競合コピー/(2)/同名)= 同一戦闘が確実 → 既定で復元対象
 *   REVIEW = タイトル不一致(同イベント数の別表とマッチ)= 別戦闘の恐れ → 既定スキップ・要目視
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
const apply = process.argv.includes('--apply');
const includeReview = process.argv.includes('--include-review');
const onlyArg = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? (process.argv[i + 1] || '').split(',').filter(Boolean) : null; })();
const skipOwner = (() => { const i = process.argv.indexOf('--skip-owner'); return i >= 0 ? (process.argv[i + 1] || '') : null; })();

/** タイトル正規化: 接尾辞・空白を除いて基底名を取り出す。 */
function normTitle(t: string): string {
  return String(t || '')
    .replace(/\s*\((競合コピー|conflict|\d+|Full|BH|2|3|copy|コピー)\)\s*/gi, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

interface Row {
  id: string; owner: string; title: string; mit: number; ev: number; pm: number;
  version: number; deleted: boolean; collab: boolean; updatedAt: string; data: any;
}

async function main() {
  const snap = await db.collection('plans').get();
  const all: Row[] = snap.docs.map((doc) => {
    const d = doc.data();
    const pd = d.data || {};
    return {
      id: doc.id, owner: String(d.ownerId || ''), title: String(d.title || ''),
      mit: arrLen(pd.timelineMitigations), ev: arrLen(pd.timelineEvents), pm: arrLen(pd.partyMembers),
      version: typeof d.version === 'number' ? d.version : 0,
      deleted: d.deleted === true, collab: !!d.activeCollabRoomToken, updatedAt: iso(d.updatedAt), data: pd,
    };
  });

  const withMit = all.filter((r) => r.mit > 0);
  const victims = all.filter((r) => !r.deleted && r.mit === 0 && r.ev >= 50 && r.version >= 5);

  const plans: { target: Row; source: Row; confidence: 'HIGH' | 'REVIEW' }[] = [];
  for (const v of victims) {
    if (onlyArg && !onlyArg.includes(v.id)) continue;
    if (skipOwner && v.owner.includes(skipOwner)) continue;
    const tol = Math.max(5, Math.round(v.ev * 0.05));
    const cands = withMit.filter((s) => s.owner === v.owner && s.id !== v.id && Math.abs(s.ev - v.ev) <= tol);
    if (cands.length === 0) continue; // RECOVERABLE のみ
    const vNorm = normTitle(v.title);
    cands.sort((a, b) => {
      const at = normTitle(a.title) === vNorm ? 1 : 0;
      const bt = normTitle(b.title) === vNorm ? 1 : 0;
      if (at !== bt) return bt - at;            // ①タイトル一致優先
      if (a.mit !== b.mit) return b.mit - a.mit; // ②mit 最多
      return a.updatedAt < b.updatedAt ? 1 : -1; // ③最新
    });
    const source = cands[0];
    const confidence = normTitle(source.title) === vNorm ? 'HIGH' : 'REVIEW';
    plans.push({ target: v, source, confidence });
  }
  // HIGH を先に、各群内は mit 多い順
  plans.sort((a, b) => (a.confidence !== b.confidence ? (a.confidence === 'HIGH' ? -1 : 1) : b.source.mit - a.source.mit));

  const highs = plans.filter((p) => p.confidence === 'HIGH');
  const reviews = plans.filter((p) => p.confidence === 'REVIEW');
  const fmt = (p: { target: Row; source: Row; confidence: string }) => {
    console.log(`[${p.confidence}] ◆ "${p.target.title.replace(/\n/g, ' ')}" ${p.target.id}`);
    console.log(`   被害 : mit=0 ev=${p.target.ev} v${p.target.version} collab=${p.target.collab} owner=${p.target.owner.slice(0, 20)}`);
    console.log(`   復元元: mit=${p.source.mit} ev=${p.source.ev} v${p.source.version} del=${p.source.deleted} "${p.source.title.replace(/\n/g, ' ')}" ${p.source.id} @${p.source.updatedAt}`);
  };

  console.log(`=== ① HIGH(同名・同戦闘が確実)= ${highs.length} 件 ${apply && !includeReview ? '★今回書込対象★' : ''} ===`);
  let highMit = 0; for (const p of highs) { fmt(p); highMit += p.source.mit; }
  console.log(`\n  HIGH 小計: ${highs.length} 表 / 軽減 のべ ${highMit} 個\n`);

  console.log(`=== ② REVIEW(タイトル不一致・別戦闘の恐れ)= ${reviews.length} 件 ${apply && includeReview ? '★書込対象(--include-review)★' : '(既定スキップ)'} ===`);
  for (const p of reviews) fmt(p);
  console.log(`\n  REVIEW 小計: ${reviews.length} 表 (要目視確認)\n`);

  const target = includeReview ? plans : highs;

  if (!apply) {
    console.log(`*** ドライラン。書き込みませんでした。`);
    console.log(`    HIGH のみ実書込 = --apply / REVIEW も含める = --apply --include-review ***`);
    return;
  }

  console.log(`=== 実書込開始 (${includeReview ? 'HIGH+REVIEW' : 'HIGH のみ'}) ===`);

  // 安全装置①: 書込前に対象表の「現在の生ドキュメント」をローカルへ退避(巻き戻し用)。
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = resolve(ROOT, 'docs/.private/backups');
  mkdirSync(backupDir, { recursive: true });
  const preDocs: Record<string, any> = {};
  for (const { target: t } of target) {
    const cur = await db.collection('plans').doc(t.id).get();
    preDocs[t.id] = cur.exists ? cur.data() : null;
  }
  const backupPath = resolve(backupDir, `pre-restore_${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(preDocs, null, 2), 'utf-8');
  console.log(`  🛟 書込前バックアップ: ${backupPath}\n`);

  let done = 0, skipped = 0;
  for (const { target: t, source } of target) {
    const tRef = db.collection('plans').doc(t.id);
    // 安全装置②: 書込直前に最新を再取得。軽減がもう 0 でない(本人が置き直した等)なら触らない。
    const fresh = (await tRef.get()).data();
    const freshMit = Array.isArray(fresh?.data?.timelineMitigations) ? fresh.data.timelineMitigations.length : 0;
    if (freshMit !== 0) { console.log(`  ⏭ skip(既に軽減${freshMit}個=本人が復旧済の可能性): "${t.title.replace(/\n/g, ' ')}" ${t.id}`); skipped++; continue; }
    if (source.mit <= 0) { console.log(`  ⏭ skip(復元元が空): ${t.id}`); skipped++; continue; }

    const newVersion = (typeof fresh?.version === 'number' ? fresh.version : t.version) + 1;
    await tRef.set({
      data: source.data,
      updatedAt: FieldValue.serverTimestamp(),
      version: newVersion,
      deleted: FieldValue.delete(),
      deletedAt: FieldValue.delete(),
    }, { merge: true });

    // 安全装置③: 書込後に再読込して軽減が入ったか検証。
    const after = (await tRef.get()).data();
    const afterMit = Array.isArray(after?.data?.timelineMitigations) ? after.data.timelineMitigations.length : 0;
    const ok = afterMit === source.mit;
    done++;
    console.log(`  ${ok ? '✅' : '⚠'} "${t.title.replace(/\n/g, ' ')}" ${t.id} ← ${source.id}  軽減 0→${afterMit} (期待${source.mit}) v${newVersion}`);
  }
  console.log(`\n完了: ${done} 表を復元 / ${skipped} 件スキップ。巻き戻し用バックアップ: ${backupPath}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
