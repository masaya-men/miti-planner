/**
 * seed-firestore.mjs
 * 静的データをFirestoreに書き込むシードスクリプト
 *
 * 使い方: node scripts/seed-firestore.mjs
 *
 * .env.local から FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY を読み取り、
 * contents.json + templates/*.json を Firestore の /master/*, /templates/* に投入する。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ==========================================
// .env.local を手動パース（dotenv 不使用）
// ==========================================
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
    // クォート除去
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const envPath = resolve(ROOT, '.env.local');
const env = loadEnv(envPath);

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
// .env.local 内の \\n を実際の改行に変換
const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
  process.exit(1);
}

// ==========================================
// Firebase Admin 初期化
// ==========================================
initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});
const db = getFirestore();

console.log('✅ Firebase Admin 初期化完了');

// ==========================================
// contents.json 読み込み
// ==========================================
const contentsPath = resolve(ROOT, 'src/data/contents.json');
const rawContents = JSON.parse(readFileSync(contentsPath, 'utf-8'));
console.log(`✅ contents.json 読み込み完了 (${rawContents.length} 件)`);

// ==========================================
// getSeriesMetadata — contentRegistry.ts のロジックを JS で再実装
// ==========================================
function getSeriesMetadata(id, category) {
  if (category === 'ultimate') {
    const baseId = id.replace(/_p\d+$/, '');
    const pMatch = id.match(/_p(\d+)$/);
    const uppercase = baseId.toUpperCase();
    const short = pMatch ? `${uppercase}\nP${pMatch[1]}` : uppercase;
    if (pMatch) {
      return { seriesId: baseId, seriesJa: '', seriesEn: '', seriesZh: '', seriesKo: '', order: parseInt(pMatch[1], 10) * 0.1, shortJa: short, shortEn: short, shortZh: short, shortKo: short };
    }
    return { seriesId: baseId, seriesJa: '', seriesEn: '', seriesZh: '', seriesKo: '', order: 1, shortJa: short, shortEn: short, shortZh: short, shortKo: short };
  }

  const floorMatch = id.match(/(\d+)s(?:_p(\d+))?$/);
  let absoluteOrder = 1;
  let phaseOffset = 0;

  if (floorMatch) {
    absoluteOrder = parseInt(floorMatch[1], 10);
    if (floorMatch[2]) {
      phaseOffset = parseInt(floorMatch[2], 10) * 0.1;
    }
  }

  let relativeOrder = absoluteOrder;
  let seriesInfo = { seriesId: 'misc', seriesJa: 'その他', seriesEn: 'Misc', seriesZh: '其他', seriesKo: '기타' };

  if (id.startsWith('m')) {
    if (absoluteOrder < 5) {
      seriesInfo = { seriesId: 'aac_lhw', seriesJa: 'ライトヘビー級', seriesEn: 'Light-heavyweight', seriesZh: '轻量级', seriesKo: '라이트헤비급' };
      relativeOrder = absoluteOrder;
    } else if (absoluteOrder < 9) {
      seriesInfo = { seriesId: 'aac_cruiser', seriesJa: 'クルーザー級', seriesEn: 'Cruiserweight', seriesZh: '中量级', seriesKo: '크루저급' };
      relativeOrder = absoluteOrder - 4;
    } else {
      seriesInfo = { seriesId: 'aac_heavy', seriesJa: 'ヘビー級', seriesEn: 'Heavyweight', seriesZh: '重量级', seriesKo: '헤비급' };
      relativeOrder = absoluteOrder - 8;
    }
  } else if (id.startsWith('p')) {
    if (absoluteOrder <= 4) {
      seriesInfo = { seriesId: 'pandaemonium_asphodelos', seriesJa: '辺獄編', seriesEn: 'Asphodelos', seriesZh: '边境之狱', seriesKo: '변옥편' };
      relativeOrder = absoluteOrder;
    } else if (absoluteOrder <= 8) {
      seriesInfo = { seriesId: 'pandaemonium_abyssos', seriesJa: '煉獄編', seriesEn: 'Abyssos', seriesZh: '炼净之狱', seriesKo: '연옥편' };
      relativeOrder = absoluteOrder - 4;
    } else {
      seriesInfo = { seriesId: 'pandaemonium_anabaseios', seriesJa: '天獄編', seriesEn: 'Anabaseios', seriesZh: '荒天之狱', seriesKo: '천옥편' };
      relativeOrder = absoluteOrder - 8;
    }
  } else if (id.startsWith('e')) {
    if (absoluteOrder <= 4) {
      seriesInfo = { seriesId: 'eden_gate', seriesJa: '覚醒編', seriesEn: 'Gate', seriesZh: '觉醒之章', seriesKo: '각성편' };
      relativeOrder = absoluteOrder;
    } else if (absoluteOrder <= 8) {
      seriesInfo = { seriesId: 'eden_verse', seriesJa: '共鳴編', seriesEn: 'Verse', seriesZh: '共鸣之章', seriesKo: '공명편' };
      relativeOrder = absoluteOrder - 4;
    } else {
      seriesInfo = { seriesId: 'eden_promise', seriesJa: '再生編', seriesEn: 'Promise', seriesZh: '再生之章', seriesKo: '재생편' };
      relativeOrder = absoluteOrder - 8;
    }
  } else if (id.startsWith('o')) {
    if (absoluteOrder <= 4) {
      seriesInfo = { seriesId: 'omega_deltascape', seriesJa: 'デルタ編', seriesEn: 'Deltascape', seriesZh: '德尔塔幻境', seriesKo: '델타편' };
      relativeOrder = absoluteOrder;
    } else if (absoluteOrder <= 8) {
      seriesInfo = { seriesId: 'omega_sigmascape', seriesJa: 'シグマ編', seriesEn: 'Sigmascape', seriesZh: '西格玛幻境', seriesKo: '시그마편' };
      relativeOrder = absoluteOrder - 4;
    } else {
      seriesInfo = { seriesId: 'omega_alphascape', seriesJa: 'アルファ編', seriesEn: 'Alphascape', seriesZh: '阿尔法幻境', seriesKo: '알파편' };
      relativeOrder = absoluteOrder - 8;
    }
  }

  const floor = Math.floor(relativeOrder);
  const shortJa = floor + '層' + (phaseOffset === 0.1 ? '\n前半' : phaseOffset === 0.2 ? '\n後半' : '');
  const shortEn = id.toUpperCase().replace('_', '\n').replace(' ', '\n');
  const shortZh = floor + '层' + (phaseOffset === 0.1 ? '\n前半' : phaseOffset === 0.2 ? '\n后半' : '');
  const shortKo = floor + '층' + (phaseOffset === 0.1 ? '\n전반' : phaseOffset === 0.2 ? '\n후반' : '');
  const orderForSorting = relativeOrder + phaseOffset;

  return { ...seriesInfo, order: orderForSorting, shortJa, shortEn, shortZh, shortKo };
}

// ==========================================
// items と series を生成
// ==========================================
const items = rawContents.map((rc) => {
  const { seriesId, order, shortJa, shortEn, shortZh, shortKo } = getSeriesMetadata(rc.id, rc.category);
  const name = { ja: rc.ja, en: rc.en };
  if (rc.zh) name.zh = rc.zh;
  if (rc.ko) name.ko = rc.ko;
  return {
    id: rc.id,
    name,
    shortName: { ja: rc.shortNameJa || shortJa, en: shortEn, zh: shortZh, ko: shortKo },
    seriesId,
    category: rc.category,
    level: rc.level,
    patch: rc.patch,
    order,
    ...(rc.hasCheckpoint ? { hasCheckpoint: true } : {}),
    ...(rc.fflogsEncounterId ? { fflogsEncounterId: rc.fflogsEncounterId } : {}),
  };
});

// シリーズ生成（_p1 等のサフィックスがないコンテンツの名前を優先）
const seriesMap = new Map();
rawContents.forEach((rc) => {
  const { seriesId, seriesJa, seriesEn, seriesZh, seriesKo } = getSeriesMetadata(rc.id, rc.category);
  const hasPhaseSuffix = /_p\d+$/.test(rc.id);
  if (!seriesMap.has(seriesId) || !hasPhaseSuffix) {
    const seriesName = rc.category === 'ultimate'
      ? { ja: rc.ja, en: rc.en, ...(rc.zh ? { zh: rc.zh } : {}), ...(rc.ko ? { ko: rc.ko } : {}) }
      : { ja: seriesJa, en: seriesEn, zh: seriesZh, ko: seriesKo };
    seriesMap.set(seriesId, {
      id: seriesId,
      name: seriesName,
      category: rc.category,
      level: rc.level,
    });
  }
});
const series = Array.from(seriesMap.values());

// ==========================================
// Firestore 書き込み
// ==========================================

// 1. /master/config
const configData = {
  dataVersion: 1,
  featureFlags: { useFirestore: true },
  categoryLabels: {
    savage: { ja: '零式', en: 'Savage', zh: '零式', ko: '영웅' },
    ultimate: { ja: '絶', en: 'Ultimate', zh: '绝境战', ko: '절' },
    dungeon: { ja: 'ダンジョン', en: 'Dungeon', zh: '迷宫挑战', ko: '던전' },
    raid: { ja: 'レイド', en: 'Raid', zh: '大型任务', ko: '레이드' },
    custom: { ja: 'その他', en: 'Misc', zh: '其他', ko: '기타' },
  },
  levelLabels: {
    70: { ja: 'Lv70 (紅蓮)', en: 'Lv70 (Stormblood)', zh: 'Lv70 (红莲)', ko: 'Lv70 (홍련)' },
    80: { ja: 'Lv80 (漆黒)', en: 'Lv80 (Shadowbringers)', zh: 'Lv80 (暗影)', ko: 'Lv80 (칠흑)' },
    90: { ja: 'Lv90 (暁月)', en: 'Lv90 (Endwalker)', zh: 'Lv90 (晓月)', ko: 'Lv90 (효월)' },
    100: { ja: 'Lv100 (黄金)', en: 'Lv100 (Dawntrail)', zh: 'Lv100 (金曦)', ko: 'Lv100 (황금)' },
  },
};

await db.doc('master/config').set(configData);
console.log('✅ /master/config 書き込み完了');

// 2. /master/contents
const contentsDoc = { items, series };
await db.doc('master/contents').set(contentsDoc);
console.log(`✅ /master/contents 書き込み完了 (items: ${items.length}, series: ${series.length})`);

// 3. /templates/{contentId}
const templatesDir = resolve(ROOT, 'src/data/templates');
const templateFiles = readdirSync(templatesDir).filter((f) => f.endsWith('.json'));

for (const file of templateFiles) {
  const contentId = basename(file, '.json');
  const json = JSON.parse(readFileSync(resolve(templatesDir, file), 'utf-8'));
  const templateDoc = {
    contentId,
    source: 'admin_manual',
    timelineEvents: json.timelineEvents || [],
    phases: json.phases || [],
    generatedAt: json.generatedAt || null,
    sourceLogsCount: json.sourceLogsCount || 0,
    lockedAt: null,
    lastUpdatedAt: new Date(),
    lastUpdatedBy: 'seed-script',
  };
  await db.doc(`templates/${contentId}`).set(templateDoc);
  console.log(`✅ /templates/${contentId} 書き込み完了`);
}

console.log('\n🎉 シード完了！全データを Firestore に書き込みました。');
