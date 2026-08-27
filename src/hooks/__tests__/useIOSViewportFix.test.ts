// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIOSViewportFix } from '../useIOSViewportFix';

/** visualViewport のモック。resize リスナーを手動発火できるようにする。 */
function mockVisualViewport(initialHeight: number) {
  let height = initialHeight;
  const listeners = new Set<() => void>();
  const vv = {
    get height() {
      return height;
    },
    addEventListener: (type: string, cb: () => void) => {
      if (type === 'resize') listeners.add(cb);
    },
    removeEventListener: (type: string, cb: () => void) => {
      if (type === 'resize') listeners.delete(cb);
    },
    /** テスト用: 高さを変えて resize を発火 */
    _emitResize(newHeight: number) {
      height = newHeight;
      listeners.forEach((cb) => cb());
    },
    _listenerCount() {
      return listeners.size;
    },
  };
  return vv;
}

describe('useIOSViewportFix', () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;
  let rafSpy: ReturnType<typeof vi.spyOn>;
  const originalVV = (window as unknown as { visualViewport?: unknown }).visualViewport;

  beforeEach(() => {
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    // requestAnimationFrame を同期実行にして documentElement.style.height の復元を確定させる
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    scrollToSpy.mockRestore();
    rafSpy.mockRestore();
    (window as unknown as { visualViewport?: unknown }).visualViewport = originalVV;
    document.documentElement.style.height = '';
  });

  it('isMobile=false のときは何もしない (リスナー登録も scrollTo もしない)', () => {
    const vv = mockVisualViewport(600);
    (window as unknown as { visualViewport: unknown }).visualViewport = vv;

    renderHook(() => useIOSViewportFix(false));

    expect(scrollToSpy).not.toHaveBeenCalled();
    expect(vv._listenerCount()).toBe(0);
  });

  it('isMobile=true でマウント直後に無条件で 1 回補正する (resize を待たない)', () => {
    const vv = mockVisualViewport(600);
    (window as unknown as { visualViewport: unknown }).visualViewport = vv;

    renderHook(() => useIOSViewportFix(true));

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(vv._listenerCount()).toBe(1);
  });

  it('高さが急に増えたら (アドレスバー引き込み) 再補正する', () => {
    const vv = mockVisualViewport(500);
    (window as unknown as { visualViewport: unknown }).visualViewport = vv;

    renderHook(() => useIOSViewportFix(true));
    scrollToSpy.mockClear();

    vv._emitResize(560); // +60 > 50 のしきい値
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it('高さの微増 (しきい値未満) では再補正しない', () => {
    const vv = mockVisualViewport(500);
    (window as unknown as { visualViewport: unknown }).visualViewport = vv;

    renderHook(() => useIOSViewportFix(true));
    scrollToSpy.mockClear();

    vv._emitResize(530); // +30 < 50
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('アンマウントで resize リスナーを解除する', () => {
    const vv = mockVisualViewport(600);
    (window as unknown as { visualViewport: unknown }).visualViewport = vv;

    const { unmount } = renderHook(() => useIOSViewportFix(true));
    expect(vv._listenerCount()).toBe(1);

    unmount();
    expect(vv._listenerCount()).toBe(0);
  });

  it('visualViewport が無い環境ではクラッシュしない', () => {
    (window as unknown as { visualViewport: unknown }).visualViewport = undefined;
    expect(() => renderHook(() => useIOSViewportFix(true))).not.toThrow();
    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});
