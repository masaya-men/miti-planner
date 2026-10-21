// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Nameplate } from '../Nameplate';

let reduced = false;
vi.mock('../../../../lib/housing/useReducedMotion', () => ({ useReducedMotion: () => reduced }));

const ttl = (c: HTMLElement) => c.querySelector('.milspec-np-ttl') as HTMLElement;
const sub = (c: HTMLElement) => c.querySelector('.milspec-np-sub') as HTMLElement;
const flush = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('Nameplate', () => {
  beforeEach(() => { vi.useFakeTimers(); reduced = false; });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('初回表示はそのまま文字を出す(パタパタしない)・読み上げ用の文字も持つ', () => {
    const { container } = render(<Nameplate title="絶バハムート" sub="固定" />);
    expect(ttl(container).textContent).toBe('絶バハムート');
    expect(ttl(container).querySelector('i')).toBeNull();
    expect(container.querySelector('.milspec-sr')?.textContent).toContain('絶バハムート');
  });

  it('<b>x</b> のような文字列はタグにならず、文字として出る', async () => {
    const { container, rerender } = render(<Nameplate title="AB" sub="x" />);
    rerender(<Nameplate title="<b>x</b>" sub="x" />);
    await flush(0);
    expect(ttl(container).querySelector('b')).toBeNull();
    await flush(2000);
    expect(ttl(container).textContent).toBe('<b>x</b>');
  });

  it('title が変わると 1 文字ずつ <i> になり、最後は正しい文字列(sub は変わらない)', async () => {
    const { container, rerender } = render(<Nameplate title="AB" sub="x" />);
    rerender(<Nameplate title="零式 1" sub="x" />);
    await flush(0);
    expect(ttl(container).querySelectorAll('i').length).toBe(4);
    expect(sub(container).querySelector('i')).toBeNull();
    await flush(2000);
    const text = [...ttl(container).querySelectorAll('i')].map((c) => c.textContent).join('').replace(/ /g, ' ');
    expect(text).toBe('零式 1');
    expect(ttl(container).querySelectorAll('i.s').length).toBe(4);
  });

  it('sub は 120ms 遅れて始まる', async () => {
    const { container, rerender } = render(<Nameplate title="A" sub="x" />);
    rerender(<Nameplate title="A" sub="yz" />);
    await flush(0);
    await flush(100);
    expect([...sub(container).querySelectorAll('i')].every((c) => c.textContent === '')).toBe(true);
    await flush(30);
    expect(sub(container).querySelector('i')?.textContent).not.toBe('');
  });

  it('アンマウントでタイマーが全部止まる', async () => {
    const { rerender, unmount } = render(<Nameplate title="A" sub="x" />);
    rerender(<Nameplate title="BCD" sub="yz" />);
    await flush(0);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('動きを減らすなら即時に文字が入れ替わる', () => {
    reduced = true;
    const { container, rerender } = render(<Nameplate title="A" sub="x" />);
    rerender(<Nameplate title="BCD" sub="yz" />);
    expect(ttl(container).textContent).toBe('BCD');
    expect(ttl(container).querySelector('i')).toBeNull();
    expect(sub(container).textContent).toBe('yz');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('SN バーコードとリベット 2 個を一緒に出す', () => {
    const { container } = render(<Nameplate title="A" sub="x" />);
    expect(container.querySelectorAll('.milspec-rivet').length).toBe(2);
    expect(container.querySelector('svg.milspec-barcode')).not.toBeNull();
    expect(container.textContent).toContain('SN 0418-7A');
  });
});
