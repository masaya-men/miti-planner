// 使い方: node scripts/convert-locale-json-to-hant.mjs
// src/locales/zh.json (簡体字) を再帰的に繁体字へ機械変換し、
// src/locales/zh-Hant.json として書き出す。
// 出力はドラフト: ゲーム固有名詞(ジョブ名・スキル名等)はTask2で個別に手直しすること。
import { readFileSync, writeFileSync } from 'fs';
import * as OpenCC from 'opencc-js';

const converter = OpenCC.Converter({ from: 'cn', to: 'twp' });
const SRC = 'src/locales/zh.json';
const DEST = 'src/locales/zh-Hant.json';

function convertDeep(value) {
    if (typeof value === 'string') return converter(value);
    if (typeof value === 'object' && value !== null) {
        const out = {};
        for (const [key, v] of Object.entries(value)) {
            out[key] = convertDeep(v);
        }
        return out;
    }
    return value;
}

const zh = JSON.parse(readFileSync(SRC, 'utf8'));
const zhHant = convertDeep(zh);
writeFileSync(DEST, JSON.stringify(zhHant, null, 4) + '\n', 'utf8');
console.log(`Wrote ${DEST}`);
