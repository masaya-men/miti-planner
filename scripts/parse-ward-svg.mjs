// Figma 書き出しの ward SVG を解析して、 マップ用データ (houses / nodes / edges / 道) を生成する。
// 使い方: node scripts/parse-ward-svg.mjs <input.svg> <area> [out.json]
//   houses: <path id="plot_N"|"apart_N"> の bbox 中心
//   nodes:  <g id="Node"> 内 <path id="node_N"> の bbox 中心 (円)
//   road:   ナビゲーション用道路の 1 本 path (M/L/H/V) を折れ線化
//   edges:  道の折れ線が通るノードを順に拾い、 連続ノード間を辺に (自動接続)
//   house.node: 各家を最寄りノードへ自動接続
// 座標は viewBox 基準で 0..1 正規化。
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, area = 'Mist', outPath = `src/data/housing/${area.toLowerCase()}Ward.generated.json`] = process.argv;
const svg = readFileSync(inPath, 'utf8');

const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
const W = Number(vb[1]), H = Number(vb[2]);
const nx = (x) => +(x / W).toFixed(5);
const ny = (y) => +(y / H).toFixed(5);

const nums = (s) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
function bboxCenter(d) {
  const ns = nums(d);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < ns.length; i += 2) {
    const x = ns[i], y = ns[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

// --- houses ---
const houses = [];
for (const m of svg.matchAll(/<path id="(plot|apart)_(\d+)"[^>]*\sd="([^"]+)"/g)) {
  const c = bboxCenter(m[3]);
  houses.push({ kind: m[1], plot: Number(m[2]), x: nx(c.x), y: ny(c.y), _px: c });
}

// --- nodes (Node グループ内) ---
const nodeGroup = svg.match(/<g id="Node">([\s\S]*?)<\/g>/);
const nodes = [];
for (const m of (nodeGroup ? nodeGroup[1] : '').matchAll(/<path id="(node_\d+)"[^>]*\sd="([^"]+)"/g)) {
  const c = bboxCenter(m[2]);
  nodes.push({ id: m[1], x: nx(c.x), y: ny(c.y), _px: c });
}

// --- nav road path (M117.5 573.5 で始まる長い path) ---
const roadM = svg.match(/<path id="[^"]*"\s+d="(M117\.5 573\.5[^"]+)"\s+stroke="#FF0000"/);
const roadD = roadM ? roadM[1] : null;

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

// --- edges: 道の折れ線が通るノードを順に拾い連続ノードを結ぶ ---
const edgeSet = new Set();
if (roadD) {
  for (const poly of parseRoad(roadD)) {
    let prev = null;
    for (const [px, py] of poly) {
      const n = nearestNode(px, py, NODE_SNAP);
      if (n && n.id !== prev) {
        if (prev) edgeSet.add([prev, n.id].sort().join('|'));
        prev = n.id;
      }
    }
  }
}
const edges = [...edgeSet].map((s) => s.split('|'));

// --- 各家を最寄りノードに自動接続 ---
for (const h of houses) { const n = nearestNode(h._px.x, h._px.y); h.node = n ? n.id : null; }

// 出力 (px は落とす)
const out = {
  area, viewBox: { w: W, h: H },
  nodes: nodes.map(({ id, x, y }) => ({ id, x, y })),
  edges,
  houses: houses.map(({ kind, plot, x, y, node }) => ({ kind, plot, x, y, node })),
  roadPath: roadD,
};
writeFileSync(outPath, JSON.stringify(out, null, 2));

// サマリ表示 (精度チェック用)
console.log(`area=${area} viewBox=${W}x${H}`);
console.log(`houses=${houses.length} nodes=${nodes.length} edges=${edges.length}`);
console.log('edges:', edges.map((e) => e.join('-')).join(', '));
console.log('house -> 最寄りnode:');
for (const h of houses.sort((a, b) => a.plot - b.plot)) {
  console.log(`  ${h.kind}_${h.plot} -> ${h.node}`);
}
console.log(`\n出力: ${outPath}`);
