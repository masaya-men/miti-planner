// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AllmarksWaveLoader } from '../AllmarksWaveLoader';

function mockReducedMotion(matches: boolean): () => void {
  const original = window.matchMedia;
  (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
    matches: query.includes('reduce') ? matches : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList);
  return () => {
    window.matchMedia = original;
  };
}

describe('AllmarksWaveLoader (2026-08-19 Allmarksまとめてインポート演出、ユーザー提供デザイン移植)', () => {
  it('15本のバー・ボール・家アイコンを描画する', () => {
    const { container } = render(<AllmarksWaveLoader />);
    expect(container.querySelectorAll('.housing-allmarks-wave-bar-wrap')).toHaveLength(15);
    expect(container.querySelector('.housing-allmarks-wave-ball')).not.toBeNull();
    expect(container.querySelector('.housing-allmarks-wave-house')).not.toBeNull();
  });

  it('prefers-reduced-motion のときは静止表示 (バーは基準の高さ・不透明度0)', () => {
    const restore = mockReducedMotion(true);
    const { container } = render(<AllmarksWaveLoader />);
    const glow = container.querySelector('.housing-allmarks-wave-bar-glow') as HTMLElement;
    expect(glow.style.opacity).toBe('0');
    expect(glow.style.height).toBe('16px');
    restore();
  });

  it('通常時は静止スタイルを付けない(framer-motionのanimateに任せる)', () => {
    const { container } = render(<AllmarksWaveLoader />);
    const glow = container.querySelector('.housing-allmarks-wave-bar-glow') as HTMLElement;
    // reduced-motion用の固定 height/opacity を付けていないこと(animate中はframer-motionが制御)。
    expect(glow.style.height).not.toBe('16px');
  });
});
