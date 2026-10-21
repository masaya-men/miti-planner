// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { printRows } from '../printRows';

/** 行 n 個(高さ 25・上から並ぶ)と効果アイコン 2 個を持つ器。可視範囲は 0〜100(= 4 行) */
function build(n = 20) {
  const c = document.createElement('div');
  c.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;
  const rect = vi.fn();
  for (let i = 0; i < n; i++) {
    const r = document.createElement('div');
    r.setAttribute('data-time-row', String(i));
    r.getBoundingClientRect = () => { rect(i); return { top: i * 25, bottom: i * 25 + 25, left: 0, right: 100, width: 100, height: 25, x: 0, y: i * 25, toJSON() {} } as DOMRect; };
    c.appendChild(r);
  }
  for (let k = 0; k < 2; k++) { const m = document.createElement('div'); m.setAttribute('data-mit-icon', ''); m.animate = vi.fn() as never; c.appendChild(m); }
  return { c, rect };
}
const rows = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-time-row]')];

describe('printRows', () => {
  beforeEach(() => {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
  });
  afterEach(() => vi.restoreAllMocks());

  it('見えている行だけに class と遅延を付ける', () => {
    const { c } = build();
    printRows(c, 200);
    const on = rows(c).filter((r) => r.classList.contains('milspec-pr'));
    expect(on.map((r) => r.dataset.timeRow)).toEqual(['0', '1', '2', '3']);
    expect(on[0].style.getPropertyValue('--d')).toBe('200ms');
    expect(on[3].style.getPropertyValue('--d')).toBe(`${200 + 3 * 32}ms`);
  });

  it('全行の位置は測らない(二分探索 + 可視の分だけ)', () => {
    const { c, rect } = build(200);
    printRows(c, 0);
    expect(rect.mock.calls.length).toBeLessThan(30);
  });

  it('効果アイコンは base + 行数*32 + 60 後に 360ms で出す', () => {
    const { c } = build();
    printRows(c, 160);
    const m = c.querySelector<HTMLElement>('[data-mit-icon]')!;
    const opts = (m.animate as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts.delay).toBe(160 + 4 * 32 + 60);
    expect(opts.duration).toBe(360);
  });

  it('動きを減らす設定では何もしない', () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never;
    const { c } = build();
    printRows(c, 0);
    expect(c.querySelector('.milspec-pr')).toBeNull();
    expect((c.querySelector('[data-mit-icon]')!.animate as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('タイマーを残さず、終わったら class を外す', () => {
    const spy = vi.spyOn(window, 'setTimeout');
    const { c } = build();
    printRows(c, 0);
    expect(spy).not.toHaveBeenCalled();
    const r = rows(c)[0];
    r.dispatchEvent(new Event('animationend'));
    expect(r.classList.contains('milspec-pr')).toBe(false);
  });
});
