import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { findOrderPairs, parseRules, specificity, subjectClasses } from '../cssRules.mjs';

describe('specificity', () => {
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
  it(':not の中は数えない', () => {
    expect(subjectClasses('.housing-a:not(.housing-b)')).toEqual(['housing-a']);
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
  it('片方だけ @media なら組にならない', () => {
    expect(pairs('.housing-a{color:red} @media (max-width:767px){.housing-a{color:blue}}')).toHaveLength(0);
  });
  it('同じ要素に当たりうる同詳細度は組', () => {
    expect(pairs('.x .housing-a{color:red} .y .housing-a{color:blue}')).toHaveLength(1);
  });
  it('性質が違えば組にならない', () => {
    expect(pairs('.housing-a{color:red} .housing-a{margin:0}')).toHaveLength(0);
  });
});
