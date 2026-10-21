// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const fx = vi.hoisted(() => ({ burst: vi.fn(), pulse: vi.fn(), coreFire: vi.fn(), trafficBp: vi.fn(), scanBall: vi.fn() }));
vi.mock('../../fx/engine', () => fx);

import { isPowered, powerOn, powerOff, onPower, initPower, disposePower } from '../power';

const zones = ['sidebar', 'rail', 'header', 'vent', 'workspace', 'footer'];
const mount = () => {
  document.body.innerHTML = '<div class="milspec-app">' + zones.map((z) => `<div data-ms-zone="${z}"></div>`).join('') + '<div data-scan></div></div>';
};
const animSpy = () => vi.spyOn(HTMLElement.prototype as unknown as { animate: () => unknown }, 'animate').mockImplementation(() => ({}));

beforeEach(() => { vi.useFakeTimers(); mount(); Object.values(fx).forEach((f) => f.mockClear()); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); disposePower(); window.history.replaceState({}, '', '/'); });

describe('power', () => {
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

  it('powerOn: 属性 on・暗転・区画の --pd が 140+i*60ms・イベント・疾走・900ms 後に scanBall', () => {
    const a = animSpy();
    const ev = vi.fn();
    const off = onPower(ev);
    initPower();
    powerOn({ reduced: false });
    expect(isPowered()).toBe(true);
    expect(document.querySelector('.milspec-blackout')).not.toBeNull();
    expect(a).toHaveBeenCalled();
    zones.forEach((z, i) => expect((document.querySelector(`[data-ms-zone="${z}"]`) as HTMLElement).style.getPropertyValue('--pd')).toBe(`${140 + i * 60}ms`));
    expect(ev).toHaveBeenCalledWith({ state: 'on', reduced: false });
    expect(fx.burst).toHaveBeenCalledWith('rail:a', { delay: 240, stagger: 16, speed: 1.3, chain: true });
    expect(fx.coreFire).toHaveBeenCalledWith(620);
    expect(fx.trafficBp).toHaveBeenCalledWith(560);
    expect(fx.scanBall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(900);
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

  it('powerOff: 属性 off・--pd 0・300ms 後に解決', async () => {
    animSpy();
    powerOn({ reduced: false });
    let done = false;
    const p = powerOff({ reduced: false }).then(() => { done = true; });
    expect(isPowered()).toBe(false);
    expect((document.querySelector('[data-ms-zone="rail"]') as HTMLElement).style.getPropertyValue('--pd')).toBe('0ms');
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
});
