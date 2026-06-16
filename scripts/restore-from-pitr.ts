/**
 * restore-from-pitr.ts
 * 全消し(空上書き)された live プランを、Firestore PITR の「直前の健全版」で復元する。
 * 既定はドライラン(書き込まない)。--apply で実書込。
 *
 * 使い方:
 *   npx tsx scripts/restore-from-pitr.ts <liveDocId> <readTimeISO> [--apply]
 *   例: npx tsx scripts/restore-from-pitr.ts plan_31aee72d-... 2026-06-16T06:32:00Z --apply
 *
 * 復元仕様(restore-fixed-plan.ts と同型):
 *   - target.data = (PITR readTime 時点の data) 丸ごと置換 / version++ / updatedAt=now / deleted 解除
 *   - title・ownerId・contentId 等は merge:true で温存。
 * 安全装置:
 *   ① 復元元(PITR)の mit が現在(0)以下なら中止(増えないなら無意味/誤読防止)
 *   ② 書込前に現在の生ドキュメントを docs/.private/backups/ へ退避(巻き戻し用)
 *   ③ 書込直前に最新を再取得。mit が既に 0 でない(本人が置き直した)なら触らない
 *   ④ 書込後に再読込して mit が入ったか検証
 *
 * PITR 読み取りは read-only トランザクション + readTime(getAll の readTime は無効なので不可)。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

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

const targetId = process.argv[2];
const readTimeIso = process.argv[3];
const apply = process.argv.includes('--apply');
if (!targetId || !readTimeIso) {
  console.error('使い方: npx tsx scripts/restore-from-pitr.ts <liveDocId> <readTimeISO> [--apply]');
  process.exit(1);
}

const arrLen = (a: any) => (Array.isArray(a) ? a.length : -1);
function sum(label: string, data: any) {
  const d = (data && data.data) || {};
  const ua = data?.updatedAt?.toDate?.()?.toISOString?.() || '?';
  console.log(`  ${label}: title="${String(data?.title || '').replace(/\n/g, ' ')}" deleted=${data?.deleted ?? false} v${data?.version} party=${arrLen(d.partyMembers)} mit=${arrLen(d.timelineMitigations)} ev=${arrLen(d.timelineEvents)} updatedAt=${ua}`);
}

async function main() {
  const ref = db.collection('plans').doc(targetId);
  const nowSnap = await ref.get();
  if (!nowSnap.exists) { console.error(`target ${targetId} が存在しません`); process.exit(1); }
  const cur = nowSnap.data()!;

  // PITR 直前版を read-only tx + readTime で取得
  const readTime = Timestamp.fromDate(new Date(readTimeIso));
  const pitr = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    return s.exists ? s.data() : null;
  }, { readOnly: true, readTime } as any);

  console.log('=== 復元前 ===');
  sum(`PITR@${readTimeIso}(復元元)`, pitr);
  sum('現在(上書きされる)', cur);

  const srcMit = arrLen(pitr?.data?.timelineMitigations);
  const curMit = arrLen(cur?.data?.timelineMitigations);
  if (srcMit <= 0) { console.error(`\n中止: PITR 復元元の mit=${srcMit} (健全版ではない)。readTime を見直してください。`); process.exit(1); }
  if (srcMit <= curMit) { console.error(`\n中止: 復元元 mit=${srcMit} <= 現在 mit=${curMit} (増えないので無意味)。`); process.exit(1); }

  const newVersion = (typeof cur.version === 'number' ? cur.version : 0) + 1;
  console.log(`\n=== 実行内容 ===`);
  console.log(`  ${targetId} の data を PITR@${readTimeIso} の data(mit ${srcMit} 個)で置換 / v${newVersion} / updatedAt=now / title・owner・contentId 温存`);

  if (!apply) {
    console.log(`\n*** ドライラン(--apply なし)。書き込みませんでした。***`);
    return;
  }

  // 安全装置②: 書込前バックアップ
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = resolve(ROOT, 'docs/.private/backups');
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolve(backupDir, `pre-pitr-restore_${targetId}_${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify({ current: cur, pitrSource: pitr, readTimeIso }, null, 2), 'utf-8');
  console.log(`  🛟 書込前バックアップ: ${backupPath}`);

  // 安全装置③: 書込直前に再取得。mit が 0 でなければ本人が復旧済 → 触らない
  const fresh = (await ref.get()).data();
  const freshMit = arrLen(fresh?.data?.timelineMitigations);
  if (freshMit > 0) { console.log(`  ⏭ skip(既に mit=${freshMit}=本人が復旧済の可能性)。書き込みません。`); return; }

  await ref.set({
    data: pitr!.data,
    updatedAt: FieldValue.serverTimestamp(),
    version: newVersion,
    deleted: FieldValue.delete(),
    deletedAt: FieldValue.delete(),
  }, { merge: true });

  // 安全装置④: 検証
  const after = (await ref.get()).data();
  const afterMit = arrLen(after?.data?.timelineMitigations);
  console.log(`\n  ${afterMit === srcMit ? '✅' : '⚠'} 復元: mit 0→${afterMit} (期待${srcMit}) v${newVersion}`);
  sum('復元後', after);
  console.log(`\n巻き戻し用バックアップ: ${backupPath}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error('エラー:', e?.message || e); process.exit(1); });
