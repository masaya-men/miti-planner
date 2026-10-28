import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { classGroups } from '../classGroups.mjs';
// @ts-expect-error mjs の共通部品(型定義なし)
import { findOrderPairs, parseRules } from '../cssRules.mjs';

describe('classGroups', () => {
  it('接頭辞を渡すとその class 同士を仲間にする', () => {
    const jsx = ['<div className="milspec-a milspec-b" />'];
    expect(classGroups(jsx, /^milspec-/)('milspec-a', 'milspec-b')).toBe(true);
    expect(classGroups(jsx)('milspec-a', 'milspec-b')).toBe(false);
  });
  it('同じ className に並ぶ class は同じ要素の仲間', () => {
    expect(classGroups(['<div className="housing-a housing-b" />'])('housing-a', 'housing-b')).toBe(true);
  });
  it('テンプレート文字列の className も読む', () => {
    const related = classGroups(['<div className={`housing-a${x ? \' housing-c\' : \'\'}`} />']);
    expect(related('housing-c', 'housing-a')).toBe(true);
  });
  it('X と X--修飾 は仲間', () => {
    expect(classGroups([])('housing-tour-page--reorg', 'housing-tour-page')).toBe(true);
  });
  it('別々の要素の class は仲間でない', () => {
    expect(classGroups(['<div className="housing-a" /><span className="housing-b" />'])('housing-a', 'housing-b')).toBe(false);
  });
  it('共通の土台 class を介した連鎖ではつながない', () => {
    const related = classGroups(['<i className="housing-skel housing-skel-line" /><i className="housing-skel housing-skel-media" />']);
    expect(related('housing-skel-line', 'housing-skel-media')).toBe(false);
  });
});

describe('findOrderPairs と仲間', () => {
  it('同じ要素に付く別名 class の同詳細度・同性質は組', () => {
    const related = classGroups(['<div className="housing-tour-page housing-tour-page--reorg" />']);
    const rules = parseRules('.housing-tour-page{width:1px} .housing-tour-page--reorg{width:2px}', 'x.css');
    expect(findOrderPairs(rules)).toHaveLength(0);
    expect(findOrderPairs(rules, related)).toHaveLength(1);
  });
});
