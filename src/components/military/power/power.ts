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
let scanTimer: number | undefined; // 電源投入 BOOT_TIMING.scan 後の scanBall(アンマウントで消す)
let bootAnims: Animation[] = []; // 進行中の暗幕の animate(電源断・解除で止める)
/** 立ち上がりの順番: レール → サイドバー → 通気口 → ヘッダー → フッター(250 + i×130)→ workspace のチカチカ。各区画は 900ms かけて「うっすら→明るく→一瞬沈む→落ち着く」(見本 P2) */
export const BOOT_TIMING = {
  rail: { delay: 250, dur: 900 }, sidebar: { delay: 380, dur: 900 }, vent: { delay: 510, dur: 900 },
  header: { delay: 640, dur: 900 }, footer: { delay: 770, dur: 900 },
  workspace: { delay: 1150, dur: 900 }, lamps: 900, scan: 2100,
} as const;
/** 区画の明るさ(0 暗い〜1 点灯)の山谷(見本 P2 の frames)。暗幕の opacity = 0.55 × (1 − 明るさ) に換算して使う */
const BRIGHTNESS: { o: number; at: number }[] = [
  { o: 0, at: 0 }, { o: 0.3, at: 0.1 }, { o: 0.95, at: 0.5 }, { o: 0.7, at: 0.62 }, { o: 1, at: 0.8 }, { o: 1, at: 1 },
];
const DIM = 0.55; // 暗幕の濃さ(.milspec-dim の通常 opacity)
const BOOT_FRAMES: Keyframe[] = BRIGHTNESS.map(({ o, at }) => ({ opacity: +(DIM * (1 - o)).toFixed(3), offset: at, easing: 'ease-out' }));
/** workspace の暗幕のチカチカ(見本 C3 の不透明度に暗幕の濃さ 0.55 を掛けたもの) */
const FLICKER_OPACITY = [1, 0.2, 1, 1, 0.1, 0.9, 0.4, 1, 1, 0].map((v) => +(v * 0.55).toFixed(3));
const FLICKER_OFFSET = [0, 0.08, 0.16, 0.34, 0.4, 0.46, 0.52, 0.58, 0.72, 1];
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
  window.clearTimeout(scanTimer);
  delete root().dataset.msPower;
  document.querySelector('.milspec-blackout')?.remove();
  stopBoot();
}

/** 暗幕の進行中の animate を止める */
function stopBoot(): void {
  bootAnims.forEach((a) => a.cancel?.());
  bootAnims = [];
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

/** 区画 → 暗幕が退く開始時刻(vent/footer もそれぞれ自分の時刻) */
const BOOT_ZONES: Record<string, { delay: number; dur: number }> = {
  rail: BOOT_TIMING.rail, sidebar: BOOT_TIMING.sidebar, vent: BOOT_TIMING.vent,
  header: BOOT_TIMING.header, footer: BOOT_TIMING.footer,
};

const track = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): void => {
  if (typeof el.animate !== 'function') return;
  bootAnims.push(el.animate(frames, opts));
};

/** 6 区画の暗幕(.milspec-dim)を opacity で退かせる(光るのは配線の光=fx/engine の役目) */
function bootZones(): void {
  stopBoot();
  POWER_ZONES.forEach((z) => {
    const zone = document.querySelector<HTMLElement>(`[data-ms-zone="${z}"]`);
    const dim = zone?.querySelector<HTMLElement>('.milspec-dim');
    if (!zone || !dim) return;
    if (z === 'workspace') {
      const { delay, dur } = BOOT_TIMING.workspace;
      track(dim, FLICKER_OPACITY.map((opacity, i) => ({ opacity, offset: FLICKER_OFFSET[i] })),
        { delay, duration: dur, easing: 'steps(1, end)', fill: 'backwards' });
      return;
    }
    const { delay, dur } = BOOT_ZONES[z];
    track(dim, BOOT_FRAMES, { delay, duration: dur, fill: 'backwards' });
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
  bootZones();
  emit('on', false);
  // 配線疾走(各区画の点き始めに合わせて走る): 全ての束を光が駆け抜ける(レール → サイドバー → 通気口 → ジョブの基板 → 継ぎ目)
  burst('rail:a', { delay: BOOT_TIMING.rail.delay, stagger: 16, speed: 1.3, chain: true });
  burst('s2k', { delay: BOOT_TIMING.sidebar.delay, stagger: 30, speed: 1.1 });
  coreFire(620);
  burst('ventL:', { delay: BOOT_TIMING.vent.delay, stagger: 20, speed: 1.6 });
  burst('ventR:', { delay: BOOT_TIMING.vent.delay, stagger: 20, speed: 1.6 });
  trafficBp(560);
  pulse('s1', { delay: BOOT_TIMING.sidebar.delay, len: 16 });
  pulse('h3', { delay: BOOT_TIMING.header.delay, len: 16 });
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    const row = document.querySelector<HTMLElement>('.milspec-app [data-scan]');
    if (row) scanBall(row);
  }, BOOT_TIMING.scan);
}

/** 電源断(見本 js:1158)。300ms の暗転が終わったら解決する */
export function powerOff(opts: PowerOpts = {}): Promise<void> {
  const reduced = isReduced(opts);
  if (!reduced) blackout([{ opacity: 0 }, { opacity: 0.7 }, { opacity: 0.1 }, { opacity: 0 }], 300);
  stopBoot();
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
