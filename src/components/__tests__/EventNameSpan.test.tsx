// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { EventNameSpan } from '../EventNameSpan';

// Tooltip は内部で hover state のみ。描画に影響しないので素通しモック。
vi.mock('../ui/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

afterEach(() => cleanup());

/** ResizeObserver をモックしコールバックを捕捉。指定 DOM 寸法で再計測を発火させる。 */
function setup(name: string, textWidth: number, clipWidth: number) {
  const callbacks: ResizeObserverCallback[] = [];
  (global as any).ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) { callbacks.push(cb); }
    observe() {}
    disconnect() {}
  };
  const { container } = render(<EventNameSpan name={name} />);
  const clip = container.querySelector('.lopo-name-clip') as HTMLElement;
  const text = container.querySelector('.lopo-name-text') as HTMLElement;
  Object.defineProperty(text, 'scrollWidth', { configurable: true, value: textWidth });
  Object.defineProperty(clip, 'clientWidth', { configurable: true, value: clipWidth });
  act(() => callbacks[0]?.([], {} as ResizeObserver));
  return { clip, text };
}

describe('EventNameSpan', () => {
  it('二層構造で名前を描画する', () => {
    const { clip, text } = setup('ヴァーティカル', 50, 100);
    expect(clip).toBeTruthy();
    expect(text.textContent).toBe('ヴァーティカル');
  });

  it('見切れていない → data-clipped 無し・CSS変数無し', () => {
    const { clip } = setup('短い', 50, 100);
    expect(clip.hasAttribute('data-clipped')).toBe(false);
    expect(clip.style.getPropertyValue('--marquee-distance')).toBe('');
  });

  it('見切れている → data-clipped 付与・CSS変数(距離/時間)を設定', () => {
    const { clip } = setup('とても長い攻撃名ホリゾンタルクロス', 200, 100);
    expect(clip.hasAttribute('data-clipped')).toBe(true);
    expect(clip.style.getPropertyValue('--marquee-distance')).toBe('-100px');
    // overflow=100 → durationSec=7.14
    expect(clip.style.getPropertyValue('--marquee-duration')).toBe('7.14s');
  });
});
