// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { act } from '@testing-library/react';
import { AllmarksFallingHouses } from '../AllmarksFallingHouses';
import { MIN_HOUSES, MAX_HOUSES, phaseDurationMs } from '../../../../lib/housing/fallingHousesCycle';

describe('AllmarksFallingHouses (2026-08-19 Allmarksまとめてインポート演出)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('家アイコンを4〜6個描画する', () => {
    const { container } = render(<AllmarksFallingHouses />);
    const houses = container.querySelectorAll('.housing-allmarks-falling-houses-house');
    expect(houses.length).toBeGreaterThanOrEqual(MIN_HOUSES);
    expect(houses.length).toBeLessThanOrEqual(MAX_HOUSES);
  });

  it('falling フェーズ中は道(path)を描画しない', () => {
    const { container } = render(<AllmarksFallingHouses />);
    expect(container.querySelector('.housing-allmarks-falling-houses-path')).toBeNull();
  });

  it('path フェーズに進むと道を描画する', () => {
    const { container } = render(<AllmarksFallingHouses />);
    const houseCount = container.querySelectorAll('.housing-allmarks-falling-houses-house').length;
    act(() => {
      vi.advanceTimersByTime(phaseDurationMs('falling', houseCount) + 10);
    });
    expect(container.querySelector('.housing-allmarks-falling-houses-path')).not.toBeNull();
  });

  it('walking フェーズでは光の粒(traveler)も描画する', () => {
    const { container } = render(<AllmarksFallingHouses />);
    const houseCount = container.querySelectorAll('.housing-allmarks-falling-houses-house').length;
    act(() => {
      vi.advanceTimersByTime(
        phaseDurationMs('falling', houseCount) + phaseDurationMs('path', houseCount) + 10,
      );
    });
    expect(container.querySelector('.housing-allmarks-falling-houses-traveler')).not.toBeNull();
  });

  it('prefers-reduced-motion のときは道を含めて静止表示し、フェードクラスも付かない', () => {
    const originalMatchMedia = window.matchMedia;
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);

    const { container } = render(<AllmarksFallingHouses />);
    expect(container.querySelector('.housing-allmarks-falling-houses-path')).not.toBeNull();
    expect(container.querySelector('.housing-allmarks-falling-houses-house-fall')).toBeNull();
    expect(container.querySelector('.housing-allmarks-falling-houses-fading')).toBeNull();

    window.matchMedia = originalMatchMedia;
  });
});
