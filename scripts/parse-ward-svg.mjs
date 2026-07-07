// Figma 書き出しの ward SVG を解析して、 マップ用データ (houses / nodes / edges / 道) を生成する。
// 使い方: node scripts/parse-ward-svg.mjs <input.svg> <area> [out.json]
//   houses: <path id="plot_N"|"apart_N"> の bbox 中心
//   nodes:  <g id="Node"> 内 <path id="node_N"> の bbox 中心 (円)
//   road:   ナビゲーション用道路の 1 本 path (M/L/H/V) を折れ線化
//   edges:  道の折れ線が通るノードを順に拾い、 連続ノード間を辺に (自動接続)
//   house.node: 各家を最寄りノードへ自動接続
// 座標は viewBox 基準で 0..1 正規化。
import { readFileSync, writeFileSync } from 'node:fs';
import { elementCenterPx, elementOutlinePx } from './svg-path-center.mjs';

const [, , inPath, area = 'Mist', outPath = `src/data/housing/${area.toLowerCase()}Ward.generated.json`] = process.argv;
const svg = readFileSync(inPath, 'utf8');

const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
const W = Number(vb[1]), H = Number(vb[2]);
const nx = (x) => +(x / W).toFixed(5);
const ny = (y) => +(y / H).toFixed(5);

const nums = (s) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);

// 要素の中心 (px) は svg-path-center.mjs に集約: path=SVG コマンドを正しく解釈した bbox 中心、
// rect=x+w/2 (+rotate 適用)、circle=cx,cy。旧実装は「path 全数値の単純ペアリング(H/V/C 無視)」と
// 「rect の rotate transform 無視」で中心が破損していた (角丸箱=アパート/回転 rect=goblet)。
function elementCenter(tag, attrs) {
  return elementCenterPx(attrs, tag) ?? { x: 0, y: 0 };
}

// --- houses (<path|rect|circle> id="plot_N"|"apart_N") ---
// outline: 輪郭頂点(0..1 正規化)。改善2 (箱縁の可視化) 用。rect=4隅/path=on-curve点/circle=bbox4隅。
// 現行 *.generated.json への反映は scripts/add-house-outline.mjs (外科パッチ) で行っており、
// この wholesale regen 経路は将来の一貫性のために dormant で維持している(通常は実行しない)。
const houses = [];
for (const m of svg.matchAll(/<(path|rect|circle|ellipse) id="(plot|apart)_(\d+)"([^>]*)>/g)) {
  const c = elementCenter(m[1], m[4]);
  const outlinePx = elementOutlinePx(m[4], m[1]);
  const outline = outlinePx ? outlinePx.map(([x, y]) => [nx(x), ny(y)]) : null;
  houses.push({ kind: m[2], plot: Number(m[3]), x: nx(c.x), y: ny(c.y), outline, _px: c });
}

// --- nodes (Node グループ内、 <path|circle> id="node_N") ---
const nodeGroup = svg.match(/<g id="Node">([\s\S]*?)<\/g>/);
const nodes = [];
for (const m of (nodeGroup ? nodeGroup[1] : '').matchAll(/<(path|rect|circle|ellipse) id="(node_\d+)"([^>]*)>/g)) {
  const c = elementCenter(m[1], m[3]);
  nodes.push({ id: m[2], x: nx(c.x), y: ny(c.y), _px: c });
}

// --- nav road path (stroke="#FF0000" の path。 id が要素[plot_/apart_/node_/Node]のものは除外。
//     ミスト=1 本の長い path / 他エリア=複数本。 複数なら M 始点を保ったまま連結して subpath 化) ---
const roadSegs = [];
for (const m of svg.matchAll(/<path\b([^>]*?)\/?>/g)) {
  const attrs = m[1];
  if (!/stroke="#(?:FF0000|ff0000)"/.test(attrs)) continue;
  const idm = attrs.match(/\bid="([^"]*)"/);
  if (idm && /^(?:plot_|apart_|node_|Node)/.test(idm[1])) continue;
  const dm = attrs.match(/\sd="([^"]+)"/);
  if (dm) roadSegs.push(dm[1]);
}
const roadD = roadSegs.length ? roadSegs.join(' ') : null;

