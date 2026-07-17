// 使い方: node scripts/parse-housing-terms.mjs
// 正典: src/data/housing/terms-src/housing-terms.csv → src/data/housing/housingTerms.generated.json
import { readFileSync, writeFileSync } from 'fs';

const SRC = 'src/data/housing/terms-src/housing-terms.csv';
const OUT = 'src/data/housing/housingTerms.generated.json';
// CSV は素朴に , split (本文にASCIIカンマ禁止)。BOM を剥がす。
const rows = readFileSync(SRC, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()).slice(1)
  .map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '').trim()));

// 中国ワールド内部キー: 単語ごとに先頭大文字化 (CamelCase) してから英数字以外を除去。
// 例: "Costa del Sol" (前置詞が小文字) → "CostaDelSol"。単純 strip だと "CostadelSol" になり
// dcServerMap.ts の内部キーと不一致になるため、単語境界での大文字化が必須。
const asciiKey = (en) => en.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('').replace(/[^A-Za-z0-9]/g, '');
const CN_DC_KEYS = { 'Chocobo (China)': 'ChocoboCN', 'Moogle (China)': 'MoogleCN', 'Fat Cat (China)': 'FatCatCN', 'Mameshiba (China)': 'MameshibaCN' };

const out = { dc: {}, world: {}, area: {}, apartment: {}, aetheryte: {}, district: {}, size: {}, tag: {} };
for (const [cat, ja, en, ko, zh] of rows) {
  const entry = { ja, en, ko, zh };
  if (cat === 'ハウジングエリア') out.area[ja] = entry;
  else if (cat === 'アパルトメント') out.apartment[ja] = entry;
  else if (cat === '区画表記') out.district[ja] = entry;
  else if (cat === 'エーテライト') out.aetheryte[ja] = entry;
  else if (cat === 'データセンター') out.dc[en] = entry;                       // グローバル: キー=en
  else if (cat === 'データセンター (中国)') out.dc[CN_DC_KEYS[en]] = entry;
  else if (cat === 'データセンター (韓国)') out.dc['Korea'] = entry;
  else if (cat.startsWith('ワールド (中国')) out.world[asciiKey(en)] = entry;   // CN: キー=en詰め
  else if (cat.startsWith('ワールド')) out.world[en] = entry;                   // グローバル/韓国: キー=en (韓国5鯖は同名同訳で共存OK)
  else if (cat === 'サイズ・種別') out.size[ja] = entry;
  else if (cat.startsWith('タグ')) out.tag[ja] = entry;
}
for (const [k, v] of Object.entries(out)) if (!Object.keys(v).length) throw new Error(`empty kind: ${k}`);
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('housingTerms.generated.json:', Object.entries(out).map(([k, v]) => `${k}=${Object.keys(v).length}`).join(' '));
