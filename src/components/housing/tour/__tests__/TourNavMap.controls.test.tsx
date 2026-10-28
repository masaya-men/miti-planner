// @vitest-environment happy-dom
/**
 * TourNavMap: ホイールズーム・「全体に戻す」・起点ラベル・ヒント/コンパス・行き方帯の表示。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import '../../../../i18n';
import type { TourMapModel } from '../../../../lib/housing/buildTourMapPlacements';
import { TourNavMap } from '../TourNavMap';

const model: TourMapModel = { target: { x: 100, y: 100 }, placed: [], routePath: 'M10 10 L100 100', routeJumpPath: null, origin: { x: 10, y: 10 }, originName: 'ミスト・ヴィレッジ', targetElId: 'plot_6', targetOutline: null };
const svg = '<svg><path id="plot_6" /></svg>';
const vb = { w: 1000, h: 800 };

let roCallback: ResizeObserverCallback | null = null;
let origRO: unknown;

beforeEach(() => {
  vi.useFakeTimers();
  roCallback = null;
  origRO = (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) { roCallback = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = origRO;
});

const fireResize = () => {
  act(() => {
    roCallback?.([{ contentRect: { width: 800, height: 600 } } as unknown as ResizeObserverEntry], {} as ResizeObserver);
  });
};
const zoomEl = (c: HTMLElement) => c.querySelector('.housing-map-zoom') as HTMLElement;

describe('TourNavMap — 操作と補助表示', () => {
  it('ホイールで拡大縮小され、ブラウザ標準のスクロールは止められる', () => {
    const { container } = render(<TourNavMap status="ready" svg={svg} viewBox={vb} model={model} stepKey={0} />);
    const before = zoomEl(container).style.transform;
    const wrap = container.querySelector('.housing-tour-map-wrap') as HTMLElement;
    let prevented = false;
    act(() => {
      const e = new WheelEvent('wheel', { deltaY: -100, clientX: 10, clientY: 10, cancelable: true, bubbles: true });
      wrap.dispatchEvent(e);
      prevented = e.defaultPrevented;
    });
    expect(prevented).toBe(true);
    expect(zoomEl(container).style.transform).not.toBe(before);
  });

  it('「全体に戻す」を押すとホイールで変えた表示が既定のフィットに戻る', () => {
    const { container } = render(<TourNavMap status="ready" svg={svg} viewBox={vb} model={model} stepKey={0} />);
    fireResize();
    act(() => { vi.advanceTimersByTime(3000); });
    const fitted = zoomEl(container).style.transform;
    const wrap = container.querySelector('.housing-tour-map-wrap') as HTMLElement;
    act(() => {
      wrap.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, clientX: 50, clientY: 50, cancelable: true, bubbles: true }));
    });
    expect(zoomEl(container).style.transform).not.toBe(fitted);
    fireEvent.click(container.querySelector('[data-testid="tour-map-reset"]') as HTMLElement);
    expect(zoomEl(container).style.transform).toBe(fitted);
  });

  it('起点エーテライトのラベルは演出が終わってから出る', () => {
    const { container } = render(<TourNavMap status="ready" svg={svg} viewBox={vb} model={model} stepKey={0} originName="ミスト・ヴィレッジ" />);
    fireResize();
    expect(container.querySelector('[data-testid="tour-map-aetheryte-label"]')).toBeNull();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(container.querySelector('[data-testid="tour-map-aetheryte-label"]')).not.toBeNull();
  });

  it('地図があるときはヒントとコンパスを出し、無いときは出さない', () => {
    const a = render(<TourNavMap status="ready" svg={svg} viewBox={vb} model={model} stepKey={0} />);
    expect(a.container.querySelector('[data-testid="tour-map-hint"]')).not.toBeNull();
    expect(a.container.querySelector('[data-testid="tour-map-compass"]')).not.toBeNull();
    a.unmount();
    const b = render(<TourNavMap status="none" svg={null} viewBox={null} model={null} stepKey={0} />);
    expect(b.container.querySelector('[data-testid="tour-map-hint"]')).toBeNull();
    expect(b.container.querySelector('[data-testid="tour-map-compass"]')).toBeNull();
    expect(b.container.querySelector('[data-testid="tour-map-reset"]')).toBeNull();
  });

  it('行き方の帯: footerDirections と inviteHint を出し分ける', () => {
    const a = render(<TourNavMap status="none" svg={null} viewBox={null} model={null} stepKey={0} footerDirections={{ teleport: 'TP先', directions: '北へ進む' }} inviteHint="招待のヒント" />);
    expect(a.container.querySelector('.housing-tour-map-directions-teleport')?.textContent).toBe('TP先');
    expect(a.container.querySelector('.housing-tour-map-directions-body')?.textContent).toBe('北へ進む');
    expect(a.container.querySelector('[data-testid="tour-map-invite-hint"]')?.textContent).toBe('招待のヒント');
    a.unmount();
    const b = render(<TourNavMap status="none" svg={null} viewBox={null} model={null} stepKey={0} />);
    expect(b.container.querySelector('[data-testid="tour-map-footer-directions"]')).toBeNull();
  });
});
