// @vitest-environment node
// リグレッション: ward JSON の houses[].x/y が、アプリが描画する *.generated.svg の
// 「実際の幾何中心」と一致することを保証する。旧パーサの bboxCenter が SVG コマンド(H/V/C)を
// 無視した単純数値ペアリングで角丸箱(アパート/一部区画)の中心を破損させていた回帰を防ぐ。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 正しい SVG path トークナイザ (scripts/svg-path-center.mjs と同一・テスト自己完結のため再掲)。
const ARGC: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function pathPoints(d: string): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  const toks = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, cmd: string | null = null;
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) { cmd = toks[i].toUpperCase(); i++; if (cmd === 'Z') { cx = sx; cy = sy; continue; } }
    const n = ARGC[cmd as string] ?? 2;
    const a: number[] = [];
    for (let k = 0; k < n; k++) a.push(Number(toks[i++]));
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
function attrNum(open: string, name: string): number | null {
  const m = open.match(new RegExp(`\\s${name}="(-?[\\d.]+)"`));
  return m ? Number(m[1]) : null;
}
// 要素自身の rotate(angle[, cx, cy]) を点に適用 (回転 rect=goblet の実描画位置に一致させる)。
function applyTransform(cx: number, cy: number, open: string): { x: number; y: number } {
  const rot = open.match(/rotate\(([^)]+)\)/);
  if (!rot) return { x: cx, y: cy };
  const [ang, ox = 0, oy = 0] = rot[1].split(/[\s,]+/).map(Number);
  const rad = (ang * Math.PI) / 180, dx = cx - ox, dy = cy - oy;
  return { x: ox + dx * Math.cos(rad) - dy * Math.sin(rad), y: oy + dx * Math.sin(rad) + dy * Math.cos(rad) };
}
function elementCenterPx(svg: string, id: string): { x: number; y: number } | null {
  const at = svg.indexOf(`id="${id}"`);
  if (at < 0) return null;
  const tagStart = svg.lastIndexOf('<', at);
  const tagEnd = svg.indexOf('>', at);
  const tag = svg.slice(tagStart + 1).match(/^[a-zA-Z]+/)?.[0];
  const open = svg.slice(tagStart, tagEnd + 1);
  if (tag === 'rect') {
    const x = attrNum(open, 'x') ?? 0, y = attrNum(open, 'y') ?? 0;
    const w = attrNum(open, 'width') ?? 0, h = attrNum(open, 'height') ?? 0;
    return applyTransform(x + w / 2, y + h / 2, open);
  }
  if (tag === 'circle' || tag === 'ellipse') {
    return applyTransform(attrNum(open, 'cx') ?? 0, attrNum(open, 'cy') ?? 0, open);
  }
  const dm = open.match(/\sd="([^"]+)"/);
  if (!dm) return null;
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity, any = false;
  for (const [x, y] of pathPoints(dm[1])) { any = true; if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return any ? applyTransform((a + c) / 2, (b + d) / 2, open) : null;
}

const MAPS: Array<[string, string]> = [
  ['mistWard', 'mist.generated.svg'], ['mistSubWard', 'mistSub.generated.svg'],
  ['lavenderWard', 'lavender.generated.svg'], ['lavenderSubWard', 'lavenderSub.generated.svg'],
  ['gobletWard', 'goblet.generated.svg'], ['gobletSubWard', 'gobletSub.generated.svg'],
  ['shiroganeWard', 'shirogane.generated.svg'], ['shiroganeSubWard', 'shiroganeSub.generated.svg'],
  ['empyreumWard', 'empyreum.generated.svg'], ['empyreumSubWard', 'empyreumSub.generated.svg'],
];
const DIR = join(process.cwd(), 'src', 'data', 'housing');
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

interface WardHouse { kind: 'plot' | 'apart'; plot: number; x: number; y: number; node: string | null }
interface WardJson { viewBox: { w: number; h: number }; nodes: Array<{ id: string; x: number; y: number }>; houses: WardHouse[] }

