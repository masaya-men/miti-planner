// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MilspecArmor } from '../MilspecArmor';
import type { PlacedPanel, StretchFrame } from '../armor/types';

const frame: StretchFrame = { w0: 274, h0: 122, sx: 137, sy: 61 };
const panels: PlacedPanel[] = [
  { x: 0, y: 0, w: 274, h: 122, spec: { pts: [[16, 0], [232, 0], [274, 42], [274, 122], [16, 122]] } },
  { x: 0, y: 0, w: 100, h: 50, spec: { pts: [[0, 0], [100, 0], [100, 50], [0, 50]] } },
];

type RoCb = (e: { contentRect: { width: number; height: number } }[]) => void;
let roCbs: RoCb[] = [];
const fireRo = (width: number, height: number) =>
  act(() => { roCbs.forEach((cb) => cb([{ contentRect: { width, height } }])); });

const setPal = (priTop: string) => {
  const s = document.documentElement.style;
  s.setProperty('--ma-pri-top', priTop);
  s.setProperty('--ma-pri-bot', '#000000');
};

beforeEach(() => {
  roCbs = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: RoCb) { roCbs.push(cb); }
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  setPal('#555b61');
  document.documentElement.className = '';
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.getElementById('milspec-armor-defs')?.remove();
});

describe('MilspecArmor', () => {
  it('パネルの数だけ svg を描き、aria-hidden で操作を邪魔しない', () => {
    const { container } = render(<div><MilspecArmor id="z" frame={frame} panels={panels} /></div>);
    const root = container.querySelector('.milspec-armor');
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.getAttribute('data-ms-armor')).toBe('z');
    expect(root?.querySelectorAll('svg.milspec-armor-panel')).toHaveLength(2);
  });

  it('親の幅が変わると伸びる位置より右の点が動いた SVG に作り直す', () => {
    const { container } = render(<div><MilspecArmor id="z" frame={frame} panels={panels} /></div>);
    const root = container.querySelector('.milspec-armor') as HTMLElement;
    fireRo(274, 122);
    expect(root.innerHTML).not.toContain('258,');
    fireRo(300, 122);
    expect(root.innerHTML).toContain('258,');
  });

  it('テーマが変わると SVG を作り直す', async () => {
    const { container } = render(<div><MilspecArmor id="z" frame={frame} panels={panels} /></div>);
    const root = container.querySelector('.milspec-armor') as HTMLElement;
    const before = root.innerHTML;
    setPal('#d0d6dc');
    await act(async () => { document.documentElement.classList.add('light'); await Promise.resolve(); });
    expect(root.innerHTML).not.toBe(before);
  });

  it('共通 defs は 2 つ描いても 1 つ', () => {
    render(<div><MilspecArmor id="a" frame={frame} panels={panels} /><MilspecArmor id="b" frame={frame} panels={panels} /></div>);
    expect(document.querySelectorAll('svg#milspec-armor-defs')).toHaveLength(1);
  });

  it('中身が同じ配列を渡し直しても描き直さず、変われば描き直す', () => {
    const clone = (): PlacedPanel[] => JSON.parse(JSON.stringify(panels));
    const { container, rerender } = render(<div><MilspecArmor id="z" frame={{ ...frame }} panels={clone()} /></div>);
    const first = container.querySelector('svg.milspec-armor-panel');
    rerender(<div><MilspecArmor id="z" frame={{ ...frame }} panels={clone()} /></div>);
    expect(container.querySelector('svg.milspec-armor-panel')).toBe(first);
    const changed = clone();
    changed[0].spec.pts[1] = [200, 0];
    rerender(<div><MilspecArmor id="z" frame={{ ...frame }} panels={changed} /></div>);
    expect(container.querySelector('svg.milspec-armor-panel')).not.toBe(first);
  });

  it('枠の大きさは border-box を優先して使う', () => {
    const { container } = render(<div><MilspecArmor id="z" frame={frame} panels={panels} /></div>);
    act(() => { roCbs.forEach((cb) => (cb as (e: unknown[]) => void)([{ contentRect: { width: 280, height: 122 }, borderBoxSize: [{ inlineSize: 300, blockSize: 122 }] }])); });
    expect(container.querySelector('.milspec-armor')?.innerHTML).toContain('258,');
  });

  it('アンマウントで ResizeObserver と MutationObserver を止める', () => {
    const rd = vi.fn(), md = vi.fn();
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() { rd(); } });
    vi.stubGlobal('MutationObserver', class { observe() {} disconnect() { md(); } });
    const { unmount } = render(<div><MilspecArmor id="z" frame={frame} panels={panels} /></div>);
    unmount();
    expect(rd).toHaveBeenCalled();
    expect(md).toHaveBeenCalled();
  });
});
