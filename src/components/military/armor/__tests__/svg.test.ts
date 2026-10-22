import { describe, it, expect } from 'vitest';
import { armorSVG, capSVG, armorDefsSVG } from '../svg';
import { chamRect } from '../geom';
import { hex } from '../color';
import type { ArmorPalette, PanelSpec } from '../types';

const mk = (): ArmorPalette => {
  const t = { top: hex('#555b61'), bot: hex('#2a2e32'), hi: hex('#8a9096'), lo: hex('#101214'), face: hex('#444a50') };
  return { pri: t, sec: t, chs: t, key: t, edge: hex('#0a0b0c'), keyEdge: hex('#050505'), pkTop: hex('#111'), pkBot: hex('#222'),
    scribe: 'rgba(0,0,0,.6)', scribeHi: 'rgba(255,255,255,.1)', seam: 'rgba(0,0,0,.5)', seamCore: '#444', dish: 0.2, keySh: 0.5, grain: 0.1, spec: 0.3,
    drw: { lit: t.top, dark: t.bot, knot: t.hi, edgeHi: t.hi, frame: t.face, zinc: t.hi, rust: t.lo, soot: t.lo } };
};
const S1: PanelSpec = { tone: 'pri', b: 4,
  pts: [[16, 0], [232, 0], [274, 42], [274, 104], [268, 110], [206, 110], [198, 118], [150, 118], [142, 110], [6, 110], [0, 104], [0, 16]],
  scribes: ['M 142 105 H 206'], wx: { chips: 1.1, wear: [[130, 58, 118, 7]] } };

describe('armorSVG / capSVG', () => {
  it('S1 パネル', () => {
    const s = armorSVG(S1, mk(), 't1');
    expect((s.match(/<polygon/g) ?? []).length).toBeGreaterThanOrEqual(12);
    expect(s).toContain('id="t1f"');
    expect(s).toContain('M 142 105 H 206');
  });
  it('同じ入力で同じ文字列', () => {
    expect(armorSVG(S1, mk(), 't1')).toBe(armorSVG(S1, mk(), 't1'));
  });
  it('capSVG は polygon を含む', () => {
    expect(capSVG({ pts: chamRect(30, 20, 3) }, mk(), 'k1')).toContain('<polygon');
  });
  it('armorDefsSVG はノイズ URL を受ける', () => {
    expect(armorDefsSVG('data:image/png;base64,AAA')).toContain('data:image/png;base64,AAA');
  });
});
