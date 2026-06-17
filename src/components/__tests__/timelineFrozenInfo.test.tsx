// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { applyHorizontalScrollSync } from '../Timeline.layoutHooks';

describe('applyHorizontalScrollSync', () => {
  it('skillEls に渡した要素だけ translateX する', () => {
    const skillA = document.createElement('div');
    const skillB = document.createElement('div');
    applyHorizontalScrollSync({ scrollLeft: 120, skillEls: [skillA, skillB] });
    expect(skillA.style.transform).toBe('translateX(-120px)');
    expect(skillB.style.transform).toBe('translateX(-120px)');
  });

  it('null 要素を渡しても落ちない', () => {
    expect(() => applyHorizontalScrollSync({ scrollLeft: 50, skillEls: [null, undefined] })).not.toThrow();
  });

  it('影クラスは scrollLeft>0 で付与、0 で除去', () => {
    const pane = document.createElement('div');
    applyHorizontalScrollSync({ scrollLeft: 1, skillEls: [], shadowEls: [pane] });
    expect(pane.classList.contains('timeline-info-pane--scrolled')).toBe(true);
    applyHorizontalScrollSync({ scrollLeft: 0, skillEls: [], shadowEls: [pane] });
    expect(pane.classList.contains('timeline-info-pane--scrolled')).toBe(false);
  });
});
