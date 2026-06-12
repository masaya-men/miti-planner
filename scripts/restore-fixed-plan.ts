/**
 * restore-fixed-plan.ts
 * 破損した live プラン(空で上書きされた)を、削除済み(墓標)コピーの中身で復元する。
 * 既定はドライラン(書き込まない)。--apply で実書込。
 * 使い方: npx tsx scripts/restore-fixed-plan.ts <targetLiveDocId> <sourceTombstoneDocId> [--apply]
 *
 * 復元仕様: target の data を source の data で置換し、updatedAt=now / version++ / deleted=false。
 * 他フィールド(ownerId/title/contentId 等)は merge:true で温存。source(墓標)は触らない。
 */
import { readFileSync } from 'node:fs';
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

const targetId = process.argv[2];
const sourceId = process.argv[3];
const apply = process.argv.includes('--apply');
if (!targetId || !sourceId) {
  console.error('使い方: npx tsx scripts/restore-fixed-plan.ts <targetLiveDocId> <sourceTombstoneDocId> [--apply]');
  process.exit(1);
}

function sum(label: string, data: any) {
  const d = (data && data.data) || {};
  const pm = Array.isArray(d.partyMembers) ? d.partyMembers.length : '?';
  const mit = Array.isArray(d.timelineMitigations) ? d.timelineMitigations.length : '?';
  const ev = Array.isArray(d.timelineEvents) ? d.timelineEvents.length : '?';
  console.log(`  ${label}: title="${data?.title}" deleted=${data?.deleted ?? false} version=${data?.version} lvl=${d.currentLevel} party=${pm} mit=${mit} events=${ev}`);
}

async function main() {
  const tRef = db.collection('plans').doc(targetId);
  const sRef = db.collection('plans').doc(sourceId);
  const [tSnap, sSnap] = await Promise.all([tRef.get(), sRef.get()]);
  if (!tSnap.exists) { console.error(`target ${targetId} が存在しません`); process.exit(1); }
  if (!sSnap.exists) { console.error(`source ${sourceId} が存在しません`); process.exit(1); }
  const tData = tSnap.data()!;
  const sData = sSnap.data()!;

  console.log('=== 復元前 ===');
  sum('source(墓標・復元元)', sData);
  sum('target(現状・上書きされる)', tData);

  const newVersion = (typeof tData.version === 'number' ? tData.version : 0) + 1;
  console.log(`\n=== 実行内容 ===`);
  console.log(`  target ${targetId} の data を source の data(軽減 ${Array.isArray(sData.data?.timelineMitigations) ? sData.data.timelineMitigations.length : '?'} 個)で置換`);
  console.log(`  updatedAt=now / version=${newVersion} / deleted=false / title・ownerId・contentId は温存`);

  if (!apply) {
    console.log(`\n*** ドライラン(--apply なし)。書き込みませんでした。***`);
    return;
  }

  await tRef.set({
    data: sData.data,
    updatedAt: FieldValue.serverTimestamp(),
    version: newVersion,
    deleted: FieldValue.delete(),
    deletedAt: FieldValue.delete(),
  }, { merge: true });
  console.log(`\n✅ 書込完了: ${targetId} を復元しました。`);

  const after = await tRef.get();
  sum('target(復元後)', after.data());
}

main().then(() => process.exit(0)).catch((err) => { console.error('エラー:', err); process.exit(1); });
