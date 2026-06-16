/**
 * restore-from-backup-sweep.ts
 * 復元済みバックアップDB(例 recovery-0608)と本番(default)を「同じプランID」で突き合わせ、
 * 「バックアップでは軽減あり × 本番では軽減ゼロ(イベントは残存)」= 被害確定 を全件あぶり出す。
 * ヒューリスティック(タイトル/イベント数)に頼らず ID 一致なので、検知漏れも拾える。
 *
 * 既定はドライラン。--apply で実書込(本番の壊れた表だけに backup.data を書き戻す)。
 * 安全装置: 書込前にローカル退避 / 書込直前に本番を再取得し軽減が今も0の表だけ / 書込後に検証。
 *
 * 使い方:
 *   npx tsx scripts/restore-from-backup-sweep.ts --db recovery-0608
 *   npx tsx scripts/restore-from-backup-sweep.ts --db recovery-0608 --apply
 *   npx tsx scripts/restore-from-backup-sweep.ts --db recovery-0608 --apply --only <id1>,<id2>
 *   npx tsx scripts/restore-from-backup-sweep.ts --db recovery-0608 --skip <id1>,<id2>
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
const app = initializeApp({ credential: cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') }) });

const arrLen = (a: any) => (Array.isArray(a) ? a.length : 0);
const iso = (t: any) => t?.toDate?.()?.toISOString?.() || '?';
const apply = process.argv.includes('--apply');
const dbId = (() => { const i = process.argv.indexOf('--db'); return i >= 0 ? process.argv[i + 1] : ''; })();
const onlyArg = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? (process.argv[i + 1] || '').split(',').filter(Boolean) : null; })();
const skipArg = (() => { const i = process.argv.indexOf('--skip'); return i >= 0 ? (process.argv[i + 1] || '').split(',').filter(Boolean) : []; })();
if (!dbId) { console.error('--db <バックアップDB名> が必要です(例 --db recovery-0608)'); process.exit(1); }

const liveDb = getFirestore(app); // (default)
const bkDb = getFirestore(app, dbId);

interface Cmp {
  id: string; title: string; owner: string;
  bMit: number; bEv: number; lMit: number; lEv: number;
  bVer: number; lVer: number; liveDeleted: boolean; collab: boolean; lUpdated: string;
  bData: any;
}

async function main() {
  console.log(`バックアップDB "${dbId}" と本番を読み込み中...`);
  const [bkSnap, liveSnap] = await Promise.all([bkDb.collection('plans').get(), liveDb.collection('plans').get()]);
  const live = new Map<string, any>();
  for (const d of liveSnap.docs) live.set(d.id, d.data());
  console.log(`  backup plans=${bkSnap.size} / live plans=${liveSnap.size}\n`);

  const victims: Cmp[] = [];
  const partials: Cmp[] = [];
  for (const bdoc of bkSnap.docs) {
    const b = bdoc.data();
    const bMit = arrLen(b.data?.timelineMitigations);
    if (bMit === 0) continue; // バックアップに軽減が無ければ復元元にならない
    const l = live.get(bdoc.id);
    if (!l) continue; // 本番から消えている(削除済) = 意図的削除の可能性 → 触らない
    const lMit = arrLen(l.data?.timelineMitigations);
    const lEv = arrLen(l.data?.timelineEvents);
    const row: Cmp = {
      id: bdoc.id, title: String(l.title || b.title || ''), owner: String(l.ownerId || '').slice(0, 20),
      bMit, bEv: arrLen(b.data?.timelineEvents), lMit, lEv,
      bVer: typeof b.version === 'number' ? b.version : 0, lVer: typeof l.version === 'number' ? l.version : 0,
      liveDeleted: l.deleted === true, collab: !!l.activeCollabRoomToken, lUpdated: iso(l.updatedAt), bData: b.data,
    };
    if (lMit === 0 && lEv > 0 && !row.liveDeleted) victims.push(row);
    else if (lMit > 0 && lMit < bMit * 0.4 && !row.liveDeleted) partials.push(row); // 部分被害の疑い(参考)
  }

  victims.sort((a, b) => b.bMit - a.bMit);
  console.log(`=== 被害確定(6/8は軽減あり × 本番ゼロ)= ${victims.length} 件 ===`);
  for (const v of victims) {
    const vj = v.lVer - v.bVer;
    const caution = vj > 30 ? ` ⚠本番v+${vj}(6/8後に編集多=要注意)` : '';
    console.log(`  6/8 mit=${v.bMit} → 本番 mit=0  ev=${v.lEv} "${v.title.replace(/\n/g, ' ')}" ${v.id} owner=${v.owner}${caution}`);
  }
  if (partials.length) {
    console.log(`\n=== 部分被害の疑い(参考・自動復元しない)= ${partials.length} 件 ===`);
    for (const p of partials) console.log(`  6/8 mit=${p.bMit} → 本番 mit=${p.lMit} "${p.title.replace(/\n/g, ' ')}" ${p.id}`);
  }

  const todo = victims.filter((v) => (!onlyArg || onlyArg.includes(v.id)) && !skipArg.includes(v.id));
  console.log(`\n対象: ${todo.length} 件 / 復元される軽減 のべ ${todo.reduce((s, v) => s + v.bMit, 0)} 個`);

  if (!apply) { console.log(`\n*** ドライラン。書き込みませんでした。実行は --apply ***`); return; }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = resolve(ROOT, 'docs/.private/backups');
  mkdirSync(backupDir, { recursive: true });
  const preDocs: Record<string, any> = {};
  for (const v of todo) { const c = await liveDb.collection('plans').doc(v.id).get(); preDocs[v.id] = c.exists ? c.data() : null; }
  const backupPath = resolve(backupDir, `pre-restore-backupsweep_${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(preDocs, null, 2), 'utf-8');
  console.log(`\n  🛟 書込前バックアップ: ${backupPath}\n`);

  let done = 0, skipped = 0;
  for (const v of todo) {
    const ref = liveDb.collection('plans').doc(v.id);
    const fresh = (await ref.get()).data();
    const freshMit = arrLen(fresh?.data?.timelineMitigations);
    if (freshMit !== 0) { console.log(`  ⏭ skip(既に軽減${freshMit}個): "${v.title.replace(/\n/g, ' ')}" ${v.id}`); skipped++; continue; }
    const newVersion = (typeof fresh?.version === 'number' ? fresh.version : v.lVer) + 1;
    await ref.set({ data: v.bData, updatedAt: FieldValue.serverTimestamp(), version: newVersion, deleted: FieldValue.delete(), deletedAt: FieldValue.delete() }, { merge: true });
    const after = (await ref.get()).data();
    const afterMit = arrLen(after?.data?.timelineMitigations);
    done++;
    console.log(`  ${afterMit === v.bMit ? '✅' : '⚠'} "${v.title.replace(/\n/g, ' ')}" ${v.id}  軽減 0→${afterMit} (期待${v.bMit}) v${newVersion}`);
  }
  console.log(`\n完了: ${done} 表を復元 / ${skipped} スキップ。巻き戻し用: ${backupPath}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error('エラー:', e?.message || e); process.exit(1); });
