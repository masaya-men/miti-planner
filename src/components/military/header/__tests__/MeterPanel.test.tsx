// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { MeterPanel } from '../MeterPanel';
import { syncLampState, dtgOf } from '../meterPanelModel';
import { usePlanStore } from '../../../../store/usePlanStore';
import { useAuthStore } from '../../../../store/useAuthStore';
import i18n from '../../../../i18n';
import { powerOn, powerOff, initPower, disposePower } from '../../power/power';

const fx = vi.hoisted(() => ({ listener: null as (() => void) | null, pulse: vi.fn() }));
vi.mock('../../fx/engine', () => ({
  pulse: fx.pulse,
  burst: vi.fn(), coreFire: vi.fn(), trafficBp: vi.fn(), scanBall: vi.fn(),
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
  beforeEach(async () => {
    await i18n.changeLanguage('ja');
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
    expect(container.textContent).toContain('DTG');
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

  it('ドラム時計(DTG): 今の日時 DDHHMM + 月 + 曜日。分が変わるときだけ値が変わる', () => {
    vi.setSystemTime(new Date(2026, 9, 21, 14, 5, 30));
    const { container } = render(<MeterPanel ix={518} iw={310} showClock />);
    expect(drums(container)).toEqual(['2', '1', '1', '4', '0', '5']);
    expect(container.querySelector('.milspec-dtg-mon')?.textContent).toBe('OCT');
    expect(container.querySelector('.milspec-dtg-dow')?.textContent).toBe('WED');
    expect(container.querySelector('.milspec-colon')).toBeNull();
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(drums(container).join('')).toBe('211405');
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(drums(container).join('')).toBe('211406');
    expect(container.querySelectorAll('.milspec-dr i span').length).toBe(60);
  });

  it('時計はタブ非表示で止まり、戻ったら現在値に合わせる', () => {
    vi.setSystemTime(new Date(2026, 9, 21, 14, 5, 0));
    const { container } = render(<MeterPanel ix={518} iw={310} showClock />);
    const setHidden = (v: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    act(() => setHidden(true));
    act(() => { vi.advanceTimersByTime(125_000); });
    expect(drums(container).join('')).toBe('211405'); // 止まっている
    act(() => setHidden(false));
    expect(drums(container).join('')).toBe('211407'); // 現在値に合った
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('showClock が false なら時計と MSN CLOCK を出さない', () => {
    const { container } = render(<MeterPanel ix={518} iw={250} showClock={false} />);
    expect(container.querySelector('.milspec-drums')).toBeNull();
    expect(container.textContent).not.toContain('DTG');
  });
});

describe('dtgOf(日時 → 桁・月・曜日)', () => {
  it('2026-10-21 14:05 → [2,1,1,4,0,5] OCT WED / 日付・月の変わり目 / 曜日', () => {
    expect(dtgOf(new Date(2026, 9, 21, 14, 5))).toEqual({ digits: [2, 1, 1, 4, 0, 5], month: 'OCT', dow: 'WED' });
    expect(dtgOf(new Date(2026, 9, 20, 0, 0))).toEqual({ digits: [2, 0, 0, 0, 0, 0], month: 'OCT', dow: 'TUE' });
    expect(dtgOf(new Date(2026, 9, 31, 23, 59))).toEqual({ digits: [3, 1, 2, 3, 5, 9], month: 'OCT', dow: 'SAT' });
    expect(dtgOf(new Date(2026, 10, 1, 0, 0))).toEqual({ digits: [0, 1, 0, 0, 0, 0], month: 'NOV', dow: 'SUN' });
    expect(dtgOf(new Date(2027, 0, 1, 9, 7))).toEqual({ digits: [0, 1, 0, 9, 0, 7], month: 'JAN', dow: 'FRI' });
  });
});

describe('MeterPanel 電源投入の演出', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ja');
    vi.useFakeTimers();
    setUser(null);
    usePlanStore.setState({ _cloudStatus: 'idle', _dirtyPlanIds: new Set(), _deletedPlanIds: new Set() });
    initPower();
  });
  afterEach(() => { disposePower(); vi.useRealTimers(); });

  it('時計: 0 から始まり 380ms 後に桁ごとの transition で現在値へ、2200ms 後に戻す', () => {
    const { container } = render(<MeterPanel ix={518} iw={310} showClock />);
    act(() => { powerOn({ reduced: false }); });
    const is = () => [...container.querySelectorAll<HTMLElement>('.milspec-dr i')];
    expect(is().every((i) => i.style.transition.includes('none'))).toBe(true);
    act(() => { vi.advanceTimersByTime(379); });
    expect(drums(container)).toEqual(['0', '0', '0', '0', '0', '0']);
    act(() => { vi.advanceTimersByTime(1); });
    expect(is()[0].style.transition).toContain('1.1s');
    expect(is()[5].style.transition).toContain('1.7');
    act(() => { vi.advanceTimersByTime(2200); });
    expect(is().every((i) => i.style.transition === '')).toBe(true);
  });

  it('タービン: 電源投入の 1000ms 後に TRB が自動で押される', () => {
    const { container } = render(<MeterPanel ix={518} iw={310} showClock />);
    const trb = () => container.querySelector('.milspec-tsw') as HTMLButtonElement;
    act(() => { powerOn({ reduced: false }); });
    act(() => { vi.advanceTimersByTime(999); });
    expect(trb().disabled).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(trb().disabled).toBe(true);
  });

  it('動きを減らす場合は TRB を押さない / 電源断で時計は 0 に戻る', () => {
    const { container } = render(<MeterPanel ix={518} iw={310} showClock />);
    act(() => { powerOn({ reduced: true }); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect((container.querySelector('.milspec-tsw') as HTMLButtonElement).disabled).toBe(false);
    expect(drums(container).join('')).not.toBe('000000');
    act(() => { void powerOff({ reduced: true }); });
    expect(drums(container)).toEqual(['0', '0', '0', '0', '0', '0']);
  });
});
