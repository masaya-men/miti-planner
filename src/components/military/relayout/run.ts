/** 進行中の開閉の状態・後片付け・時刻合わせ */
import type { Kind } from './motion';
import { syncMirrors } from './mirror';

/** 描き直しを待つ最大コマ数(これを過ぎたら待たずに進む) */
const SETTLE_MAX_FRAMES = 30;
/** 描き直しが済んだかを確かめる右端の部品(どれも開閉の前後で区画の右端からの位置が同じ)。
 *  footer / workspace は装甲の SVG(ResizeObserver で描き直す)の右端 */
const PROBES: Partial<Record<string, string>> = {
  header: '.milspec-mlv', vent: '[data-vent-rail]', footer: '.milspec-armor-panel', workspace: '.milspec-armor-panel',
};

export interface Run {
  kind: Kind;
  change: () => void;
  changed: boolean;
  dead: boolean;
  timers: ReturnType<typeof setTimeout>[];
  rafs: number[];
  anims: Animation[];
  restores: (() => void)[];
  /** 動きの最中に来た別の種類の開閉(フォーカスモードの S+H 等)。今の動きの後で行う */
  queued: { change: () => void; start: () => void } | null;
}
export const runs = new WeakMap<HTMLElement, Run>();

export const later = (run: Run, ms: number, fn: () => void) => { run.timers.push(setTimeout(() => { if (!run.dead) fn(); }, ms)); };
export const play = (run: Run, el: Element, kf: Keyframe[], opts: KeyframeAnimationOptions): Animation => {
  const a = el.animate(kf, opts);
  run.anims.push(a);
  return a;
};
export const cancelAll = (list: Animation[]) => list.forEach((a) => a.cancel());
/** change() の後は、複製の暗幕・ランプを新しい配置の本物にその場で合わせる(次のコマまで古い範囲が残らないように) */
export const doChange = (run: Run) => { if (!run.changed) { run.changed = true; run.change(); syncMirrors(); } };
export const hsOf = (app: HTMLElement): number => {
  const v = parseFloat(app.style.getPropertyValue('--ms-hs') || getComputedStyle(app).getPropertyValue('--ms-hs'));
  return v > 0 ? v : 1;
};

/** 渡した動きが全部終わったら(取れなければ ms + 250 で)fn を 1 回だけ呼ぶ */
export function whenDone(run: Run, list: Animation[], ms: number, fn: () => void) {
  let called = false;
  const once = () => { if (!called && !run.dead) { called = true; fn(); } };
  void Promise.allSettled(list.map((a) => a.finished)).then(once);
  later(run, ms + 250, once);
}

/** 右端の部品の画面位置(開閉の前後で同じはず)。change 前に記録し、change 後に一致するまで待つ */
export function captureProbes(zones: HTMLElement[]): [HTMLElement, string, number, number][] {
  const out: [HTMLElement, string, number, number][] = [];
  for (const z of zones) {
    const sel = PROBES[z.getAttribute('data-ms-zone') ?? ''];
    const e = sel ? z.querySelector(sel) : null;
    if (!sel || !e) continue;
    const r = e.getBoundingClientRect(), zr = z.getBoundingClientRect();
    out.push([z, sel, r.right - zr.right, r.top - zr.top]);
  }
  return out;
}
export function whenSettled(run: Run, probes: [HTMLElement, string, number, number][], fn: () => void) {
  let n = 0;
  const ok = () => probes.every(([z, sel, x, y]) => {
    const e = z.querySelector(sel);
    if (!e) return true;
    // 区画の右端・上端からの位置で比べる(2 段目まで止めておく区画は transform でずれているため)
    const r = e.getBoundingClientRect(), zr = z.getBoundingClientRect();
    return Math.abs(r.right - zr.right - x) < 0.5 && Math.abs(r.top - zr.top - y) < 0.5;
  });
  const tick = () => {
    if (run.dead) return;
    if (ok() || ++n >= SETTLE_MAX_FRAMES) fn();
    else run.rafs.push(requestAnimationFrame(tick));
  };
  tick();
}