// --- visible road path (見た目用の太い道路。 Figma 「道路(Stroke)」 グループ内、
//     mask="url(...)" を適用された本体 path の d を抜く)。
//     SVG entity #233 で始まる id = 「道路(Stroke)」 グループ。
//     ① まずグループ全体を切り出し、 ② その中で mask 属性付き path の d を取る
//     (1 段で書くと <g> 直下の最初の <mask>内 path に lazy ヒットして失敗するため 2 段)。
const roadGroup = svg.match(/<g id="&#233;[^"]*Stroke[^"]*">([\s\S]*?)<\/g>/);
const visRoadM = roadGroup ? roadGroup[1].match(/<path\s+d="([^"]+)"[^>]*\smask="url\(/) : null;
const visibleRoadD = visRoadM ? visRoadM[1] : null;

// 折れ線化 (M で区切る subpath ごと)
function parseRoad(d) {
  const segs = [];
  let poly = [], x = 0, y = 0;
  const flush = () => { if (poly.length > 1) segs.push(poly); poly = []; };
  for (const m of d.matchAll(/([MLHVZ])([^MLHVZ]*)/gi)) {
    const cmd = m[1].toUpperCase();
    const v = nums(m[2]);
    if (cmd === 'M') { flush(); x = v[0]; y = v[1]; poly = [[x, y]]; for (let i = 2; i + 1 < v.length; i += 2) { x = v[i]; y = v[i + 1]; poly.push([x, y]); } }
    else if (cmd === 'L') { for (let i = 0; i + 1 < v.length; i += 2) { x = v[i]; y = v[i + 1]; poly.push([x, y]); } }
    else if (cmd === 'H') { for (const nxv of v) { x = nxv; poly.push([x, y]); } }
    else if (cmd === 'V') { for (const nyv of v) { y = nyv; poly.push([x, y]); } }
    else if (cmd === 'Z') { if (poly.length) poly.push(poly[0].slice()); }
  }
  flush();
  return segs;
}

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const NODE_SNAP = 30; // px。 折れ線の点がこの距離内ならそのノードを通過とみなす
function nearestNode(px, py, maxD = Infinity) {
  let best = null, bd = maxD;
  for (const n of nodes) { const d = dist(px, py, n._px.x, n._px.y); if (d < bd) { bd = d; best = n; } }
  return best;
}

// --- ナビ線 subpath を 1 回だけ折れ線化 (auto ノード補完と edge 生成で共有) ---
const roadSubpaths = roadD ? parseRoad(roadD) : [];

// --- auto ノード補完: ナビ線 subpath の端点で既存ノード近傍に無いものへ自動ノードを置く ---
//     運用上、 手動ノードは「分かれ道」 にのみ置かれ、 道の行き止まり/枝先には無い。
//     その結果、 端に手動ノードが無い枝道は「通過ノード<2」 となり edge 化されず経路から欠落していた。
//     端点(=枝先 or 別 subpath が接続する分岐点)へノードを補うと、 その枝道が edge 化され、
//     T 字合流なら既存 edge も分割されて正しく接続する。 既存ノード ID/座標は不変(追加のみ)。
// auto ノードは id を `node_a*` にして「経路(edge)専用」と明示する。 house 紐付けや
// エーテライト起点(手動ノード基準)には使わない → door/起点の既存挙動を一切変えない。
{
  let autoCount = 0;
  const AUTO_DEDUP = 12; // px。 近接する端点候補どうしは 1 ノードへ統合(共有分岐点/微小誤差の吸収)
  for (const poly of roadSubpaths) {
    for (const p of [poly[0], poly[poly.length - 1]]) {
      if (!p) continue;
      if (nearestNode(p[0], p[1], NODE_SNAP)) continue;        // 既存ノード近傍 → 不要
      let dup = false;
      for (const n of nodes) { if (dist(p[0], p[1], n._px.x, n._px.y) < AUTO_DEDUP) { dup = true; break; } }
      if (dup) continue;                                        // 既に追加した auto ノード近傍 → 統合
      nodes.push({ id: `node_a${++autoCount}`, x: nx(p[0]), y: ny(p[1]), _px: { x: p[0], y: p[1] }, auto: true });
    }
  }
}

