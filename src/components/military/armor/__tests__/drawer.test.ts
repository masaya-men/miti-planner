import { describe, it, expect } from 'vitest';
import { drawerSVG, glowSVG, DRAWER } from '../drawer';
import { hex } from '../color';
import { HDR_BANDS } from '../../headerGeometry';
import type { ArmorPalette, DrawerSpec, GlowSpec } from '../types';

const t = { top: hex('#555b61'), bot: hex('#2a2e32'), hi: hex('#8a9096'), lo: hex('#101214'), face: hex('#444a50') };
const pal: ArmorPalette = {
  pri: t, sec: t, chs: t, key: t, edge: hex('#0a0b0c'), keyEdge: hex('#050505'), pkTop: hex('#111'), pkBot: hex('#222'),
  scribe: 'rgba(0,0,0,.6)', scribeHi: 'rgba(255,255,255,.1)', seam: 'rgba(0,0,0,.5)', seamCore: '#444', dish: 0.2, keySh: 0.5, grain: 0.1, spec: 0.3,
  drw: { lit: hex('#9aa3a9'), dark: hex('#565e64'), knot: hex('#b8c0c5'), edgeHi: hex('#dfe5e9'), frame: hex('#8e979d'), zinc: hex('#eef2f4'), rust: hex('#8a4a1e'), soot: hex('#050403') },
};
const spec: DrawerSpec = { kind: 'drawer', x0: 623, x1: 1050, rest: [683, 959], bands: HDR_BANDS, shadow: 1, dirt: 2, dark: 1 };
const gspec: GlowSpec = { kind: 'glow', x0: 623, x1: 1050, windows: [[6, 46], [54, 98]], glow: 0.55 };

describe('drawerSVG(下の板)', () => {
  it('決定値は D8', () => { expect(DRAWER).toEqual({ shadow: 1, dirt: 2, dark: 1, glow: 0.55 }); });
  it('網のパターンは穴を塗らない(pattern の中に全面 rect が無い)・枠・レール・ハザード・ローラーがある', () => {
    const s = drawerSVG(spec, pal, 'd');
    expect(s).toMatch(/<pattern id="d-mesh" width="20" height="10"/);
    expect(s).not.toMatch(/<pattern id="d-mesh"[^>]*>\s*<rect[^>]*width="20" height="10"/);
    expect(s).toMatch(/fill="url\(#hz\)"/);
    expect(s).toMatch(/fill="url\(#stl-fl\)"/);
    expect((s.match(/url\(#stl-nut\)/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  it('汚れ 2.0 は 1.0 より抉り傷・しずくが多い。0 なら無い', () => {
    const n = (d: number, c: string) => (drawerSVG({ ...spec, dirt: d }, pal, 'd').match(new RegExp(`class="${c}"`, 'g')) ?? []).length;
    expect(n(2, 'drw-gouge')).toBeGreaterThan(n(1, 'drw-gouge')); expect(n(0, 'drw-gouge')).toBe(0);
    expect(n(2, 'drw-drip')).toBeGreaterThan(n(1, 'drw-drip')); expect(n(0, 'drw-drip')).toBe(0);
  });
  it('休む 2 か所(rest)につや・黒ずみが置かれる', () => {
    const s = drawerSVG(spec, pal, 'd');
    expect(s).toMatch(/cx="688"[^>]*fill="url\(#polish-r\)"/);
    expect(s).toMatch(/cx="954"[^>]*fill="url\(#polish-r\)"/);
  });
  it('色は直書きせずトークン(pal.drw)から', () => {
    const s = drawerSVG({ ...spec }, { ...pal, drw: { ...pal.drw, lit: hex('#010203') } }, 'd');
    expect(s).toContain('rgb(1,2,3)');
  });
  it('縁光のマスクは静的(自前のにじみ)、blur は下の板にだけ', () => {
    expect(drawerSVG(spec, pal, 'd')).toMatch(/<mask id="d-rim"[\s\S]*filter="url\(#blur8\)"/);
    expect(glowSVG(gspec, pal, 'g')).not.toMatch(/filter=/);
  });
  it('影は帯ごとに near / far の 4 枚、幅は窓幅で頭打ち', () => {
    const s = drawerSVG(spec, pal, 'd');
    expect((s.match(/data-sh="near-l"/g) ?? []).length).toBe(HDR_BANDS.length);
    const n = drawerSVG({ ...spec, rest: [683, 690] }, pal, 'd');
    expect(n).toMatch(/data-sh="far-l" data-band="1" x="714.00" y="4" width="7.00"/);
  });
});
describe('glowSVG(基板)', () => {
  it('配線は data-trace="drw:1"〜"drw:6" の path.milspec-trc、窓で clipPath、不透明度 0.55', () => {
    const s = glowSVG(gspec, pal, 'g');
    for (let i = 1; i <= 6; i++) expect(s).toMatch(new RegExp(`class="milspec-trc" data-trace="drw:${i}"`));
    expect(s).toMatch(/<clipPath id="g-win">/); expect(s).toMatch(/class="milspec-drw-glow" opacity="0.55"/);
  });
  it('部品は 240px ごとの繰り返し(窓が長いほどチップが増える。伸びない)', () => {
    const a = glowSVG({ ...gspec, x1: gspec.x0 + 300 }, pal, 'g'), b = glowSVG({ ...gspec, x1: gspec.x0 + 1100 }, pal, 'g');
    expect((b.match(/LP-0418/g) ?? []).length).toBeGreaterThan((a.match(/LP-0418/g) ?? []).length);
  });
});
