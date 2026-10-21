// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pulse, burst, startAmbient, energy } from '../engine';

const NS = 'http://www.w3.org/2000/svg';
let animateSpy: ReturnType<typeof vi.fn>;
let finishers: { onfinish: (() => void) | null }[];

function addPath(name: string, extra: Record<string, string> = {}, svg?: Element) {
  const root = svg ?? document.querySelector('.milspec-app svg')!;
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M 0 0 L 100 0');
  p.setAttribute('data-trace', name);
  Object.entries(extra).forEach(([k, v]) => p.setAttribute(k, v));
  root.appendChild(p);
  return p;
}

beforeEach(() => {
  document.body.innerHTML = '<div class="milspec-app"><svg></svg></div>';
  delete document.documentElement.dataset.msPower;
  (SVGPathElement.prototype as unknown as { getTotalLength: () => number }).getTotalLength = () => 100;
  (SVGPathElement.prototype as unknown as { getPointAtLength: (l: number) => { x: number; y: number } }).getPointAtLength = (l) => ({ x: l, y: 0 });
  (SVGPathElement.prototype as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) });
  finishers = [];
  animateSpy = vi.fn(() => { const a = { onfinish: null as (() => void) | null, cancel() {} }; finishers.push(a); return a; });
  (Element.prototype as unknown as { animate: unknown }).animate = animateSpy;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});
afterEach(() => { vi.useRealTimers(); });

describe('光エンジン', () => {
  it('pulse は複製を 2 本足し、アニメが終わると消す', () => {
    addPath('a');
    pulse('a');
    expect(document.querySelectorAll('.milspec-pz-g').length).toBe(1);
    expect(document.querySelectorAll('.milspec-pz-c').length).toBe(1);
    finishers.forEach((f) => f.onfinish?.());
    expect(document.querySelectorAll('.milspec-pz-g,.milspec-pz-c').length).toBe(0);
  });

  it('pulse は見本と同じ dash を使う', () => {
    addPath('a');
    pulse('a', { len: 12 });
    const q = document.querySelector('.milspec-pz-g') as SVGElement;
    expect(q.style.strokeDasharray).toBe('12 136');
    expect(animateSpy.mock.calls[0][0]).toEqual([{ strokeDashoffset: 12 }, { strokeDashoffset: -100 }]);
  });

  it('名前が無い・動きを減らす・タブ非表示なら何もせず 0', () => {
    addPath('a');
    expect(pulse('none')).toBe(0);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    expect(pulse('a')).toBe(0);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    window.matchMedia = ((q: string) => ({ matches: true, media: q })) as never;
    expect(pulse('a')).toBe(0);
    expect(document.querySelectorAll('.milspec-pz-g').length).toBe(0);
  });

  it('data-trace-next があれば終点まで行った光が続きへ流れる', () => {
    vi.useFakeTimers();
    addPath('a', { 'data-trace-next': 'b' });
    addPath('b');
    const tot = pulse('a');
    expect(document.querySelectorAll('.milspec-pz-g').length).toBe(1);
    vi.advanceTimersByTime(tot * 0.8 + 5);
    expect(document.querySelectorAll('.milspec-pz-g').length).toBe(2);
  });

  it('burst は接頭辞の経路から n 本だけ流す', () => {
    ['x0', 'x1', 'x2', 'x3', 'y0'].forEach((n) => addPath(n));
    burst('x', { n: 2, stagger: 0, jit: 0 });
    expect(document.querySelectorAll('.milspec-pz-g').length).toBe(2);
  });

  it('startAmbient はタブ非表示のとき光を出さず、停止関数でタイマーが止まる', () => {
    vi.useFakeTimers();
    addPath('s1');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    const stop = startAmbient();
    vi.advanceTimersByTime(10000);
    expect(document.querySelectorAll('.milspec-pz-g').length).toBe(0);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('startAmbient は表示中なら光を出す', () => {
    vi.useFakeTimers();
    ['rail:a0', 'ventL:0', 'bp:b0', 'bp:f0', 'bp:m0', 's2L0', 's2R0', 's2T0', 's2B0', 's2k0', 's2x0', 's1', 'h3', 'h5a', 's3'].forEach((n) => addPath(n));
    const stop = startAmbient();
    vi.advanceTimersByTime(5000);
    expect(document.querySelectorAll('.milspec-pz-g').length).toBeGreaterThan(0);
    stop();
  });

  it('energy はツリー内の要素から幹線 s2k0〜s2k3 に流し、そのあと IC を光らせる', () => {
    vi.useFakeTimers();
    const svg = document.querySelector('.milspec-app svg')!;
    svg.classList.add('milspec-plan-core');
    [0, 1, 2, 3].forEach((k) => addPath('s2k' + k));
    addPath('s2L0');
    const tree = document.createElement('div');
    tree.setAttribute('data-ms-tree', '');
    const row = document.createElement('div');
    tree.appendChild(row);
    document.querySelector('.milspec-app')!.appendChild(tree);
    energy(row);
    // 幹線 s2k0〜s2k3 に複製ができ、そのあと IC 発火で s2L0 にもできる
    expect(svg.querySelectorAll('.milspec-pz-c').length).toBe(5);
    // IC の発火(coreFire)で s2L0 にも複製ができる(幹線 4 本 + s2L0 = 5)
    expect(svg.querySelectorAll('.milspec-pz-g').length).toBeGreaterThanOrEqual(5);
  });
});