// --- edges: 道の折れ線が通るノードを順に拾い、 連続ノード間の点列を polyline として保存 ---
//     (BFS で得た node 列を MapView 側で edge.polyline を順に連結すれば「道なり」 の経路になる)
const edgeMap = new Map(); // key = "a|b" sorted, value = { a, b, polyline: [[px,py],...] }
if (roadD) {
  for (const poly of roadSubpaths) {
    // 1. この subpath が通過するノード列 (idx, nodeId) を順に拾う
    const passes = [];
    for (let i = 0; i < poly.length; i++) {
      const [px, py] = poly[i];
      const n = nearestNode(px, py, NODE_SNAP);
      if (!n) continue;
      const last = passes[passes.length - 1];
      if (!last || last.nodeId !== n.id) passes.push({ idx: i, nodeId: n.id });
    }
    // 2. 連続する 2 通過点 (a → b) ごとに、 idx 範囲の点列を edge polyline として保存
    for (let k = 0; k + 1 < passes.length; k++) {
      const A = passes[k];
      const B = passes[k + 1];
      if (A.nodeId === B.nodeId) continue;
      const key = [A.nodeId, B.nodeId].sort().join('|');
      if (edgeMap.has(key)) continue; // 同じ edge は最初に見つけた polyline を採用
      const aN = nodes.find((n) => n.id === A.nodeId);
      const bN = nodes.find((n) => n.id === B.nodeId);
      const mid = poly.slice(A.idx, B.idx + 1).map(([x, y]) => [x, y]);
      // 両端を厳密にノード中心へ置換 (NODE_SNAP 内の点はノード中心とは少しズレているため)
      mid[0] = [aN._px.x, aN._px.y];
      mid[mid.length - 1] = [bN._px.x, bN._px.y];
      edgeMap.set(key, { a: A.nodeId, b: B.nodeId, polyline: mid });
    }
  }
}
const edges = [...edgeMap.values()].map((e) => ({
  a: e.a,
  b: e.b,
  polyline: e.polyline.map(([x, y]) => [nx(x), ny(y)]),
}));

// --- 各家を最寄り「手動」ノードに接続 (auto ノードは経路専用のため house 紐付けから除外)。
//     → house.node の値は auto ノード導入前と同一に保たれ、 door 幾何(入口データ無し区画)が不変。
for (const h of houses) {
  let best = null, bd = Infinity;
  for (const n of nodes) { if (n.auto) continue; const d = dist(h._px.x, h._px.y, n._px.x, n._px.y); if (d < bd) { bd = d; best = n; } }
  h.node = best ? best.id : null;
}

// 出力 (px は落とす)
const out = {
  area, viewBox: { w: W, h: H },
  nodes: nodes.map(({ id, x, y }) => ({ id, x, y })),
  edges,
  houses: houses.map(({ kind, plot, x, y, node, outline }) => ({ kind, plot, x, y, node, outline })),
  roadPath: roadD,
  visibleRoadPath: visibleRoadD,
};
writeFileSync(outPath, JSON.stringify(out, null, 2));

// サマリ表示 (精度チェック用)
console.log(`area=${area} viewBox=${W}x${H}`);
console.log(`houses=${houses.length} nodes=${nodes.length} edges=${edges.length}`);
console.log('edges:', edges.map((e) => `${e.a}-${e.b}(pts=${e.polyline.length})`).join(', '));
console.log('house -> 最寄りnode:');
for (const h of houses.sort((a, b) => a.plot - b.plot)) {
  console.log(`  ${h.kind}_${h.plot} -> ${h.node}`);
}
console.log(`\n出力: ${outPath}`);
