/**
 * MIL-SPEC の電源(見本 js:1158-1179 の移植)。
 * 状態は <html data-ms-power="off"> の有無で持つ(光エンジン・時計・ランプ・CSS がこの属性を読む)。
 * 部品ごとの演出(CRT・ランプ順点灯・時計・銘板・タービン)は各部品が `milspec:power` を購読して行う。
 */
import { burst, pulse, coreFire, trafficBp, scanBall } from '../fx/engine';

export type PowerState = 'on' | 'off';
export interface PowerEvent { state: PowerState; reduced: boolean }
export interface PowerOpts { reduced?: boolean }

const EVENT = 'milspec:power';
/** 電源投入で順に点灯する区画の順番(決定事項: 見本の 7 区画を本体の 6 区画に) */
export const POWER_ZONES = ['sidebar', 'rail', 'header', 'vent', 'workspace', 'footer'] as const;

const root = () => document.documentElement;
const prefersReduced = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isReduced = (o?: PowerOpts) => o?.reduced ?? prefersReduced();

export const isPowered = (): boolean => root().dataset.msPower !== 'off';

/** URL に noboot がある(見本 js:1222) */
const noBoot = (): boolean => typeof location !== 'undefined' && /noboot/.test(location.search);

/** MIL-SPEC の画面を開いた直後の状態を作る。電源 off で始める(?noboot・動きを減らす場合は最初から on) */
export function initPower(): PowerState {
  const st: PowerState = noBoot() || prefersReduced() ? 'on' : 'off';
  root().dataset.msPower = st;
  return st;
}

/** 標準テーマへ戻るとき: 属性・暗転板・区画の遅延を残さない */
export function disposePower(): void {
  delete root().dataset.msPower;
  document.querySelector('.milspec-blackout')?.remove();
  document.querySelectorAll<HTMLElement>('[data-ms-zone]').forEach((z) => z.style.removeProperty('--pd'));
}

function blackout(frames: Keyframe[], duration: number): void {
  let el = document.querySelector<HTMLElement>('.milspec-blackout');
  if (!el) {
    el = document.createElement('div');
    el.className = 'milspec-blackout';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  if (typeof el.animate === 'function') el.animate(frames, { duration });
}

function setZoneDelays(fn: (i: number) => string): void {
  POWER_ZONES.forEach((z, i) => {
    document.querySelector<HTMLElement>(`[data-ms-zone="${z}"]`)?.style.setProperty('--pd', fn(i));
  });
}

function emit(state: PowerState, reduced: boolean): void {
  window.dispatchEvent(new CustomEvent<PowerEvent>(EVENT, { detail: { state, reduced } }));
}

/** 電源投入(見本 js:1159-1179 の順) */
export function powerOn(opts: PowerOpts = {}): void {
  const reduced = isReduced(opts);
  root().dataset.msPower = 'on';
  if (reduced) { emit('on', true); return; }
  blackout([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0.85, offset: 0.5 }, { opacity: 0 }], 260);
  setZoneDelays((i) => `${140 + i * 60}ms`);
  emit('on', false);
  // 配線疾走: 全ての束を光が駆け抜ける(レール → サイドバー → 通気口 → ジョブの基板 → 継ぎ目)
  burst('rail:a', { delay: 240, stagger: 16, speed: 1.3, chain: true });
  burst('s2k', { delay: 200, stagger: 30, speed: 1.1 });
  coreFire(620);
  burst('ventL:', { delay: 420, stagger: 20, speed: 1.6 });
  burst('ventR:', { delay: 440, stagger: 20, speed: 1.6 });
  trafficBp(560);
  pulse('s1', { delay: 380, len: 16 });
  pulse('h3', { delay: 460, len: 16 });
  setTimeout(() => {
    const row = document.querySelector<HTMLElement>('.milspec-app [data-scan]');
    if (row) scanBall(row);
  }, 900);
}

/** 電源断(見本 js:1158)。300ms の暗転が終わったら解決する */
export function powerOff(opts: PowerOpts = {}): Promise<void> {
  const reduced = isReduced(opts);
  if (!reduced) blackout([{ opacity: 0 }, { opacity: 0.7 }, { opacity: 0.1 }, { opacity: 0 }], 300);
  setZoneDelays(() => '0ms');
  root().dataset.msPower = 'off';
  emit('off', reduced);
  return new Promise((resolve) => { setTimeout(resolve, reduced ? 0 : 300); });
}

/** `milspec:power` の購読。戻り値で解除 */
export function onPower(fn: (e: PowerEvent) => void): () => void {
  const h = (ev: Event) => fn((ev as CustomEvent<PowerEvent>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
