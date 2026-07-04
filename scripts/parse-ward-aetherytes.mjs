// 元SVG(docs/housing-maps-src/*.svg) からエーテネットシャードの名前+座標を抽出し、
// 各マップの ward JSON の最寄りノードへ snap して wardAetherytes.generated.json を生成する。
// 照合対象は P1 wardDirections の per-plot 最寄りエーテライト名集合(同一地図内のみ)。本街/拡張は完全分離。
import { readFileSync, writeFileSync } from 'node:fs';

function decode(s) {
  const parts = s.split(/(&#\d+;)/); const b = [];
  for (const p of parts) { const m = p.match(/^&#(\d+);$/); if (m) b.push(Number(m[1])); else for (const ch of Buffer.from(p, 'utf8')) b.push(ch); }
  return Buffer.from(b).toString('utf8');
}
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
// SVG path を正しくトークナイズし on-curve 点だけ集める(H/V=1引数, C=6引数の制御点は無視)。
const ARGC = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function pathPoints(d) {
  const pts = []; let cx = 0, cy = 0, sx = 0, sy = 0;
  const toks = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, cmd = null;
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) { cmd = toks[i].toUpperCase(); i++; if (cmd === 'Z') { cx = sx; cy = sy; continue; } }
    const n = ARGC[cmd] ?? 2; const a = []; for (let k = 0; k < n; k++) a.push(Number(toks[i++]));
    if (cmd === 'M') { cx = a[0]; cy = a[1]; sx = cx; sy = cy; pts.push([cx, cy]); }
    else if (cmd === 'L' || cmd === 'T') { cx = a[0]; cy = a[1]; pts.push([cx, cy]); }
    else if (cmd === 'H') { cx = a[0]; pts.push([cx, cy]); }
    else if (cmd === 'V') { cy = a[0]; pts.push([cx, cy]); }
    else if (cmd === 'C') { cx = a[4]; cy = a[5]; pts.push([cx, cy]); }
    else if (cmd === 'S' || cmd === 'Q') { cx = a[2]; cy = a[3]; pts.push([cx, cy]); }
    else if (cmd === 'A') { cx = a[5]; cy = a[6]; pts.push([cx, cy]); }
  }
  return pts;
}
function bboxCenter(inner) {
  const ds = [...inner.matchAll(/\sd="([^"]+)"/g)].map((x) => x[1]);
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity, any = false;
  for (const dd of ds) for (const [x, y] of pathPoints(dd)) { any = true; if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  if (!any) return null; return { x: (a + c) / 2, y: (b + d) / 2 };
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
    // 名前一致率検算(座標の正しさは別途テストで担保)
    for (let p = seg.lo; p <= seg.hi; p++) { total++; const n = wd[A.area][p]?.aetheryte; if (n && byNorm.has(norm(n))) matched++; }
  }
}
writeFileSync('src/data/housing/wardAetherytes.generated.json', JSON.stringify(out, null, 2));
console.log(`wardAetherytes.generated.json 出力。名前一致率 ${matched}/${total}`);
for (const k of Object.keys(out)) console.log(`  ${k}: ${out[k].length} shards (node 未 snap = ${out[k].filter((s) => !s.node).length})`);
