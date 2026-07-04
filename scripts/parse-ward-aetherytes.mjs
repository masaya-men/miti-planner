// 元SVG(docs/housing-maps-src/*.svg) からエーテネットシャードの名前+座標を抽出し、
// 各マップの ward JSON の最寄りノードへ snap して wardAetherytes.generated.json を生成する。
// 照合対象は P1 wardDirections の per-plot 最寄りエーテライト名集合(同一地図内のみ)。本街/拡張は完全分離。
import { readFileSync, writeFileSync } from 'node:fs';

function decode(s) {
  const parts = s.split(/(&#\d+;)/); const b = [];
  for (const p of parts) { const m = p.match(/^&#(\d+);$/); if (m) b.push(Number(m[1])); else for (const ch of Buffer.from(p, 'utf8')) b.push(ch); }
  return Buffer.from(b).toString('utf8');
}
const nums = (s) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
const norm = (s) => s.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();

// depth-aware group 抽出: {name, inner}[]
function groups(svg) {
  const res = [], stack = [], re = /<g\b([^>]*)>|<\/g>/g; let m;
  while ((m = re.exec(svg))) {
    if (m[0] === '</g>') { const g = stack.pop(); if (g) res.push({ name: g.name, inner: svg.slice(g.contentStart, m.index) }); }
    else { const idm = m[1].match(/\bid="([^"]*)"/); stack.push({ name: idm ? decode(idm[1]) : null, contentStart: re.lastIndex }); }
  }
  return res;
}
function bboxCenter(inner) {
  const ds = [...inner.matchAll(/\sd="([^"]+)"/g)].map((x) => x[1]).join(' ');
  const extra = [...inner.matchAll(/\s(?:x|y|cx|cy)="(-?[\d.]+)"/g)].map((x) => x[1]).join(' ');
  const ns = nums(ds + ' ' + extra); let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (let i = 0; i + 1 < ns.length; i += 2) { const x = ns[i], y = ns[i + 1]; if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  if (!isFinite(a)) return null; return { x: (a + c) / 2, y: (b + d) / 2 };
}
function nearestNode(ward, x, y) { let best = null, bd = Infinity; for (const n of ward.nodes) { const dd = Math.hypot(n.x - x, n.y - y); if (dd < bd) { bd = dd; best = n; } } return best ? best.id : null; }

const AREAS = [
  { area: 'Mist', main: ['mist', 'mist.svg', 'mistWard'], sub: ['mist-sub', 'mist-sub.svg', 'mistSubWard'] },
  { area: 'LavenderBeds', main: ['lavender', 'lavender-main.svg', 'lavenderWard'], sub: ['lavender-sub', 'lavender-sub.svg', 'lavenderSubWard'] },
  { area: 'Goblet', main: ['goblet', 'goblet-main.svg', 'gobletWard'], sub: ['goblet-sub', 'goblet-sub.svg', 'gobletSubWard'] },
  { area: 'Shirogane', main: ['shirogane', 'shirogane-main.svg', 'shiroganeWard'], sub: ['shirogane-sub', 'shirogane-sub.svg', 'shiroganeSubWard'] },
  { area: 'Empyreum', main: ['empyreum', 'empyreum-main.svg', 'empyreumWard'], sub: ['empyreum-sub', 'empyreum-sub.svg', 'empyreumSubWard'] },
];
const wd = JSON.parse(readFileSync('src/data/housing/wardDirections.generated.json', 'utf8'));
const out = {};
let total = 0, matched = 0;
for (const A of AREAS) {
  for (const seg of [{ m: A.main, lo: 1, hi: 30 }, { m: A.sub, lo: 31, hi: 60 }]) {
    const [mapKey, svgFile, wardKey] = seg.m;
    const svg = readFileSync(`docs/housing-maps-src/${svgFile}`, 'utf8');
    const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const W = +vb[1], H = +vb[2];
    const ward = JSON.parse(readFileSync(`src/data/housing/${wardKey}.generated.json`, 'utf8'));
    const targets = new Set(); for (let p = seg.lo; p <= seg.hi; p++) { const n = wd[A.area][p]?.aetheryte; if (n) targets.add(norm(n)); }
    const byNorm = new Map();
    for (const g of groups(svg)) { if (!g.name) continue; const key = norm(g.name); if (!targets.has(key) || byNorm.has(key)) continue; const c = bboxCenter(g.inner); if (!c) continue; byNorm.set(key, { name: g.name, x: +(c.x / W).toFixed(5), y: +(c.y / H).toFixed(5) }); }
    const shards = [...byNorm.values()].map((s) => ({ ...s, node: nearestNode(ward, s.x, s.y) }));
    out[mapKey] = shards;
    // カバレッジ検算
    for (let p = seg.lo; p <= seg.hi; p++) { total++; const n = wd[A.area][p]?.aetheryte; if (n && byNorm.has(norm(n))) matched++; }
  }
}
writeFileSync('src/data/housing/wardAetherytes.generated.json', JSON.stringify(out, null, 2));
console.log(`wardAetherytes.generated.json 出力。カバレッジ ${matched}/${total}`);
for (const k of Object.keys(out)) console.log(`  ${k}: ${out[k].length} shards (node 未 snap = ${out[k].filter((s) => !s.node).length})`);
