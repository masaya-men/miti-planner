// 使い方: node scripts/parse-ward-directions.mjs
//
// src/data/housing/directions-src/*.csv → src/data/housing/wardDirections.generated.json
//
// **正典は上記 CSV**。 元は Google スプレッドシートから書き出していたが、 2026-07-10 に
// スプシは引退し、 リポジトリの CSV が唯一の情報源になった (スプシには修正前の誤記が残っており、
// 再エクスポートすると訂正が巻き戻るため)。 直すときは CSV を直接編集して本スクリプトを回す。
//
// CSV は素朴に `,` で split するので、 行き方本文にカンマ・引用符を入れないこと。
// データの正しさは以下のテストが機械的に守る:
//   - src/__tests__/housing/wardPlotSizes.test.ts      本文の S/M/L 表記が区画の実サイズと一致するか
//   - src/lib/housing/__tests__/wardDirections.test.ts 全300区画に本文があるか / エーテライト名が地図に存在するか
import { readFileSync, writeFileSync } from 'fs';

const SRC = 'src/data/housing/directions-src';
const OUT = 'src/data/housing/wardDirections.generated.json';
// ファイル名 → area enum (HOUSING_AREAS)
const FILES = [
  ['mist.csv', 'Mist'],
  ['lavenderbeds.csv', 'LavenderBeds'],
  ['goblet.csv', 'Goblet'],
  ['shirogane.csv', 'Shirogane'],
  ['empyreum.csv', 'Empyreum'],
];

const unq = (s) => s.replace(/^"|"$/g, '').trim();

const out = {};
for (const [file, area] of FILES) {
  const txt = readFileSync(`${SRC}/${file}`, 'utf8');
  const lines = txt.split(/\r?\n/).filter((l) => l.trim());
  const byPlot = {};
  for (let i = 1; i < lines.length; i++) {
    // header skip
    const cols = lines[i].split(',');
    const plot = Number(unq(cols[2] ?? ''));
    const aetheryte = unq(cols[3] ?? '');
    const directions = unq(cols[4] ?? '');
    if (!Number.isInteger(plot) || plot < 1 || plot > 60) continue;
    if (!aetheryte && !directions) continue;
    byPlot[String(plot)] = { aetheryte, directions };
  }
  const n = Object.keys(byPlot).length;
  if (n !== 60) throw new Error(`${area}: expected 60 plots, got ${n}`);
  out[area] = byPlot;
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(
  'wardDirections.generated.json written:',
  Object.keys(out)
    .map((a) => `${a}=${Object.keys(out[a]).length}`)
    .join(' '),
);
