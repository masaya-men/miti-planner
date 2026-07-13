/**
 * ⚠ 使い捨てダミー seed (探す地図② の「区画重なり最悪ケース」+「1スポット大量部屋」確認用)。
 *
 * 本番 Firestore の housing_listings に、Mana / Anima / Mist / 1区 のダミー listing を投入する:
 *   - 区画 1〜30 に家全体を各1件 (= 全区画埋まった重なり最悪ケース)
 *   - 区画 5 に FC 個室 (private_chamber) を 30 件 (= 家1件 + 個室30 が同スポットに集約)
 *   - 本街アパート(棟1) に部屋 1〜90 (= FF14 実仕様の満室・大量部屋ケース)
 *
 * 全ドキュメントは ownerUid='dev-dummy-overlap' でマークするので、確認後は --clear で一括削除できる。
 *
 * 使い方:
 *   node scripts/seed-housing-overlap-dummy.mjs          # 投入
 *   node scripts/seed-housing-overlap-dummy.mjs --clear  # 削除 (ownerUid マーカーで全消し)
 *
 * 認証は seed-contents.ts と同じ .env.local のサービスアカウント。設計確定・確認後に本ファイルごと削除する。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function loadEnv(filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const env = {};
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
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const COLLECTION = 'housing_listings';
const MARKER_UID = 'dev-dummy-overlap';

const DC = 'Mana';
const SERVER = 'Anima';
const AREA = 'Mist';
const WARD = 1;
const NOW = Date.now();
const SIZES = ['S', 'M', 'L'];

// ---- --clear モード: マーカー付きダミーを全削除 ----
if (process.argv.includes('--clear')) {
  const snap = await db.collection(COLLECTION).where('ownerUid', '==', MARKER_UID).get();
  if (snap.empty) {
    console.log('🧹 削除対象のダミーはありません (既にクリーン)');
    process.exit(0);
  }
  let batch = db.batch();
  let n = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    n += 1;
    if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`🧹 ダミー ${snap.size} 件を削除しました`);
  process.exit(0);
}

// ---- 投入モード ----
/** listing 1件分の共通フィールドを埋めて返す。 */
function base(id, over) {
  return {
    id,
    doc: {
      ownerUid: MARKER_UID,
      dc: DC,
      server: SERVER,
      area: AREA,
      ward: WARD,
      imageMode: 'none',
      tags: [],
      createdAt: NOW,
      updatedAt: NOW,
      lastConfirmedAt: NOW,
      isHidden: false,
      reportCount: 0,
      deletedAt: null,
      visibility: 'public',
      publishUntil: null,
      ...over,
    },
  };
}

const rows = [];

// 1) 区画 1〜30: 家全体 各1件 (重なり最悪ケース)
for (let plot = 1; plot <= 30; plot += 1) {
  const size = SIZES[plot % 3];
  rows.push(
    base(`devdummy-plot${plot}`, {
      buildingType: 'house',
      plot,
      size,
      title: `ダミー 区画${plot}`,
      addressKey: `dev/${DC}/${SERVER}/${AREA}/${WARD}/plot${plot}`,
      createdAt: NOW - plot,
      lastConfirmedAt: NOW - plot,
    }),
  );
}

// 2) 区画 5: FC 個室 (private_chamber) を 30 件 (家1件 + 個室30 が同スポットに集約される)
for (let room = 1; room <= 30; room += 1) {
  rows.push(
    base(`devdummy-plot5-chamber${room}`, {
      buildingType: 'house',
      plot: 5,
      size: SIZES[5 % 3],
      roomKind: 'private_chamber',
      roomNumber: room,
      title: `ダミー 区画5 個室${room}`,
      addressKey: `dev/${DC}/${SERVER}/${AREA}/${WARD}/plot5/chamber${room}`,
      createdAt: NOW - 100 - room,
      lastConfirmedAt: NOW - 100 - room,
    }),
  );
}

// 3) 本街アパート(棟1): 部屋 1〜90 (FF14 実仕様の満室・大量部屋ケース)
for (let room = 1; room <= 90; room += 1) {
  rows.push(
    base(`devdummy-apt1-room${room}`, {
      buildingType: 'apartment',
      apartmentBuilding: 1,
      roomKind: 'apartment_room',
      roomNumber: room,
      title: `ダミー アパルトメント 部屋${room}`,
      addressKey: `dev/${DC}/${SERVER}/${AREA}/${WARD}/apt1/room${room}`,
      createdAt: NOW - 1000 - room,
      lastConfirmedAt: NOW - 1000 - room,
    }),
  );
}

let batch = db.batch();
let n = 0;
for (const { id, doc } of rows) {
  batch.set(db.collection(COLLECTION).doc(id), doc);
  n += 1;
  if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
}
await batch.commit();

console.log(`✅ ダミー ${rows.length} 件投入完了 (${DC}/${SERVER} ${AREA} ${WARD}区)`);
console.log('   - 区画1〜30: 家全体 各1件 (重なり確認)');
console.log('   - 区画5: FC個室30件 (家1 + 個室30)');
console.log('   - 本街アパート棟1: 部屋90件 (満室)');
console.log('👉 ローカルで 探す→地図→ Mana / Anima を選ぶと Mist 1区が出ます');
console.log('🧹 確認後の削除: node scripts/seed-housing-overlap-dummy.mjs --clear');
