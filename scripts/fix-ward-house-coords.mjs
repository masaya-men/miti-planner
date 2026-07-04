// ward JSON の houses[].x/y を、アプリが実際に描画する *.generated.svg の「正しい幾何中心」で再計算し、
// houses[].node を既存ノードへ再スナップする外科的パッチ。nodes/edges/roadPath 等は一切触らない。
//
// 背景: 旧 parse-ward-svg.mjs の bboxCenter が SVG コマンド(H/V/C)を無視した単純数値ペアリングで、
// 角丸・縦横線を含む箱(アパート/一部区画)の中心座標が破損していた。地図の絵(SVG)は正しいので、
// 派生データである houses 座標だけを実SVGの真の中心に合わせて修正する。
//
// 安全策: 対象 JSON が JSON.stringify(_,null,2) と round-trip 一致しない場合は書き込まない(整形差分の混入防止)。
import { readFileSync, writeFileSync } from 'node:fs';
import { elementCenterPx } from './svg-path-center.mjs';

const MAPS = [
  ['mistWard', 'mist.generated.svg'], ['mistSubWard', 'mistSub.generated.svg'],
  ['lavenderWard', 'lavender.generated.svg'], ['lavenderSubWard', 'lavenderSub.generated.svg'],
  ['gobletWard', 'goblet.generated.svg'], ['gobletSubWard', 'gobletSub.generated.svg'],
  ['shiroganeWard', 'shirogane.generated.svg'], ['shiroganeSubWard', 'shiroganeSub.generated.svg'],
  ['empyreumWard', 'empyreum.generated.svg'], ['empyreumSubWard', 'empyreumSub.generated.svg'],
];

/** generated SVG から id の要素中心(px)を求める(rotate 等 transform 適用済み)。 */
function centerFromSvg(svg, id) {
  const at = svg.indexOf(`id="${id}"`);
  if (at < 0) return null;
  const tagStart = svg.lastIndexOf('<', at);
  const tagEnd = svg.indexOf('>', at);
  const tag = svg.slice(tagStart + 1).match(/^[a-zA-Z]+/)?.[0];
  const open = svg.slice(tagStart, tagEnd + 1);
  return elementCenterPx(open, tag);
}

function nearestNode(nodes, x, y) {
  let best = null, bd = Infinity;
  for (const n of nodes) { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } }
  return best ? best.id : null;
}

let grandChanged = 0;
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

  let changed = 0, maxDelta = 0;
  for (const h of data.houses) {
    const c = centerFromSvg(svg, `${h.kind}_${h.plot}`);
    if (!c) { console.error(`  WARN ${ward} ${h.kind}_${h.plot}: element not found`); continue; }
    const nxv = nx(c.x), nyv = ny(c.y);
    // 座標が変わった家だけ node を再スナップ。動いていない家は byte 完全不変にして
    // 現状動いているルートを不要に変えない (同距離付近の選択ブレ回避)。
    if (nxv !== h.x || nyv !== h.y) {
      const delta = Math.hypot(nxv - h.x, nyv - h.y);
      if (delta > maxDelta) maxDelta = delta;
      h.x = nxv; h.y = nyv; h.node = nearestNode(data.nodes, nxv, nyv);
      changed++;
    }
  }
  writeFileSync(jsonPath, serialize(data));
  grandChanged += changed;
  console.log(`${ward.padEnd(16)} houses=${data.houses.length} changed=${changed} maxΔ=${maxDelta.toFixed(4)}`);
}
console.log(`\n合計 ${grandChanged} houses 修正。nodes/edges/roadPath は不変。`);
