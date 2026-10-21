// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { MeterPanel, syncLampState } from '../MeterPanel';
import { usePlanStore } from '../../../../store/usePlanStore';
import { useAuthStore } from '../../../../store/useAuthStore';

const fx = vi.hoisted(() => ({ listener: null as (() => void) | null, pulse: vi.fn() }));
vi.mock('../../fx/engine', () => ({
  pulse: fx.pulse,
  setFxSignalListener: (fn: (() => void) | null) => { fx.listener = fn; },
}));

const lamp = (c: HTMLElement, id: string) => c.querySelector(`[data-lamp="${id}"] .milspec-led`) as HTMLElement;
const drums = (c: HTMLElement) => [...c.querySelectorAll('.milspec-dr i')].map((i) => (i as HTMLElement).style.getPropertyValue('--v'));
const setUser = (u: object | null) => useAuthStore.setState({ user: u as never });

describe('syncLampState(SYNC ランプの 4 状態)', () => {
  it('未ログイン = 消灯 / 保存済み = 緑 / 保存中・未保存 = 琥珀 / エラー = 赤', () => {
    expect(syncLampState({ loggedIn: false, status: 'synced', dirty: false })).toBe('off');
    expect(syncLampState({ loggedIn: true, status: 'synced', dirty: false })).toBe('on');
    expect(syncLampState({ loggedIn: true, status: 'idle', dirty: false })).toBe('on');
    expect(syncLampState({ loggedIn: true, status: 'syncing', dirty: false })).toBe('warn');
    expect(syncLampState({ loggedIn: true, status: 'synced', dirty: true })).toBe('warn');
    expect(syncLampState({ loggedIn: true, status: 'error', dirty: true })).toBe('dng');
  });
});

describe('MeterPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fx.listener = null;
    fx.pulse.mockClear();
    setUser({ uid: 'u1' });
    usePlanStore.setState({ _cloudStatus: 'synced', _dirtyPlanIds: new Set(), _deletedPlanIds: new Set() });
  });
  afterEach(() => { vi.useRealTimers(); setUser(null); });

  it('タービン 2 基・TRB ボタン・ランプ 4 個・刻印・型番を出す', () => {
    const { container, getByRole } = render(<MeterPanel ix={518} iw={310} showClock />);
    expect(container.querySelectorAll('.milspec-tpk').length).toBe(2);
    expect(getByRole('button', { name: 'タービン起動' })).toBeTruthy();
    expect(container.querySelectorAll('[data-lamp]').length).toBe(4);
    expect(container.textContent).toContain('⚠ ROTATING');
    expect(container.textContent).toContain('MSN CLOCK');
    expect(container.textContent).toContain('H3');
  });

  it('ランプ: SYS 常時点灯 / REC は琥珀の点滅 / SYNC は store に従う', () => {
    const { container } = render(<MeterPanel ix={518} iw={310} showClock />);
    expect(lamp(container, 'sys').classList.contains('is-on')).toBe(true);
    const rec = lamp(container, 'rec');
    expect(rec.classList.contains('is-warn') && rec.classList.contains('is-blink')).toBe(true);
    expect(lamp(container, 'sync').classList.contains('is-on')).toBe(true);
    act(() => usePlanStore.setState({ _cloudStatus: 'error' }));
    expect(lamp(container, 'sync').classList.contains('is-dng')).toBe(true);
    act(() => { usePlanStore.setState({ _cloudStatus: 'synced' }); setUser(null); });
    expect(lamp(container, 'sync').className).toBe('milspec-led');
  });

  it('NET ランプは信号で 60ms だけ点き、アンマウントで購読を解除する', () => {
    const { container, unmount } = render(<MeterPanel ix={518} iw={310} showClock />);
    expect(typeof fx.listener).toBe('function');
    expect(lamp(container, 'net').classList.contains('is-on')).toBe(false);
    act(() => fx.listener?.());
    expect(lamp(container, 'net').classList.contains('is-on')).toBe(true);
    act(() => { vi.advanceTimersByTime(59); });
    expect(lamp(container, 'net').classList.contains('is-on')).toBe(true);
    act(() => { vi.advanceTimersByTime(2); });
    expect(lamp(container, 'net').classList.contains('is-on')).toBe(false);
    unmount();
    expect(fx.listener).toBeNull();
  });

  it('TRB で起動: TRB ランプが琥珀に点き、h3 の継ぎ目へ琥珀の光が拍動する', () => {
    const { container, getByRole } = render(<MeterPanel ix={518} iw={310} showClock />);
    expect(container.querySelector('.milspec-tsw .milspec-led')?.classList.contains('is-warn')).toBe(false);
    fireEvent.click(getByRole('button', { name: 'タービン起動' }));
    expect(container.querySelector('.milspec-tsw .milspec-led')?.classList.contains('is-warn')).toBe(true);
    expect(fx.pulse).toHaveBeenCalledWith('h3', { cls: 'warn', len: 10 });
    const n = fx.pulse.mock.calls.length;
    act(() => { vi.advanceTimersByTime(640); });
    expect(fx.pulse.mock.calls.length).toBe(n + 1);
  });

  it('ドラム時計: 画面を開いてからの経過時間(61 秒で 00:01:01)', () => {
    const { container } = render(<MeterPanel ix={518} iw={310} showClock />);
    expect(drums(container)).toEqual(['0', '0', '0', '0', '0', '0']);
    act(() => { vi.advanceTimersByTime(61_000); });
    expect(drums(container)).toEqual(['0', '0', '0', '1', '0', '1']);
    expect(container.querySelectorAll('.milspec-dr i span').length).toBe(60);
  });

  it('時計はタブ非表示で止まり、戻ったら追いつく', () => {
    const { container } = render(<MeterPanel ix={518} iw={310} showClock />);
    const setHidden = (v: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    act(() => setHidden(true));
    const timers = vi.getTimerCount();
    act(() => { vi.advanceTimersByTime(125_000); });
    expect(drums(container).join('')).toBe('000000'); // 止まっている
    act(() => setHidden(false));
    expect(drums(container).join('')).toBe('000205'); // 追いついた
    expect(timers).toBeLessThan(vi.getTimerCount() + 1);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('showClock が false なら時計と MSN CLOCK を出さない', () => {
    const { container } = render(<MeterPanel ix={518} iw={250} showClock={false} />);
    expect(container.querySelector('.milspec-drums')).toBeNull();
    expect(container.textContent).not.toContain('MSN CLOCK');
  });
});
