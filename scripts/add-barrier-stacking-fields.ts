/**
 * add-barrier-stacking-fields.ts (外科的アップデート)
 * Firestore /master/skills.mitigations の各バリア def に
 * barrierStackGroup / barrierConsumptionPriority を反映する。
 * 値は src/data/mockData.ts の MITIGATIONS から読む(スクリプト内にベタ書きしない)。
 * この2フィールド以外・対象外スキルは一切変更しない(管理画面での編集を保護)。
 * 最後に dataVersion を +1 してクライアントに再取得させる。
 *
 * 背景: バリアの重なり方ルール(Task 1-6・2026-08-27)で mockData の各バリア def に
 *   barrierStackGroup / barrierConsumptionPriority を付けた。しかし実行時の MITIGATIONS は
 *   useMitigations() 経由で Firestore /master/skills から読まれ、mockData は静的フォールバック
 *   でしかない(src/hooks/useSkillsData.ts:22-25)。seed-skills-stats.ts の既定 ADDITIVE モードは
 *   「新規 id」しか追加しないため、既存 def のこれらのフィールドは Firestore に反映されず本番で無効。
 *   --force-overwrite は既存 def を丸ごと mockData 値に戻し管理画面編集も巻き戻すため使えない。
 *   よってこの2フィールドだけを外科的に同期する専用スクリプトを用意する。
 *
 * 使い方:
 *   npx tsx scripts/add-barrier-stacking-fields.ts          # dry-run(差分表示のみ・既定)
 *   npx tsx scripts/add-barrier-stacking-fields.ts --apply  # 実書き込み + dataVersion +1
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { MITIGATIONS } from '../src/data/mockData';

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

const APPLY = process.argv.includes('--apply');
const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));
const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const snap = await db.doc('master/skills').get();
if (!snap.exists) { console.error('master/skills が存在しません'); process.exit(1); }
const data = snap.data()!;
const mits: any[] = data.mitigations ?? [];

// ── mockData から「反映すべき値」を組み立てる(スクリプト内にベタ書きしない) ──
type Want = { barrierStackGroup?: string; barrierConsumptionPriority?: number };
const desiredById = new Map<string, Want>();
for (const def of MITIGATIONS) {
  if (def.barrierStackGroup === undefined && def.barrierConsumptionPriority === undefined) continue;
  const want: Want = {};
  if (def.barrierStackGroup !== undefined) want.barrierStackGroup = def.barrierStackGroup;
  if (def.barrierConsumptionPriority !== undefined) want.barrierConsumptionPriority = def.barrierConsumptionPriority;
  desiredById.set(def.id, want);
}

const groupCount = [...desiredById.values()].filter((w) => w.barrierStackGroup !== undefined).length;
const priorityCount = [...desiredById.values()].filter((w) => w.barrierConsumptionPriority !== undefined).length;

// ── Firestore に存在しない mockData id は警告のみ(書き込まない) ──
const fsIds = new Set(mits.map((m) => m.id));
const missing = [...desiredById.keys()].filter((id) => !fsIds.has(id));

// ── 差分を計算(既に同じ値なら触らない) ──
type FieldChange = { id: string; field: string; from: unknown; to: unknown };
const changes: FieldChange[] = [];

const updatedMits = mits.map((m) => {
  const want = desiredById.get(m.id);
  if (!want) return m;
  let next = m;
  if (want.barrierConsumptionPriority !== undefined && m.barrierConsumptionPriority !== want.barrierConsumptionPriority) {
    changes.push({ id: m.id, field: 'barrierConsumptionPriority', from: m.barrierConsumptionPriority, to: want.barrierConsumptionPriority });
    next = { ...next, barrierConsumptionPriority: want.barrierConsumptionPriority };
  }
  if (want.barrierStackGroup !== undefined && m.barrierStackGroup !== want.barrierStackGroup) {
    changes.push({ id: m.id, field: 'barrierStackGroup', from: m.barrierStackGroup, to: want.barrierStackGroup });
    next = { ...next, barrierStackGroup: want.barrierStackGroup };
  }
  return next;
});

// ── セーフティ: 意図しない id を触っていないか ──
const changedIds = new Set(updatedMits.filter((m, i) => m !== mits[i]).map((m) => m.id));
const expectedIds = new Set(changes.map((c) => c.id));
const unexpected = [...changedIds].filter((id) => !expectedIds.has(id));
if (unexpected.length) {
  console.error('❌ 想定外の変更を検出、中止:', unexpected.join(', '));
  process.exit(1);
}

// ── レポート ──
const fmt = (v: unknown) => (v === undefined ? 'undefined(未設定)' : JSON.stringify(v));
const affectedIds = [...new Set(changes.map((c) => c.id))];

console.log(`対象 def (mockData で barrierStackGroup/Priority を持つ): ${desiredById.size} 件`);
console.log(`  内訳: barrierStackGroup 付き ${groupCount} 件 / barrierConsumptionPriority 付き ${priorityCount} 件`);
console.log(`  うち Firestore に存在: ${desiredById.size - missing.length} 件 / 不在: ${missing.length} 件`);
if (missing.length) {
  console.warn(`⚠ Firestore に存在しない mockData id (書き込まない):`);
  console.warn(`   ${missing.join(', ')}`);
}

console.log(`\n変更が必要: ${affectedIds.length} スキル / ${changes.length} フィールド`);
for (const id of affectedIds) {
  console.log(`[変更] ${id}`);
  for (const c of changes.filter((x) => x.id === id)) {
    console.log(`   ${c.field}: ${fmt(c.from)} → ${fmt(c.to)}`);
  }
}
if (!changes.length) console.log('(変更なし = Firestore は既に mockData と一致)');

if (!APPLY) {
  console.log('\n(dry-run) 実書き込みは --apply を付けて再実行');
  process.exit(0);
}

if (!changes.length) {
  console.log('\n変更が無いため書き込み・dataVersion 更新ともにスキップ');
  process.exit(0);
}

await db.doc('master/skills').set({ ...data, mitigations: updatedMits });
await db.doc('master/config').set({ dataVersion: FieldValue.increment(1) }, { merge: true });
console.log(`\n✅ 書き込み完了 (${affectedIds.length} スキル / ${changes.length} フィールド更新) + dataVersion +1`);
