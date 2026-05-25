/**
 * measure-plan-size.ts
 * 全プランの Firestore ドキュメントサイズを実測し、Top 10 を内訳付きで出力。
 * 用途: 軽減表メモ機能 (#56) の容量設計のため、 最重量プラン (絶エデン野良主流など) の
 *       実サイズを把握し、 メモ用に残せる容量と上限値の妥当性を判断する。
 * 使い方: npx tsx scripts/measure-plan-size.ts
 *
 * 注意: .env.local の FIREBASE_PRIVATE_KEY が改行潰れで壊れている場合は
 *       `vercel env pull` で修復してから実行する (memory feedback_vercel_env_sensitive)
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

function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf-8');
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const FIRESTORE_LIMIT = 1024 * 1024; // 1 MB

async function main() {
  console.log('=== plans サイズ計測 ===\n');
  const plansSnap = await db.collection('plans').get();
  console.log(`総プラン数: ${plansSnap.size}\n`);

  const usersSnap = await db.collection('users').get();
  const displayNameByUid = new Map<string, string>();
  for (const doc of usersSnap.docs) {
    displayNameByUid.set(doc.id, doc.data().displayName || '(no-name)');
  }

  type PlanRecord = {
    id: string;
    ownerId: string;
    ownerName: string;
    title: string;
    contentId: string;
    totalBytes: number;
    breakdown: Record<string, number>;
    timelineEventsCount: number;
    timelineMitigationsCount: number;
    archived: boolean;
  };

  const records: PlanRecord[] = [];
  for (const doc of plansSnap.docs) {
    const data = doc.data();
    const ownerId = data.ownerId || '(no-owner)';
    const planData = data.data || {};
    const breakdown: Record<string, number> = {
      'data.timelineEvents': byteSize(planData.timelineEvents),
      'data.timelineMitigations': byteSize(planData.timelineMitigations),
      'data.phases': byteSize(planData.phases),
      'data.labels': byteSize(planData.labels),
      'data.partyMembers': byteSize(planData.partyMembers),
      'data.aaSettings': byteSize(planData.aaSettings),
      'data.schAetherflowPatterns': byteSize(planData.schAetherflowPatterns),
      'top-level メタ': byteSize({ ...data, data: undefined, compressedData: undefined }),
    };
    if (data.compressedData) {
      breakdown['compressedData (archived)'] = byteSize(data.compressedData);
    }
    const totalBytes = byteSize(data);
    records.push({
      id: doc.id,
      ownerId,
      ownerName: displayNameByUid.get(ownerId) || '(unknown)',
      title: data.title || '(no-title)',
      contentId: data.contentId || '(no-content)',
      totalBytes,
      breakdown,
      timelineEventsCount: Array.isArray(planData.timelineEvents) ? planData.timelineEvents.length : 0,
      timelineMitigationsCount: Array.isArray(planData.timelineMitigations) ? planData.timelineMitigations.length : 0,
      archived: !!data.archived,
    });
  }

  // サイズ降順
  records.sort((a, b) => b.totalBytes - a.totalBytes);

  // Top 10
  console.log('=== サイズ Top 10 ===\n');
  for (let i = 0; i < Math.min(10, records.length); i++) {
    const r = records[i];
    const archMark = r.archived ? ' [archived]' : '';
    console.log(`#${i + 1}  ${fmtBytes(r.totalBytes)}${archMark}  contentId=${r.contentId}  title="${r.title}"`);
    console.log(`     id=${r.id}`);
    console.log(`     owner="${r.ownerName}" (${r.ownerId})`);
    console.log(`     timelineEvents=${r.timelineEventsCount}  timelineMitigations=${r.timelineMitigationsCount}`);
    console.log(`     内訳:`);
    const entries = Object.entries(r.breakdown).sort((a, b) => b[1] - a[1]);
    for (const [k, v] of entries) {
      const pct = ((v / r.totalBytes) * 100).toFixed(1);
      console.log(`       ${k.padEnd(36)} ${fmtBytes(v).padStart(10)}  (${pct}%)`);
    }
    console.log('');
  }

  // 統計
  console.log('=== 全プラン統計 ===');
  const sizes = records.map(r => r.totalBytes).sort((a, b) => a - b);
  const total = sizes.reduce((a, b) => a + b, 0);
  const avg = sizes.length ? total / sizes.length : 0;
  const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const p90 = sizes.length ? sizes[Math.floor(sizes.length * 0.9)] : 0;
  const max = sizes.length ? sizes[sizes.length - 1] : 0;
  const min = sizes.length ? sizes[0] : 0;
  console.log(`  total:  ${fmtBytes(total)}`);
  console.log(`  avg:    ${fmtBytes(avg)}`);
  console.log(`  median: ${fmtBytes(median)}`);
  console.log(`  p90:    ${fmtBytes(p90)}`);
  console.log(`  max:    ${fmtBytes(max)}`);
  console.log(`  min:    ${fmtBytes(min)}`);

  // メモ機能の容量設計向け試算
  console.log(`\n=== Firestore 1MB 上限への余裕 (最大プラン基準) ===`);
  console.log(`  最大プラン: ${fmtBytes(max)} (${((max / FIRESTORE_LIMIT) * 100).toFixed(1)}% of 1MB)`);
  console.log(`  残り余裕:   ${fmtBytes(FIRESTORE_LIMIT - max)} (${(((FIRESTORE_LIMIT - max) / FIRESTORE_LIMIT) * 100).toFixed(1)}%)`);
  console.log(`\n  メモ機能 (#56) 容量試算:`);
  // メモ 1 個 = { id, time, x, y, text, createdAt } ≈ JSON overhead 80B + text(UTF-8)
  // 500 文字想定 (UTF-8 で日本語混じり 1500B) → 1 個 ≈ 1580B ≈ 1.5KB
  const PER_MEMO_OVERHEAD = 80;
  const PER_MEMO_TEXT_500CHARS_JP = 1500;
  const memoSize = PER_MEMO_OVERHEAD + PER_MEMO_TEXT_500CHARS_JP;
  const fittable = Math.floor((FIRESTORE_LIMIT - max) / memoSize);
  console.log(`    メモ 1 個 = ${memoSize}B 想定 (overhead 80B + 日本語 500 文字 1500B)`);
  console.log(`    最大プランに格納可能なメモ数: 約 ${fittable} 個 (理論値)`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
