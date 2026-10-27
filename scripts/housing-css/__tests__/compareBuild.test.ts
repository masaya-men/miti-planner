import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { compareCss } from '../compare-build.mjs';

const BASE = '.housing-a{color:red} .housing-a{color:blue} .housing-b{margin:0} .housing-c{padding:0}';

describe('compareCss', () => {
  it('同じ CSS なら差なし', () => {
    expect(compareCss(BASE, BASE)).toEqual({ missing: [], extra: [], flipped: [] });
  });
  it('規則が消えたら missing', () => {
    const r = compareCss(BASE, BASE.replace('.housing-b{margin:0}', ''));
    expect(r.missing).toHaveLength(1);
    expect(r.extra).toHaveLength(0);
  });
  it('同じ規則が 2 回なら extra', () => {
    expect(compareCss(BASE, `${BASE} .housing-c{padding:0}`).extra).toHaveLength(1);
  });
  it('順番頼りの組が逆になったら flipped', () => {
    const next = '.housing-a{color:blue} .housing-a{color:red} .housing-b{margin:0} .housing-c{padding:0}';
    expect(compareCss(BASE, next).flipped).toHaveLength(1);
  });
  it('組でない規則の入れ替えは flipped にならない', () => {
    const next = '.housing-c{padding:0} .housing-a{color:red} .housing-a{color:blue} .housing-b{margin:0}';
    expect(compareCss(BASE, next)).toEqual({ missing: [], extra: [], flipped: [] });
  });
});
