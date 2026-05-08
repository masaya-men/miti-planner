/**
 * inspect-user-plans.ts
 * 全ユーザーのプラン数とコンテンツ別内訳を集計する一回限りの調査スクリプト
 * 使い方: npx tsx scripts/inspect-user-plans.ts
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

async function main() {
  console.log('=== plans コレクション集計 ===');
  const plansSnap = await db.collection('plans').get();
  console.log(`総プラン数: ${plansSnap.size}`);

  // owner 別集計
  const byOwner = new Map<string, { total: number; byContent: Map<string, number>; titles: string[] }>();
  for (const doc of plansSnap.docs) {
    const data = doc.data();
    const ownerId = data.ownerId || '(no-owner)';
    const contentId = data.contentId || '(no-content)';
    const title = data.title || '(no-title)';
    if (!byOwner.has(ownerId)) {
      byOwner.set(ownerId, { total: 0, byContent: new Map(), titles: [] });
    }
    const owner = byOwner.get(ownerId)!;
    owner.total++;
    owner.byContent.set(contentId, (owner.byContent.get(contentId) || 0) + 1);
    const createdAt = data.createdAt?.toDate?.()?.toISOString() || '?';
    const updatedAt = data.updatedAt?.toDate?.()?.toISOString() || '?';
    owner.titles.push(`    ${doc.id}\n      contentId=${contentId}  title="${title}"\n      createdAt=${createdAt}\n      updatedAt=${updatedAt}`);
  }

  console.log(`\n=== ユーザー別 (${byOwner.size} 人) ===`);
  const sortedOwners = [...byOwner.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [uid, info] of sortedOwners) {
    console.log(`\nUID: ${uid}`);
    console.log(`  total: ${info.total}`);
    console.log(`  byContent:`);
    const sortedContents = [...info.byContent.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cid, count] of sortedContents) {
      const flag = count >= 5 ? ' <-- 上限到達' : '';
      console.log(`    ${cid}: ${count}${flag}`);
    }
    console.log(`  プラン詳細 (id / contentId / title / createdAt / updatedAt):`);
    for (const t of info.titles) console.log(t);
  }

  // userPlanCounts 集計
  console.log(`\n\n=== userPlanCounts コレクション ===`);
  const countsSnap = await db.collection('userPlanCounts').get();
  console.log(`カウンタードキュメント数: ${countsSnap.size}`);
  for (const doc of countsSnap.docs) {
    const data = doc.data();
    console.log(`\nUID: ${doc.id}`);
    console.log(`  total: ${data.total}`);
    console.log(`  byContent:`, JSON.stringify(data.byContent || {}, null, 2));
    // 実態と乖離していないか
    const actualOwner = byOwner.get(doc.id);
    if (actualOwner) {
      const actualTotal = actualOwner.total;
      if (actualTotal !== data.total) {
        console.log(`  !! カウンター(${data.total}) と 実態(${actualTotal}) が乖離`);
      }
      for (const [cid, actualCount] of actualOwner.byContent) {
        const counterCount = (data.byContent || {})[cid] || 0;
        if (counterCount !== actualCount) {
          console.log(`  !! ${cid}: カウンター(${counterCount}) vs 実態(${actualCount})`);
        }
      }
    } else {
      console.log(`  !! plans に該当 ownerId のプラン無し（カウンターだけ残ってる）`);
    }
  }

  // ユーザー名の対応
  console.log(`\n\n=== users コレクション (UID 対応表) ===`);
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    console.log(`  ${doc.id}  displayName="${data.displayName}"  provider=${data.provider}`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
