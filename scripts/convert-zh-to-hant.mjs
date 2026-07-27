// 使い方: node scripts/convert-zh-to-hant.mjs > /tmp/housing-terms-with-hant.csv
// src/data/housing/terms-src/housing-terms.csv の zh 列を機械的に繁体字変換し、
// zh 列の直後に zh-Hant 列を追加した CSV を標準出力する。
// 出力はドラフト: 固有名詞(ワールド名・エリア名等)は Step 5 で公式訳に手直しすること。
import { readFileSync } from 'fs';
import * as OpenCC from 'opencc-js';

const converter = OpenCC.Converter({ from: 'cn', to: 'twp' });
const SRC = 'src/data/housing/terms-src/housing-terms.csv';

const lines = readFileSync(SRC, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
const header = lines[0].split(',');
const zhIdx = header.indexOf('zh');
const newHeader = [...header.slice(0, zhIdx + 1), 'zh-Hant', ...header.slice(zhIdx + 1)];
console.log(newHeader.join(','));

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(',');
  const zhVal = cols[zhIdx] ?? '';
  const zhHant = zhVal ? converter(zhVal) : '';
  const newCols = [...cols.slice(0, zhIdx + 1), zhHant, ...cols.slice(zhIdx + 1)];
  console.log(newCols.join(','));
}
