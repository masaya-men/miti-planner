// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { LiquidGlassPanel } from '../../components/housing/workspace/LiquidGlassPanel';

// 変位マップ生成はコスト源。生成回数をカウントできるようモック化する
// (このファイル内でのみ有効・他テストの module registry には影響しない)。
vi.mock('../../lib/housing/displacementMap', () => ({
  makeDisplacementMapDataURL: vi.fn(() => 'data:image/png;base64,dummy'),
}));
import { makeDisplacementMapDataURL } from '../../lib/housing/displacementMap';
const genMock = makeDisplacementMapDataURL as unknown as ReturnType<typeof vi.fn>;

// happy-dom が ResizeObserver を持たない場合に備えてポリフィル
beforeAll(() => {
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe('LiquidGlassPanel', () => {
  it('renders children inside a positioned wrapper', () => {
    const { getByText } = render(
      <LiquidGlassPanel edge={50} radius={12} scale={49} chroma={0}>
        <span>inner</span>
      </LiquidGlassPanel>
    );
    expect(getByText('inner')).toBeInTheDocument();
  });

  it('exposes a filter id attribute on the wrapper', () => {
    const { container } = render(
      <LiquidGlassPanel edge={50} radius={12} scale={49}>
        <span>x</span>
      </LiquidGlassPanel>
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-liquid-filter-id')).toMatch(/^liquid-/);
  });

  it('injects an SVG filter element with feImage + feDisplacementMap', () => {
    const { container } = render(
      <LiquidGlassPanel edge={50} radius={12} scale={49}>
        <span>x</span>
      </LiquidGlassPanel>
    );
    // Wait for ResizeObserver to fire — synchronous in jsdom mock?
    // We at least check the SVG defs container exists.
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});

/**
 * 回帰防止: 建物タイプ切替などで条件フィールドが 300ms かけて max-height アニメすると、
 * パネル高さが毎フレーム変わり ResizeObserver が連続発火する。変位マップをその都度
 * 同期再生成すると「はげしくがたつく」(2026-07-13 実機 FB)。
 * → リサイズが落ち着いてから 1 回だけ再生成する (デバウンス) ことを担保する。
 */
describe('LiquidGlassPanel resize coalescing (がたつき回帰防止)', () => {
  let roCallback: ResizeObserverCallback | null = null;
  let origRO: unknown;
  let gbcrSpy: ReturnType<typeof vi.spyOn>;
  let heightSeq = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    roCallback = null;
    origRO = (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        roCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    // max-height アニメでパネルが伸びていく様子を模擬 (呼ぶたび高さが増える →
    // 「寸法不変ならスキップ」ガードに頼らず、純粋にデバウンス挙動を検証する)。
    heightSeq = 100;
    gbcrSpy = vi
      .spyOn(HTMLDivElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function () {
        heightSeq += 40;
        return {
          width: 300,
          height: heightSeq,
          top: 0,
          left: 0,
          right: 300,
          bottom: heightSeq,
          x: 0,
          y: 0,
          toJSON() {},
        } as DOMRect;
      });
    genMock.mockClear();
  });

  afterEach(() => {
    gbcrSpy.mockRestore();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = origRO;
  });

  it('regenerates the displacement map once after a burst of resizes settles, not once per callback', () => {
    render(
      <LiquidGlassPanel edge={50} radius={12} scale={49}>
        <span>x</span>
      </LiquidGlassPanel>
    );
    // マウント時の初回生成はカウント対象外にする。
    genMock.mockClear();

    // アニメーション中を模擬して resize を連続発火。
    for (let i = 0; i < 6; i++) roCallback?.([], {} as ResizeObserver);

    // デバウンス確定前は 1 度も再生成されない (現行コードはここで 6 回呼ぶので落ちる)。
    expect(genMock).not.toHaveBeenCalled();

    // 落ち着いたら 1 回だけ再生成される。
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(genMock).toHaveBeenCalledTimes(1);
  });
});
