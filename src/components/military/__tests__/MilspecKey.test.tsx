// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { fireEvent } from '@testing-library/react';
import { MilspecKey, MilspecKeyCap } from '../MilspecKey';
import { hitPolygon } from '../milspecKeyGeometry';
import type { CapSpec } from '../armor/types';

const cap: CapSpec = { pts: [[10, 10], [60, 10], [60, 30], [10, 30]], lip: true };

const stubMatchMedia = (reduce: boolean) => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
};

let animate: ReturnType<typeof vi.fn>;
beforeEach(() => {
  stubMatchMedia(false);
  animate = vi.fn(() => ({ cancel: () => {}, onfinish: null }));
  (Element.prototype as unknown as { animate: unknown }).animate = animate;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as unknown as { animate?: unknown }).animate;
});

describe('MilspecKey', () => {
  it('button として描かれ、aria-label と aria-pressed が渡る', () => {
    render(<MilspecKey cap={cap} label="HP" aria-label="HP を選ぶ" pressed data-x="1" />);
    const b = screen.getByRole('button', { name: 'HP を選ぶ' });
    expect(b.tagName).toBe('BUTTON');
    expect(b.getAttribute('type')).toBe('button');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.getAttribute('data-x')).toBe('1');
    expect(b.classList.contains('milspec-key')).toBe(true);
    expect(b.querySelector('.milspec-key-hov .milspec-key-kf .milspec-key-cap')).not.toBeNull();
    expect(b.querySelector('.milspec-key-lb')?.textContent).toBe('HP');
    expect(b.querySelector('.milspec-key-hitz .milspec-key-hit')).not.toBeNull();
    expect(b.querySelector('.milspec-key-cap')?.innerHTML).toContain('polygon');
  });

  it('クリックと Enter / Space で onClick が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MilspecKey cap={cap} aria-label="k" onClick={onClick} />);
    const b = screen.getByRole('button');
    await user.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
    b.focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(2);
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('disabled のときは onClick が呼ばれない', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MilspecKey cap={cap} aria-label="k" onClick={onClick} disabled />);
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('押すと沈む動き(animate)が走る', async () => {
    const user = userEvent.setup();
    render(<MilspecKey cap={cap} aria-label="k" />);
    await user.click(screen.getByRole('button'));
    expect(animate).toHaveBeenCalled();
  });

  it('動きを減らす設定では押しても animate を呼ばない', async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MilspecKey cap={cap} aria-label="k" onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(animate).not.toHaveBeenCalled();
  });
});

describe('MilspecKeyCap', () => {
  it('MilspecKeyCap は button を持たず aria-hidden', () => {
    const { container } = render(<MilspecKeyCap cap={cap} label="HP" />);
    expect(container.querySelector('button')).toBeNull();
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.milspec-key-cap')?.innerHTML).toContain('polygon');
  });
});

