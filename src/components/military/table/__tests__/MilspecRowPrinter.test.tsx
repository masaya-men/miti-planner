// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

const state = { currentPlanId: 'a', plans: [{ id: 'a', contentId: 'c1' }, { id: 'b', contentId: 'c1' }] };
const listeners = new Set<() => void>();
vi.mock('../../../../store/usePlanStore', async () => {
  const React = await import('react');
  return { usePlanStore: (sel: (s: typeof state) => unknown) => {
    const [, force] = React.useReducer((x: number) => x + 1, 0);
    React.useEffect(() => { listeners.add(force as never); return () => { listeners.delete(force as never); }; }, []);
    return sel(state);
  } };
});
const printRows = vi.fn();
const cancelPrintRows = vi.fn();
vi.mock('../printRows', () => ({ printRows: (...a: unknown[]) => printRows(...a), cancelPrintRows: (...a: unknown[]) => cancelPrintRows(...a) }));

import { MilspecRowPrinter } from '../MilspecRowPrinter';

const emit = (st: string, reduced = false) =>
  window.dispatchEvent(new CustomEvent('milspec:power', { detail: { state: st, reduced } }));

describe('MilspecRowPrinter', () => {
  let el: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    el = document.createElement('div');
    state.currentPlanId = 'a'; state.plans[0].contentId = 'c1'; printRows.mockClear(); cancelPrintRows.mockClear();
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const mount = () => render(<MilspecRowPrinter scrollRef={{ current: el }} />);

  it('最初の表示では描かない', () => {
    mount(); act(() => { vi.runAllTimers(); });
    expect(printRows).not.toHaveBeenCalled();
  });
  it('電源 on で 620・off と reduced では何もしない', () => {
    mount();
    act(() => { emit('off'); emit('on', true); vi.runAllTimers(); });
    expect(printRows).not.toHaveBeenCalled();
    act(() => { emit('on'); vi.runAllTimers(); });
    expect(printRows).toHaveBeenCalledWith(el, 620);
  });
  it('プラン切替 200', () => {
    mount();
    state.currentPlanId = 'b';
    act(() => { listeners.forEach((f) => f()); }); act(() => { vi.runAllTimers(); });
    expect(printRows).toHaveBeenLastCalledWith(el, 200);
  });
  it('コンテンツ切替 160', () => {
    mount();
    state.plans[0].contentId = 'c2';
    act(() => { listeners.forEach((f) => f()); }); act(() => { vi.runAllTimers(); });
    expect(printRows).toHaveBeenLastCalledWith(el, 160);
  });
  it('アンマウントで待機中の描き込みを消す', () => {
    const { unmount } = mount();
    act(() => { emit('on'); });
    unmount(); act(() => { vi.runAllTimers(); });
    expect(printRows).not.toHaveBeenCalled();
  });
  it('アンマウントで走っている描き込みを片付ける', () => {
    const { unmount } = mount();
    unmount();
    expect(cancelPrintRows).toHaveBeenCalledWith(el);
  });
});
