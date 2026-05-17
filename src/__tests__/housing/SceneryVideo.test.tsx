// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
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
});