describe('MilspecKey 追加', () => {
  const frameTransforms = (call: unknown[]) => (call[0] as Keyframe[]).map((f) => f.transform);
  const isKf = (c: unknown[]) => Array.isArray(c[0]) && (c[0] as Keyframe[]).some((f) => f.transform);

  it('通常のクリック 1 回で沈む動き 1 回 + 戻る動き 1 回だけ', async () => {
    const user = userEvent.setup();
    render(<MilspecKey cap={cap} aria-label="k" />);
    await user.click(screen.getByRole('button'));
    const calls = animate.mock.calls.filter(isKf);
    expect(calls).toHaveLength(2);
    expect(frameTransforms(calls[0])[0]).toContain('translateY(0px)');
    expect(frameTransforms(calls[1])[0]).toContain('1.45px');
  });

  it('latch キーのクリックは latch 姿勢へ戻る', async () => {
    const user = userEvent.setup();
    render(<MilspecKey cap={cap} aria-label="k" latch />);
    await user.click(screen.getByRole('button'));
    const calls = animate.mock.calls.filter(isKf);
    const last = frameTransforms(calls[calls.length - 1]);
    expect(last[last.length - 1]).toContain('0.9px');
  });

  it('latch キーの pressed が true から false になると弾かれて戻る(1 回)', () => {
    const { rerender } = render(<MilspecKey cap={cap} aria-label="k" latch pressed />);
    expect(animate.mock.calls.filter(isKf)).toHaveLength(0);
    rerender(<MilspecKey cap={cap} aria-label="k" latch pressed={false} />);
    const calls = animate.mock.calls.filter(isKf);
    expect(calls).toHaveLength(1);
    expect(frameTransforms(calls[0]).join()).toContain('-1.3px');
  });

  it('disabled になったあと再試行のタイマーが回り続けない', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<MilspecKey cap={cap} aria-label="k" />);
      const b = screen.getByRole('button');
      act(() => { b.click(); });
      rerender(<MilspecKey cap={cap} aria-label="k" disabled />);
      act(() => { vi.advanceTimersByTime(200); });
      const n = animate.mock.calls.length;
      act(() => { vi.advanceTimersByTime(1000); });
      expect(animate.mock.calls.length).toBe(n);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('MilspecKey ARIA / ref / blur', () => {
  it('role=radio は aria-checked(true/false)で aria-pressed を出さない', () => {
    const { rerender } = render(<MilspecKey cap={cap} role="radio" pressed aria-label="r" />);
    let b = screen.getByRole('radio');
    expect(b.getAttribute('aria-checked')).toBe('true');
    expect(b.hasAttribute('aria-pressed')).toBe(false);
    rerender(<MilspecKey cap={cap} role="radio" pressed={false} aria-label="r" />);
    b = screen.getByRole('radio');
    expect(b.getAttribute('aria-checked')).toBe('false');
    expect(b.hasAttribute('aria-pressed')).toBe(false);
  });
  it('既定は aria-pressed(pressed 未指定なら出さない)・data-pressed が状態を映す', () => {
    const { rerender } = render(<MilspecKey cap={cap} aria-label="k" pressed />);
    let b = screen.getByRole('button');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    expect(b.hasAttribute('data-pressed')).toBe(true);
    rerender(<MilspecKey cap={cap} aria-label="k" pressed={false} />);
    b = screen.getByRole('button');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(b.hasAttribute('data-pressed')).toBe(false);
    rerender(<MilspecKey cap={cap} aria-label="k" />);
    expect(screen.getByRole('button').hasAttribute('aria-pressed')).toBe(false);
  });
  it('呼び出し側の aria-* を潰さない', () => {
    render(<MilspecKey cap={cap} aria-label="k" pressed aria-pressed="mixed" />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('mixed');
  });
  it('ref は button を指し、onClick は MouseEvent を受ける', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(<MilspecKey cap={cap} aria-label="k" ref={ref} onClick={onClick} />);
    expect(ref.current).toBe(screen.getByRole('button'));
    await user.click(screen.getByRole('button'));
    expect(onClick.mock.calls[0][0].type).toBe('click');
  });
  it('押下中に blur したら沈みを戻す', () => {
    render(<MilspecKey cap={cap} aria-label="k" />);
    const b = screen.getByRole('button');
    fireEvent.pointerDown(b, { button: 0 });
    expect(b.classList.contains('milspec-key-down')).toBe(true);
    fireEvent.blur(b);
    expect(b.classList.contains('milspec-key-down')).toBe(false);
  });

  // 浮かぶものが開いている時、外側押しの仕組み(useDismissOnOutside)が click を止める
  it('キーの上で離したのに click が来なかったら(止められた)沈みを戻す', () => {
    vi.useFakeTimers();
    try {
      render(<MilspecKey cap={cap} aria-label="k" />);
      const b = screen.getByRole('button');
      fireEvent.pointerDown(b, { button: 0 });
      fireEvent.pointerUp(b, { button: 0 });
      act(() => { vi.runAllTimers(); });
      expect(b.classList.contains('milspec-key-down')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});


describe('標準部品のボタンの中の MilspecKeyCap', () => {
  it('祖先の button を押すと kf 層が animate され、離すと戻る', () => {
    render(<button type="button" aria-label="host"><MilspecKeyCap cap={cap} label="X" /></button>);
    const b = screen.getByRole('button', { name: 'host' });
    fireEvent.pointerDown(b, { button: 0 });
    // kf 層(+ 影の .sh)が animate される
    expect(animate.mock.contexts.some((c) => (c as HTMLElement).classList.contains('milspec-key-kf'))).toBe(true);
    expect(b.classList.contains('milspec-key-down')).toBe(true);
    const n = animate.mock.calls.length;
    fireEvent.click(b);
    expect(animate.mock.calls.length).toBeGreaterThan(n);
    expect(b.classList.contains('milspec-key-down')).toBe(false);
  });

  it('button が無くても壊れない(見た目だけ)', () => {
    const { container } = render(<MilspecKeyCap cap={cap} label="X" />);
    expect(container.querySelector('.milspec-key-static')).not.toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });

  it('active で milspec-key-active が付く', () => {
    const { container, rerender } = render(<button type="button"><MilspecKeyCap cap={cap} /></button>);
    expect(container.querySelector('.milspec-key-active')).toBeNull();
    rerender(<button type="button"><MilspecKeyCap cap={cap} active /></button>);
    expect(container.querySelector('.milspec-key-active')).not.toBeNull();
  });
});

describe('hitPolygon', () => {
  it('bbox 原点基準の polygon(px 付き・カンマ区切り)を返す', () => {
    const s = hitPolygon(cap);
    expect(s).toMatch(/^polygon\((-?[\d.]+px -?[\d.]+px)(, -?[\d.]+px -?[\d.]+px){3}\)$/);
    // offsetPoly(pts, -0.8) の値をそのまま bbox 原点へ(MilspecKey の hit と同じ符号)
    expect(s).toContain('polygon(-0.8px -0.8px, 50.8px -0.8px');
  });
});
