// @vitest-environment happy-dom
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HousingCardMarqueeLine } from '../HousingCardMarqueeLine';

// ResizeObserver を差し替えて、通知 (幅) をテストから送る。
type Cb = (entries: { contentRect: { width: number } }[]) => void;
let notify: Cb | null = null;
class FakeResizeObserver {
  constructor(cb: Cb) {
    notify = cb;
  }
  observe() {}
  disconnect() {}
}

describe('HousingCardMarqueeLine', () => {
  const widthReads = vi.fn();
  beforeEach(() => {
    notify = null;
    widthReads.mockClear();
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    // テキスト本体 300px / 本体+間隔 340px / 表示枠 200px = 見切れている
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      widthReads();
      return this.tagName === 'SPAN' ? 300 : 340;
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => 200);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('マウント直後には幅を読まない (配置計算のやり直しを起こさない)', () => {
    render(<HousingCardMarqueeLine>とても長いハウジングのタイトル</HousingCardMarqueeLine>);
    expect(widthReads).not.toHaveBeenCalled();
  });

  it('幅 0 の通知 (画面外で配置が省略されたカード) では測らない', () => {
    const { container } = render(<HousingCardMarqueeLine>とても長いハウジングのタイトル</HousingCardMarqueeLine>);
    act(() => notify?.([{ contentRect: { width: 0 } }]));
    expect(widthReads).not.toHaveBeenCalled();
    expect(container.querySelector('[data-clipped]')).toBeNull();
  });

  it('幅のある通知で測り、見切れていれば data-clipped が付く', () => {
    const { container } = render(<HousingCardMarqueeLine>とても長いハウジングのタイトル</HousingCardMarqueeLine>);
    act(() => notify?.([{ contentRect: { width: 200 } }]));
    expect(widthReads).toHaveBeenCalled();
    expect(container.querySelector('[data-clipped]')).not.toBeNull();
  });
});
