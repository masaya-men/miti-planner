/**
 * inspect-skill-recast-diff.ts (読み取り専用)
 * Firestore /master/skills.mitigations と mockData.ts を突き合わせ、
 * 値が食い違うフィールド(主に管理画面での recast 等の編集)を一覧表示する。
 * 書き込みは一切しない。seed で何が上書きされてしまうかを事前に把握するための調査用。
 *
 * 使い方: npx tsx scripts/inspect-skill-recast-diff.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
if (!snap.exists) {
  console.error('master/skills が存在しません');
  process.exit(1);
}
const fsMits: any[] = snap.data()?.mitigations ?? [];
const fsById = new Map(fsMits.map(m => [m.id, m]));
const mockById = new Map(MITIGATIONS.map(m => [m.id, m]));

// 比較対象フィールド(数値・基本設定)。name/icon/note 等の表記揺れは無視。
const FIELDS = ['recast', 'duration', 'value', 'valuePhysical', 'valueMagical', 'type', 'scope', 'minLevel', 'maxLevel', 'isShield', 'burstValue', 'burstDuration'];

let diffCount = 0;
console.log('=== Firestore と mockData の差分 (Firestore値 ≠ mockData値) ===\n');
for (const [id, fsM] of fsById) {
  const mock = mockById.get(id);
  if (!mock) continue; // Firestore のみ(admin 追加)は seed でも保持されるので対象外
  const diffs: string[] = [];
  for (const f of FIELDS) {
    const a = (fsM as any)[f];
    const b = (mock as any)[f];
    if (a !== b && !(a === undefined && b === undefined)) {
      diffs.push(`${f}: FS=${JSON.stringify(a)} ≠ mock=${JSON.stringify(b)}`);
    }
  }
  if (diffs.length) {
    diffCount++;
    const nm = typeof mock.name === 'string' ? mock.name : mock.name?.ja;
    console.log(`● ${id} (${nm})`);
    for (const d of diffs) console.log(`    ${d}`);
  }
}
console.log(`\n差分のあるスキル: ${diffCount} 件`);
console.log('※ ここに出た FS値 は seed を流すと mockData値 に上書きされる(=あなたの管理画面編集が消える)');

// 参考: 4 デバフスキルが Firestore で appliesAsDebuff を既に持つか
const DEBUFF = ['reprisal', 'feint', 'addle', 'dismantle'];
const isDebuff = (id: string) => DEBUFF.some(b => id === b || id.startsWith(b + '_'));
const debuffNeedingFlag = fsMits.filter(m => isDebuff(m.id) && !m.appliesAsDebuff).map(m => m.id);
console.log(`\n=== デバフ系で Firestore に appliesAsDebuff 未設定 (=今回付けたい対象) ===`);
console.log(debuffNeedingFlag.length ? debuffNeedingFlag.join(', ') : '(なし)');
