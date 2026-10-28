import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { compareBuilds, compareCss } from '../compare-build.mjs';

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
  it('「A, B {}」を「A {} B {}」に分けても差なし', () => {
    const base = '.housing-x, .housing-y{color:red}';
    expect(compareCss(base, '.housing-x{color:red} .housing-y{color:red}')).toEqual({ missing: [], extra: [], flipped: [] });
  });
  it('組でない規則の入れ替えは flipped にならない', () => {
    const next = '.housing-c{padding:0} .housing-a{color:red} .housing-a{color:blue} .housing-b{margin:0}';
    expect(compareCss(BASE, next)).toEqual({ missing: [], extra: [], flipped: [] });
  });
});

describe('compareBuilds(起動時の CSS+後読みの CSS)', () => {
  const M = /^milspec-/;
  it('起動時の規則が後読みへ移っただけなら差なし', () => {
    const base = { eager: '.milspec-a{color:red} .milspec-b{margin:0}', lazy: [] };
    const next = { eager: '.milspec-b{margin:0}', lazy: [{ file: 'A.css', css: '.milspec-a{color:red}' }] };
    expect(compareBuilds(base, next, undefined, M)).toMatchObject({ missing: [], extra: [], flipped: [], lazyCross: 0 });
  });
  it('後読みの別々のファイルに分かれた組は flipped でなく lazyCross に数える', () => {
    const base = { eager: '.milspec-a{color:red}', lazy: [{ file: 'A.css', css: '.milspec-a{color:blue}' }] };
    const next = { eager: '', lazy: [{ file: 'A.css', css: '.milspec-a{color:blue}' }, { file: 'B.css', css: '.milspec-a{color:red}' }] };
    const r = compareBuilds(base, next, undefined, M);
    expect(r.flipped).toHaveLength(0);
    expect(r.lazyCross).toBe(1);
    expect(r.missing).toHaveLength(0);
  });
  it('基準で既に別々の後読みファイルにあった組は、 同じファイルに集めて並びが変わっても flipped にしない', () => {
    const base = { eager: '', lazy: [{ file: 'A.css', css: '.milspec-a{color:red}' }, { file: 'B.css', css: '.milspec-a{color:blue}' }] };
    const next = { eager: '', lazy: [{ file: 'K.css', css: '.milspec-a{color:blue} .milspec-a{color:red}' }] };
    expect(compareBuilds(base, next, undefined, M).flipped).toHaveLength(0);
  });
  it('起動時と後読みの間で動いた規則を toLazy / toEager に出す', () => {
    const base = { eager: '.milspec-a{color:red} .milspec-b{margin:0}', lazy: [{ file: 'A.css', css: '.milspec-c{padding:0}' }] };
    const next = { eager: '.milspec-c{padding:0}', lazy: [{ file: 'B.css', css: '.milspec-a{color:red} .milspec-b{margin:0}' }] };
    const r = compareBuilds(base, next, undefined, M);
    expect(r.toLazy).toHaveLength(2);
    expect(r.toEager).toHaveLength(1);
  });
  it('起動時の中で組が逆になったら flipped', () => {
    const base = { eager: '.milspec-a{color:red} .milspec-a{color:blue}', lazy: [] };
    const next = { eager: '.milspec-a{color:blue} .milspec-a{color:red}', lazy: [] };
    expect(compareBuilds(base, next, undefined, M).flipped).toHaveLength(1);
  });
  it('後読みから規則が消えたら missing', () => {
    const base = { eager: '', lazy: [{ file: 'A.css', css: '.milspec-a{color:red}' }] };
    expect(compareBuilds(base, { eager: '', lazy: [] }, undefined, M).missing).toHaveLength(1);
  });
});
