import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { findOrderPairs, parseRules, specificity, subjectClasses } from '../cssRules.mjs';

describe('specificity', () => {
  it('古い書き方の :before / :after も擬似要素として数える(Tailwind の後処理を通った CSS と生の CSS で同じ)', () => {
    expect(specificity('.x:after')).toEqual(specificity('.x::after'));
    expect(specificity('.a .b:before')).toEqual([0, 2, 1]);
  });
  it('class と疑似クラスを数える', () => {
    expect(specificity('.a .b:hover')).toEqual([0, 3, 0]);
  });
  it('要素と :root', () => {
    expect(specificity('html:root .x')).toEqual([0, 2, 1]);
  });
  it(':where は 0', () => {
    expect(specificity(':where(.a) .b')).toEqual([0, 1, 0]);
  });
  it(':not は中の最大', () => {
    expect(specificity('.a:not(.b, #c)')).toEqual([1, 1, 0]);
  });
  it('疑似要素は要素扱い・属性は class 扱い', () => {
    expect(specificity('.a::before')).toEqual([0, 1, 1]);
    expect(specificity('.a[data-x="1 2"]')).toEqual([0, 2, 0]);
  });
});

describe('subjectClasses', () => {
  it('右端に housing class が無ければ全体の最後', () => {
    expect(subjectClasses('.housing-a .housing-b.is-open > span')).toEqual(['housing-b']);
  });
  it('右端の複合セレクタの housing class 全部', () => {
    expect(subjectClasses('.housing-a .housing-b.housing-c')).toEqual(['housing-b', 'housing-c']);
  });
  it('housinger- で始まる class も対象', () => {
    expect(subjectClasses('.housing-detail-panel .housinger-page-avatar')).toEqual(['housinger-page-avatar']);
  });
  it(':not の中は数えない', () => {
    expect(subjectClasses('.housing-a:not(.housing-b)')).toEqual(['housing-a']);
  });
  it('接頭辞を渡すとその class が対象(MIL-SPEC)', () => {
    expect(subjectClasses('.theme-military .milspec-a .milspec-b', /^milspec-/)).toEqual(['milspec-b']);
  });
  it('接頭辞を渡すと他の接頭辞の class は対象外', () => {
    expect(subjectClasses('.milspec-a .housing-b', /^milspec-/)).toEqual(['milspec-a']);
  });
});

describe('parseRules', () => {
  it('@media の条件を持つ', () => {
    const rules = parseRules('@media (max-width: 767px){ .housing-a{color:red} }', 'x.css');
    expect(rules[0].media).toBe('(max-width: 767px)');
    expect(rules[0].props).toEqual(['color']);
  });
  it('keyframes は atrule として並ぶ', () => {
    const rules = parseRules('@keyframes spin{from{opacity:0}to{opacity:1}} .a{color:red}', 'x.css');
    expect(rules.map((r) => r.kind)).toEqual(['atrule', 'rule']);
    expect(rules[0].name).toBe('keyframes');
  });
});

describe('findOrderPairs', () => {
  const pairs = (css: string) => findOrderPairs(parseRules(css, 'x.css'));
  it('詳細度が違えば組にならない', () => {
    expect(pairs('.housing-a{color:red} .x .housing-a{color:blue}')).toHaveLength(0);
  });
  it('同じセレクタ・同じ性質は組', () => {
    const p = pairs('.housing-a{color:red} .housing-a{color:blue}');
    expect(p).toHaveLength(1);
    expect(p[0][2]).toBe('color');
  });
  it('片方だけ @media でも、 両方が同時に効きうるので組', () => {
    expect(pairs('.housing-a{color:red} @media (max-width:767px){.housing-a{color:blue}}')).toHaveLength(1);
  });
  it('幅の条件が重ならない @media 同士は組にならない', () => {
    expect(pairs('@media (min-width: 768px){.housing-a{color:red}} @media (max-width: 767px){.housing-a{color:blue}}')).toHaveLength(0);
  });
  it('同じ要素に当たりうる同詳細度は組', () => {
    expect(pairs('.x .housing-a{color:red} .y .housing-a{color:blue}')).toHaveLength(1);
  });
  it('まとめ書きと個別書き(padding と padding-bottom 等)は同じ性質として組', () => {
    expect(pairs('.housing-a{padding:0} .housing-a{padding-bottom:4px}')).toHaveLength(1);
    expect(pairs('.housing-a{inset:0} .housing-a{bottom:4px}')).toHaveLength(1);
    expect(pairs('.housing-a{border-radius:2px} .housing-a{border-top-left-radius:4px}')).toHaveLength(1);
    expect(pairs('.housing-a{gap:2px} .housing-a{row-gap:4px}')).toHaveLength(1);
    expect(pairs('.housing-a{font:12px a} .housing-a{line-height:2}')).toHaveLength(1);
    expect(pairs('.housing-a{place-items:center} .housing-a{align-items:start}')).toHaveLength(1);
  });
  it('接頭辞を渡すとその class 同士で組を探す', () => {
    const rules = parseRules('.milspec-a{color:red} .milspec-a{color:blue}', 'x.css');
    expect(findOrderPairs(rules, undefined, /^milspec-/)).toHaveLength(1);
    expect(findOrderPairs(rules)).toHaveLength(0);
  });
  it('右端に対象 class が無い規則は、 右端の名前(class・属性)が同じなら別の祖先でも組(rightNames)', () => {
    const rules = parseRules('.milspec-key:hover .sh{transform:none} .milspec-keybtn:hover .sh{transform:none}', 'x.css');
    expect(findOrderPairs(rules, undefined, /^milspec-/)).toHaveLength(0);
    expect(findOrderPairs(rules, undefined, /^milspec-/, { rightNames: true })).toHaveLength(1);
  });
  it('rightNames でも右端の名前が違えば組にならない', () => {
    const rules = parseRules('.milspec-a .sh{opacity:1} .milspec-b .rim{opacity:0}', 'x.css');
    expect(findOrderPairs(rules, undefined, /^milspec-/, { rightNames: true })).toHaveLength(0);
  });
  it('性質が違えば組にならない', () => {
    expect(pairs('.housing-a{color:red} .housing-a{margin:0}')).toHaveLength(0);
  });
});
