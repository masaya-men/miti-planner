// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecBackdropVideo } from '../MilspecBackdropVideo';

let reduce = false;
beforeEach(() => {
  reduce = false;
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? reduce : false,
    media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });

const setHidden = (h: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, value: h });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('MilspecBackdropVideo', () => {
  it('webm → mp4 の順に source を持ち、muted/loop/playsInline/poster 付きの video を描画する', () => {
    const { container } = render(<MilspecBackdropVideo />);
    const root = container.querySelector('[data-ms-backdrop]')!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    const v = root.querySelector('video')!;
    expect(v.muted).toBe(true);
    expect(v.loop).toBe(true);
    expect(v.hasAttribute('playsinline')).toBe(true);
    expect(v.getAttribute('poster')).toMatch(/wall-poster.*\.webp/);
    const types = [...v.querySelectorAll('source')].map((s) => s.getAttribute('type'));
    expect(types).toEqual(['video/webm', 'video/mp4']);
    expect(root.querySelector('.milspec-backdrop-veil')).not.toBeNull();
  });

  it('タブ非表示で pause、再表示で play する', () => {
    render(<MilspecBackdropVideo />);
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    pause.mockClear(); play.mockClear();
    setHidden(true);
    expect(pause).toHaveBeenCalled();
    setHidden(false);
    expect(play).toHaveBeenCalled();
  });

  it('動きを減らす設定では autoplay せず pause し、再表示でも play しない', () => {
    reduce = true;
    const { container } = render(<MilspecBackdropVideo />);
    const v = container.querySelector('video')!;
    expect(v.autoplay).toBe(false);
    expect(vi.mocked(HTMLMediaElement.prototype.pause)).toHaveBeenCalled();
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    play.mockClear();
    setHidden(true); setHidden(false);
    expect(play).not.toHaveBeenCalled();
  });
});
