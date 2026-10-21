// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MilspecPlanCore } from '../MilspecPlanCore';

type RoCb = (e: { contentRect: { width: number; height: number } }[]) => void;
let roCbs: RoCb[] = [];
const fireRo = (height: number) =>
  act(() => { roCbs.forEach((cb) => cb([{ contentRect: { width: 249.2, height } }])); });

beforeEach(() => {
  roCbs = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: RoCb) { roCbs.push(cb); }
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('MilspecPlanCore', () => {
  it('aria-hidden で、親の高さが変わると作り直す', () => {
    const { container } = render(<div><MilspecPlanCore /></div>);
    const svg = container.querySelector('svg.milspec-pcb.milspec-plan-core') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    fireRo(451.2);
    const a = svg.innerHTML;
    fireRo(0); // 0 は無視
    expect(svg.innerHTML).toBe(a);
    fireRo(852);
    expect(svg.innerHTML).not.toBe(a);
    expect(svg.innerHTML).toContain('y="759.8"');
  });
});
