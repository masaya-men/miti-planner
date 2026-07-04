// ward JSON の houses[] に輪郭頂点 outline (0..1 正規化) を外科的に追加するパッチ。
// x/y/node/edges/roadPath 等の既存フィールドは一切触らない (追加するのは outline のみ)。
//
// 背景: 改善2 (箱縁の可視化) のため、各 house の中心点だけでなく輪郭 (rect=4隅 / path=on-curve点 /
// circle=bbox4隅) を持たせたい。地図の絵 (アプリが実描画する *.generated.svg) を真値として、
// そこから輪郭頂点を求めて json に焼き込む。scripts/fix-ward-house-coords.mjs と同じ構造・
// 同じ安全策 (round-trip 不安定なら書き込まない) を踏襲する。
import { readFileSync, writeFileSync } from 'node:fs';
import { elementOutlinePx } from './svg-path-center.mjs';

const MAPS = [
  ['mistWard', 'mist.generated.svg'], ['mistSubWard', 'mistSub.generated.svg'],
  ['lavenderWard', 'lavender.generated.svg'], ['lavenderSubWard', 'lavenderSub.generated.svg'],
  ['gobletWard', 'goblet.generated.svg'], ['gobletSubWard', 'gobletSub.generated.svg'],
  ['shiroganeWard', 'shirogane.generated.svg'], ['shiroganeSubWard', 'shiroganeSub.generated.svg'],
  ['empyreumWard', 'empyreum.generated.svg'], ['empyreumSubWard', 'empyreumSub.generated.svg'],
];

/** generated SVG から id の要素の open タグ+tag名を求める。 */
function findElement(svg, id) {
  const at = svg.indexOf(`id="${id}"`);
  if (at < 0) return null;
  const tagStart = svg.lastIndexOf('<', at);
  const tagEnd = svg.indexOf('>', at);
  const tag = svg.slice(tagStart + 1).match(/^[a-zA-Z]+/)?.[0];
  const open = svg.slice(tagStart, tagEnd + 1);
  return { tag, open };
}

/** generated SVG から id の要素の輪郭頂点(px)を求める(rotate 等 transform 適用済み)。 */
function outlineFromSvg(svg, id) {
  const el = findElement(svg, id);
  if (!el) return null;
  return elementOutlinePx(el.open, el.tag);
}

let grandAdded = 0;
for (const [ward, genSvg] of MAPS) {
  const jsonPath = `src/data/housing/${ward}.generated.json`;
  const text = readFileSync(jsonPath, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n'; // ファイルの改行(CRLF/LF)を維持し差分を最小化
  const serialize = (obj) => JSON.stringify(obj, null, 2).replace(/\n/g, eol);
  const data = JSON.parse(text);
  // 安全策: houses 以外の整形が round-trip で一致しない場合は書かない(整形差分の混入防止)
  if (serialize(JSON.parse(text)) !== text) {
    console.error(`SKIP ${ward}: JSON not round-trip stable (整形差分回避のため書き込み中止)`);
    continue;
  }
  const svg = readFileSync(`src/data/housing/${genSvg}`, 'utf8');
  const W = data.viewBox.w, H = data.viewBox.h;
  const nx = (x) => +(x / W).toFixed(5);
  const ny = (y) => +(y / H).toFixed(5);

  let added = 0, missing = 0;
  for (const h of data.houses) {
    const outlinePx = outlineFromSvg(svg, `${h.kind}_${h.plot}`);
    if (!outlinePx) {
      console.error(`  WARN ${ward} ${h.kind}_${h.plot}: outline not found (null)`);
      h.outline = null;
      missing++;
      continue;
    }
    // x/y/node は絶対に触らない。outline だけを追加する。
    h.outline = outlinePx.map(([x, y]) => [nx(x), ny(y)]);
    added++;
  }
  writeFileSync(jsonPath, serialize(data));
  grandAdded += added;
  console.log(`${ward.padEnd(16)} houses=${data.houses.length} outline付与=${added} 欠損=${missing}`);
}
console.log(`\n合計 ${grandAdded} houses に outline 追加。x/y/node/edges/roadPath は不変。`);