export function finish(app: HTMLElement, run: Run) {
  if (run.dead) return;
  run.dead = true;
  run.timers.forEach(clearTimeout);
  run.rafs.forEach(cancelAnimationFrame);
  run.restores.forEach((r) => r());
  cancelAll(run.anims);
  runs.delete(app);
  app.removeAttribute('data-relayout');
  const q = run.queued;
  if (q) q.start();
}

/** 進行中の動きを止める(標準テーマへ戻る / アンマウント時)。複製を消し、隠した区画を戻し、
 *  change() がまだなら即時に呼ぶ(後に控えた開閉も即時に行う)。 */
export function cancelRelayout(app: HTMLElement): void {
  const run = runs.get(app);
  if (!run) return;
  run.dead = true;
  run.timers.forEach(clearTimeout);
  run.rafs.forEach(cancelAnimationFrame);
  cancelAll(run.anims);
  run.restores.forEach((r) => r());
  runs.delete(app);
  app.removeAttribute('data-relayout');
  if (!run.changed) { run.changed = true; run.change(); }
  run.queued?.change();
}

/** 1 段目が画面から見えなくなった所(cond が真・遅くとも deadline ms)で fn を 1 回呼ぶ。from ms までは確かめない。
 *  change の重い再描画を「ずらす間」の中に隠し、2 段目は予定の時刻に始めるため */
export function whenHidden(run: Run, from: number, deadline: number, cond: () => boolean, fn: () => void) {
  let called = false;
  const fire = () => { if (!called && !run.dead) { called = true; fn(); } };
  const tick = () => { if (called || run.dead) return; if (cond()) fire(); else run.rafs.push(requestAnimationFrame(tick)); };
  later(run, from, tick);
  later(run, deadline, fire);
}
/** 渡した動きが全部終わったか(終わると true になる入れ物) */
export function doneFlag(list: Animation[]): { v: boolean } {
  const f = { v: false };
  void Promise.allSettled(list.map((a) => a.finished)).then(() => { f.v = true; });
  return f;
}
/** 2 段目まで止めておく動き(最初の keyframe の位置で待つ) */
export const held = (run: Run, el: Element, kf: Keyframe[], opts: KeyframeAnimationOptions): Animation => {
  const a = play(run, el, kf, opts);
  a.pause();
  return a;
};
/** 1 段目の動きが実際に始まった時刻(document.timeline の ms)。取れなければ null(テストの代役など) */
export const startOf = (a: Animation | undefined): number | null => (typeof a?.startTime === 'number' ? a.startTime : null);
const timelineNow = (): number | null => {
  const t = typeof document !== 'undefined' ? document.timeline?.currentTime : null;
  return typeof t === 'number' ? t : null;
};
/** 止めてある 2 段目の動きを「1 段目の開始時刻 base + offset」に一斉に動かす。開始時刻を timeline に直接入れるので、
 *  change の重い再描画で主スレッドが詰まっていても時刻どおりに動き出す。時刻が取れない / もう過ぎているときは今すぐ。
 *  onStart は動き出す時刻に呼ぶ。戻り値は動き出すまでの ms */
export function launch(run: Run, anims: Animation[], base: number | null, offset: number, onStart?: () => void): number {
  const now = timelineNow();
  let wait = 0;
  if (base !== null && now !== null && base + offset > now) {
    wait = base + offset - now;
    anims.forEach((a) => { a.startTime = base + offset; });
  } else anims.forEach((a) => a.play());
  if (onStart) { if (wait > 0) later(run, wait, onStart); else onStart(); }
  return wait;
}
/** 2 段目を始めてよいか: 予定の時刻が来た(タイマー)か、timeline に開始時刻を予約できる */
export const canStart = (gapOver: boolean, base: number | null) => gapOver || (base !== null && timelineNow() !== null);
