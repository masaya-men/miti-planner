/**
 * migrate-skill-version-skew.ts
 * 「同id版違いバグ」の外科的マイグレーション。
 *
 * 背景: mockData/Firestore で 5技(秘策/展開戦術/ゾーエ/アサイラム/テトラグラマトン)が
 *   「同じ id で2回」定義され、低レベル版と高レベル版が同名 id を共有していた。
 *   競合判定 new Map(後勝ち) が低レベル版(旧・長recast / charge無し)を引き、誤った CD競合グローを出していた。
 * 修正: 低レベル版(=maxLevel を持つ方)の id だけを `${id}_base` に改名する。
 *   高レベル版(bare id)は据え置き → 既存 Lv100 保存プラン(bare id 参照)は無傷。
 *   mockData 側は既に _base 化済み(本スクリプトは Firestore を同じ状態へ揃える)。
 *
 * 触るもの: master/skills.mitigations の該当5エントリの id / master/skills.displayOrder / master/config.dataVersion のみ。
 *   他スキル・admin 編集値・他フィールドは一切変更しない(FORCE 全上書きではない)。
 *
 * 使い方:
 *   npx tsx scripts/migrate-skill-version-skew.ts            # dry-run(既定・書き込みゼロ)
 *   npx tsx scripts/migrate-skill-version-skew.ts --apply    # 本番に適用 + dataVersion++
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

// 低レベル版を _base 化する対象 id(高レベル版は bare のまま据え置き)
const TARGET_IDS = new Set(['recitation', 'deployment_tactics', 'zoe', 'asylum', 'tetragrammaton']);

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
  console.error('❌ .env.local に FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY が必要');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

console.log(`=== skill version-skew migration (${APPLY ? '🔴 APPLY' : '🟢 DRY-RUN'}) ===\n`);

const skillsSnap = await db.doc('master/skills').get();
const configSnap = await db.doc('master/config').get();
if (!skillsSnap.exists) {
  console.error('master/skills が存在しません');
  process.exit(1);
}
const data = skillsSnap.data()!;
const mits: any[] = Array.isArray(data.mitigations) ? data.mitigations : [];
const displayOrder: string[] = Array.isArray(data.displayOrder) ? [...data.displayOrder] : [];

// 1) 低レベル版(maxLevel を持つ方)の id を _base 化
let renamed = 0;
const renames: string[] = [];
const newMits = mits.map((m) => {
  if (TARGET_IDS.has(m.id) && m.maxLevel != null) {
    const newId = `${m.id}_base`;
    renames.push(`  ${m.id} → ${newId}  (recast=${m.recast} minLevel=${m.minLevel} maxLevel=${m.maxLevel} maxCharges=${m.maxCharges ?? '∅'})`);
    renamed++;
    return { ...m, id: newId };
  }
  return m;
});

console.log(`【1】 mitigations 低レベル版 id 改名: ${renamed} 件`);
console.log(renames.join('\n') || '  (対象なし=既に移行済みの可能性)');

// 改名後に重複 id が残っていないか健全性チェック
const idCount = new Map<string, number>();
for (const m of newMits) idCount.set(m.id, (idCount.get(m.id) ?? 0) + 1);
const remainingDups = [...idCount.entries()].filter(([, c]) => c > 1);
console.log(`  改名後の残存重複 id: ${remainingDups.length ? remainingDups.map(([id, c]) => `${id}×${c}`).join(', ') : '(なし=健全)'}`);

// 2) displayOrder に _base を bare の直前へ挿入(未挿入のものだけ)
let orderInserts = 0;
for (const id of TARGET_IDS) {
  const baseId = `${id}_base`;
  if (displayOrder.includes(baseId)) continue;
  const idx = displayOrder.indexOf(id);
  if (idx === -1) {
    console.log(`  ⚠ displayOrder に '${id}' が無い(末尾に追加扱い): ${baseId}`);
    displayOrder.push(baseId);
  } else {
    displayOrder.splice(idx, 0, baseId);
  }
  orderInserts++;
}
console.log(`\n【2】 displayOrder への _base 挿入: ${orderInserts} 件`);

// 3) dataVersion ++
const curVersion = configSnap.data()?.dataVersion ?? null;
console.log(`\n【3】 dataVersion: ${curVersion} → ${curVersion != null ? curVersion + 1 : '(FieldValue.increment 1)'}`);

if (!APPLY) {
  console.log('\n🟢 DRY-RUN 完了。書き込みは行っていません。適用するには --apply を付けて再実行。');
  process.exit(0);
}

if (renamed === 0 && orderInserts === 0) {
  console.log('\n変更なし(既に移行済み)。dataVersion も据え置き、終了。');
  process.exit(0);
}

await db.doc('master/skills').update({ mitigations: newMits, displayOrder });
await db.doc('master/config').update({ dataVersion: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
console.log('\n🔴 APPLY 完了: master/skills(mitigations,displayOrder) 更新 + master/config.dataVersion++。');
console.log('   クライアントは次回起動で dataVersion 不一致を検知して再取得します。');
