// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { SceneryVideo } from '../../components/housing/workspace/SceneryVideo';

// happy-dom が matchMedia を持たない場合に備えてポリフィル
beforeAll(() => {
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
  }
});

describe('SceneryVideo', () => {
  it('renders both day and night videos in the DOM', () => {
    const { container } = render(<SceneryVideo theme="light" />);
    const videos = container.querySelectorAll('video');
    expect(videos.length).toBe(2);
  });

  it('day video has data-active=true when theme=light', () => {
    const { container } = render(<SceneryVideo theme="light" />);
    const dayVideo = container.querySelector('video[data-scenery="day"]');
    expect(dayVideo?.getAttribute('data-active')).toBe('true');
  });

  it('night video has data-active=true when theme=dark', () => {
    const { container } = render(<SceneryVideo theme="dark" />);
    const nightVideo = container.querySelector('video[data-scenery="night"]');
    expect(nightVideo?.getAttribute('data-active')).toBe('true');
  });

  it('references public/housing assets', () => {
    const { container } = render(<SceneryVideo theme="light" />);
    const sources = Array.from(container.querySelectorAll('video source'));
    const paths = sources.map((s) => s.getAttribute('src'));
    expect(paths.some((p) => p?.includes('/housing/scenery-day.webm'))).toBe(true);
    expect(paths.some((p) => p?.includes('/housing/scenery-day.mp4'))).toBe(true);
    expect(paths.some((p) => p?.includes('/housing/scenery-night.webm'))).toBe(true);
    expect(paths.some((p) => p?.includes('/housing/scenery-night.mp4'))).toBe(true);
  });

  // 2026-10-26 実機報告: iPhone で自動再生が拒否されると WebKit が動画中央に再生ボタンを出す
  // (CSS の疑似要素では隠せなかった)。実際に流れている間だけ動画を見せ、それ以外は静止画。
  describe('流れている間だけ動画を見せる', () => {
    it('playing が来るまでアクティブな動画も透明', () => {
      const { container } = render(<SceneryVideo theme="light" />);
      const day = container.querySelector('video[data-scenery="day"]') as HTMLVideoElement;
      expect(day.style.opacity).toBe('0');
    });

    it('playing で見え、pause でまた透明に戻る', () => {
      const { container } = render(<SceneryVideo theme="light" />);
      const day = container.querySelector('video[data-scenery="day"]') as HTMLVideoElement;
      act(() => { day.dispatchEvent(new Event('playing')); });
      expect(day.style.opacity).toBe('1');
      act(() => { day.dispatchEvent(new Event('pause')); });
      expect(day.style.opacity).toBe('0');
    });

    it('非アクティブな動画は playing でも透明', () => {
      const { container } = render(<SceneryVideo theme="light" />);
      const night = container.querySelector('video[data-scenery="night"]') as HTMLVideoElement;
      act(() => { night.dispatchEvent(new Event('playing')); });
      expect(night.style.opacity).toBe('0');
    });

    it('動画の後ろに今のテーマの静止画を敷く', () => {
      const { container, rerender } = render(<SceneryVideo theme="light" />);
      const poster = container.querySelector('[data-scenery-poster]');
      expect(poster?.getAttribute('data-scenery-poster')).toBe('day');
      rerender(<SceneryVideo theme="dark" />);
      expect(container.querySelector('[data-scenery-poster]')?.getAttribute('data-scenery-poster')).toBe('night');
    });
  });

  // 2026-08-12 実機指摘対応: 動画が猶予時間内に描画開始しなければ自動で load() し直す自己修復。
  describe('読み込み自己修復(ウォッチドッグ)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('猶予時間内に描画開始しなければアクティブな動画だけ load() し直す', () => {
      vi.useFakeTimers();
      const { container } = render(<SceneryVideo theme="light" />);
      const day = container.querySelector('video[data-scenery="day"]') as HTMLVideoElement;
      const night = container.querySelector('video[data-scenery="night"]') as HTMLVideoElement;
      const dayLoad = vi.spyOn(day, 'load').mockImplementation(() => {});
      const nightLoad = vi.spyOn(night, 'load').mockImplementation(() => {});
      Object.defineProperty(day, 'readyState', { value: 0, configurable: true });

      vi.advanceTimersByTime(6000);

      expect(dayLoad).toHaveBeenCalledTimes(1);
      expect(nightLoad).not.toHaveBeenCalled();
    });

    it('猶予時間内にloadeddataが発火すればload()し直さない', () => {
      vi.useFakeTimers();
      const { container } = render(<SceneryVideo theme="light" />);
      const day = container.querySelector('video[data-scenery="day"]') as HTMLVideoElement;
      const dayLoad = vi.spyOn(day, 'load').mockImplementation(() => {});
      Object.defineProperty(day, 'readyState', { value: 2, configurable: true });

      day.dispatchEvent(new Event('loadeddata'));
      vi.advanceTimersByTime(6000);

      expect(dayLoad).not.toHaveBeenCalled();
    });

    it('errorイベントで即座にload()し直すが、上限(1回)を超えて再試行しない', () => {
      vi.useFakeTimers();
      const { container } = render(<SceneryVideo theme="light" />);
      const day = container.querySelector('video[data-scenery="day"]') as HTMLVideoElement;
      const dayLoad = vi.spyOn(day, 'load').mockImplementation(() => {});

      day.dispatchEvent(new Event('error'));
      day.dispatchEvent(new Event('error'));

      expect(dayLoad).toHaveBeenCalledTimes(1);
    });
  });
});
