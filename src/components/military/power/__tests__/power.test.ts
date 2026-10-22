// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const fx = vi.hoisted(() => ({ burst: vi.fn(), pulse: vi.fn(), coreFire: vi.fn(), trafficBp: vi.fn(), scanBall: vi.fn() }));
vi.mock('../../fx/engine', () => fx);

import { isPowered, powerOn, powerOff, onPower, initPower, disposePower, BOOT_TIMING } from '../power';

const zones = ['sidebar', 'rail', 'header', 'vent', 'workspace', 'footer'];
const mount = () => {
  document.body.innerHTML = '<div class="milspec-app">' + zones.map((z) => `<div data-ms-zone="${z}"><div class="milspec-dim"></div></div>`).join('') + '<div data-scan></div></div>';
};
const animSpy = () => vi.spyOn(HTMLElement.prototype as unknown as { animate: () => unknown }, 'animate').mockImplementation(() => ({}));

beforeEach(() => { vi.useFakeTimers(); mount(); Object.values(fx).forEach((f) => f.mockClear()); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); disposePower(); window.history.replaceState({}, '', '/'); });

describe('power', () => {
  it('powerOn の順: 暗転 → 暗幕 → イベント(購読者が見る時点で暗幕の animate は始まっている)', () => {
    const log: string[] = [];
    vi.spyOn(HTMLElement.prototype as unknown as { animate: () => unknown }, 'animate').mockImplementation(function (this: HTMLElement) {
      log.push(this.classList.contains('milspec-dim') ? 'dim' : this.className === 'milspec-blackout' ? 'blackout' : 'other');
      return { cancel: vi.fn() };
    });
    const off = onPower(() => log.push('event'));
    initPower();
    powerOn({ reduced: false });
    expect(log[0]).toBe('blackout');
    expect(log.indexOf('dim')).toBeGreaterThan(0);
    expect(log.indexOf('dim')).toBeLessThan(log.indexOf('event'));
    off();
  });

  it('disposePower で scanBall のタイマーが消える', () => {
    animSpy();
    initPower();
    powerOn({ reduced: false });
    disposePower();
    vi.advanceTimersByTime(3000);
    expect(fx.scanBall).not.toHaveBeenCalled();
  });

  it('initPower: 既定は off / ?noboot なら on', () => {
    initPower();
    expect(isPowered()).toBe(false);
    window.history.replaceState({}, '', '/?noboot');
    initPower();
    expect(isPowered()).toBe(true);
  });

  it('initPower: 動きを減らす設定なら最初から on', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    initPower();
    expect(isPowered()).toBe(true);
  });

  it('powerOn: 属性 on・暗転・区画の イベント・疾走・BOOT_TIMING.scan 後に scanBall', () => {
    const a = animSpy();
    const ev = vi.fn();
    const off = onPower(ev);
    initPower();
    powerOn({ reduced: false });
    expect(isPowered()).toBe(true);
    expect(document.querySelector('.milspec-blackout')).not.toBeNull();
    expect(a).toHaveBeenCalled();
    expect(ev).toHaveBeenCalledWith({ state: 'on', reduced: false });
    expect(fx.burst).toHaveBeenCalledWith('rail:a', { delay: 250, stagger: 16, speed: 1.3, chain: true });
    expect(fx.coreFire).toHaveBeenCalledWith(620);
    expect(fx.trafficBp).toHaveBeenCalledWith(560);
    expect(fx.scanBall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(BOOT_TIMING.scan - 1);
    expect(fx.scanBall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fx.scanBall).toHaveBeenCalledTimes(1);
    off();
  });

  it('powerOn(reduced): 属性 on とイベントだけ。暗転も疾走もなし', () => {
    const ev = vi.fn();
    onPower(ev);
    initPower();
    powerOn({ reduced: true });
    expect(isPowered()).toBe(true);
    expect(ev).toHaveBeenCalledWith({ state: 'on', reduced: true });
    expect(document.querySelector('.milspec-blackout')).toBeNull();
    expect(fx.burst).not.toHaveBeenCalled();
  });

  it('powerOn(reduced): 暗幕を animate しない', () => {
    const a = animSpy();
    initPower();
    powerOn({ reduced: true });
    expect(a).not.toHaveBeenCalled();
    expect(document.querySelector('.milspec-sweep')).toBeNull();
  });

  it('powerOff: 属性 off・進行中の暗幕を止める・300ms 後に解決', async () => {
    animSpy();
    powerOn({ reduced: false });
    let done = false;
    const p = powerOff({ reduced: false }).then(() => { done = true; });
    expect(isPowered()).toBe(false);
    expect(document.querySelector('.milspec-sweep')).toBeNull();
    await vi.advanceTimersByTimeAsync(299);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  it('onPower: 解除すると呼ばれない / disposePower で属性と暗転板が消える', () => {
    animSpy();
    const ev = vi.fn();
    const off = onPower(ev);
    off();
    powerOn({ reduced: false });
    expect(ev).not.toHaveBeenCalled();
    disposePower();
    expect(document.documentElement.dataset.msPower).toBeUndefined();
    expect(document.querySelector('.milspec-blackout')).toBeNull();
  });

  describe('立ち上がりの順番', () => {
    const dimAnim = (z: string) => (document.querySelector(`[data-ms-zone="${z}"] .milspec-dim`) as unknown as { animate: ReturnType<typeof vi.fn> }).animate;
    const stub = () => zones.forEach((z) => {
      (document.querySelector(`[data-ms-zone="${z}"] .milspec-dim`) as unknown as { animate: unknown }).animate = vi.fn(() => ({ cancel: vi.fn() }));
    });
    const callOf = (z: string) => dimAnim(z).mock.calls[0] as [Keyframe[], KeyframeAnimationOptions];

    it('サイドバー/レールの暗幕は上から下へ、ヘッダー/通気口/フッターは左から右へ退く', () => {
      animSpy(); stub();
      powerOn({ reduced: false });
      expect(callOf('sidebar')[1]).toMatchObject({ delay: 250, duration: 700, fill: 'backwards' });
      expect(callOf('sidebar')[0].at(-1)!.clipPath).toBe('inset(100% 0 0 0)');
      expect(callOf('header')[1]).toMatchObject({ delay: 370, duration: 700 });
      expect(callOf('header')[0].at(-1)!.clipPath).toBe('inset(0 0 0 100%)');
      expect(callOf('rail')[1].delay).toBe(250);
      expect(callOf('vent')[1].delay).toBe(370);
      expect(callOf('footer')[1].delay).toBe(370);
    });

    it('workspace の暗幕は 1150ms から 900ms チカチカして消える(steps(1,end))', () => {
      animSpy(); stub();
      powerOn({ reduced: false });
      const [frames, opts] = callOf('workspace');
      expect(opts).toMatchObject({ delay: 1150, duration: 900, easing: 'steps(1, end)', fill: 'backwards' });
      expect(frames.map((f) => f.opacity)).toEqual([0.55, 0.11, 0.55, 0.55, 0.055, 0.495, 0.22, 0.55, 0.55, 0]);
      expect(frames.map((f) => f.offset)).toEqual([0, 0.08, 0.16, 0.34, 0.4, 0.46, 0.52, 0.58, 0.72, 1]);
    });

    it('光の帯(.milspec-sweep)は作らない', () => {
      animSpy(); stub();
      powerOn({ reduced: false });
      expect(document.querySelector('.milspec-sweep')).toBeNull();
    });

    it('配線の光は暗幕が退き始める時刻に合わせる(サイドバー系 250ms・ヘッダー系 370ms)', () => {
      animSpy(); stub();
      powerOn({ reduced: false });
      const d = (fn: { mock: { calls: unknown[][] } }, key: string) =>
        (fn.mock.calls.find((c) => c[0] === key)![1] as { delay: number }).delay;
      expect(d(fx.burst as never, 'rail:a')).toBe(250);
      expect(d(fx.burst as never, 's2k')).toBe(250);
      expect(d(fx.burst as never, 'ventL:')).toBe(370);
      expect(d(fx.burst as never, 'ventR:')).toBe(370);
      expect(d(fx.pulse as never, 'h3')).toBe(370);
    });

    it('disposePower: 暗幕の animate を cancel する', () => {
      animSpy(); stub();
      const cancel = vi.fn();
      dimAnim('sidebar').mockReturnValue({ cancel });
      powerOn({ reduced: false });
      disposePower();
      expect(document.querySelector('.milspec-sweep')).toBeNull();
      expect(cancel).toHaveBeenCalled();
    });
  });
});
