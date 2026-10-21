// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MilspecKey, MilspecKeyCap } from '../MilspecKey';
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