describe('ward JSON houses 座標 == 実 SVG の幾何中心 (全10マップ)', () => {
  for (const [ward, genSvg] of MAPS) {
    it(`${ward}: 全 house の (x,y) が ${genSvg} の要素中心と一致`, () => {
      const data = JSON.parse(read(`${ward}.generated.json`)) as WardJson;
      const svg = read(genSvg);
      const { w: W, h: H } = data.viewBox;
      for (const h of data.houses) {
        const c = elementCenterPx(svg, `${h.kind}_${h.plot}`);
        expect(c, `${ward} ${h.kind}_${h.plot} element`).not.toBeNull();
        const nxv = c!.x / W, nyv = c!.y / H;
        expect(Math.abs(nxv - h.x), `${ward} ${h.kind}_${h.plot} x (json ${h.x} vs svg ${nxv.toFixed(5)})`).toBeLessThan(0.002);
        expect(Math.abs(nyv - h.y), `${ward} ${h.kind}_${h.plot} y (json ${h.y} vs svg ${nyv.toFixed(5)})`).toBeLessThan(0.002);
      }
    });
  }

  it('houses[].node が (x,y) のほぼ最寄りノードである (経路終点の妥当性)', () => {
    // 最小距離との差が十分小さいことを要求する (同距離付近の tie-break 差は許容し、
    // 明らかに遠いノード=座標破損由来の誤スナップは弾く)。
    for (const [ward] of MAPS) {
      const data = JSON.parse(read(`${ward}.generated.json`)) as WardJson;
      const byId = new Map(data.nodes.map((n) => [n.id, n]));
      // house 紐付けは「手動ノード」基準。 auto ノード(node_a*)は経路(edge)専用で house には使わないため除外する。
      const manual = data.nodes.filter((n) => !/^node_a/.test(n.id));
      for (const h of data.houses) {
        let minD = Infinity;
        for (const n of manual) { const d = Math.hypot(n.x - h.x, n.y - h.y); if (d < minD) minD = d; }
        const nd = byId.get(h.node as string)!;
        const hd = Math.hypot(nd.x - h.x, nd.y - h.y);
        // 既存パーサの house→node 割当は稀に最寄りから最大 ~0.05 ずれる (座標バグとは別系統・遠隔区画)。
        // ここでは「座標破損由来の再スナップ漏れ (動いた家が旧ノードのまま = 0.13+ ずれる)」を弾くのが目的。
        expect(hd - minD, `${ward} ${h.kind}_${h.plot} node ${h.node} は最寄りから遠い (dist ${hd.toFixed(4)} vs min ${minD.toFixed(4)})`).toBeLessThan(0.08);
      }
    }
  });
});

// Task 3: houses[].outline (輪郭頂点・0..1 正規化) の付与を検証する。
// 全 10 マップで「outline あり・3 点以上・0..1 範囲・重心≒登録中心」を確認する。
describe('ward JSON houses[].outline (輪郭頂点) (全10マップ)', () => {
  for (const [ward] of MAPS) {
    it(`${ward}: 各 house に outline(3 点以上・0..1 範囲)が付き、重心が中心と概ね一致`, () => {
      const data = JSON.parse(read(`${ward}.generated.json`)) as unknown as {
        houses: Array<{ kind: string; plot: number; x: number; y: number; outline: number[][] | null }>;
      };
      for (const h of data.houses) {
        expect(Array.isArray(h.outline), `${ward} ${h.kind}_${h.plot} outline`).toBe(true);
        expect(h.outline!.length, `${ward} ${h.kind}_${h.plot} outline length`).toBeGreaterThanOrEqual(3);
        for (const [x, y] of h.outline!) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(1);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(1);
        }
        const cx = h.outline!.reduce((s, p) => s + p[0], 0) / h.outline!.length;
        const cy = h.outline!.reduce((s, p) => s + p[1], 0) / h.outline!.length;
        expect(Math.hypot(cx - h.x, cy - h.y), `${ward} ${h.kind}_${h.plot} 重心 vs 中心`).toBeLessThan(0.05);
      }
    });
  }
});
