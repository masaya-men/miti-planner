/** ヘッダー / サイドバーの開閉で区画を滑らせる動き(設計書 §3 D・見本 v3.html の tgSide / tgHead / clipMv / runCar)。
 *  全ての開閉は 2 段: 1 段目は今の配置のまま動かす → 1 段目の終わり + PHASE_GAP で 2 段目を新しい配置で動かす。
 *  change() は 1 段目が画面から見えなくなった所(抜ける区画が画面の外へ出た / よけた区画が行き先に着いた)で呼び、
 *  2 段目まで動く区画は一時停止した animate で元の画面位置に止めておく(重い再描画を「ずらす間」の中に隠すため)。
 *  サイドバーの開閉では、ヘッダー・通気口を「左の板 / 右に固定 / 台車」の複製に切り分ける(splitZone)。
 *  左の板だけが 1 枚の板として滑り、右端基準の部品(時計・H4・sort・hazR・pnX・レール)は画面上で一度も動かない。
 *  板の動きは全て「少し行き過ぎて戻る」共通の keyframe(frames)。台車はモーターで少し遅れて一定の速さで走る。
 *
 *  ⚠ change() の直後、ヘッダー・通気口の中身(MW)は ResizeObserver 経由の再描画が追いつくまで 1〜数コマ古いまま
 *  (実測: 1489 幅で 2 コマ、レバーが 276px 左にずれる)。そのため区画の幅が変わる間は複製で見た目を押さえ、
 *  右端の部品が元の画面位置に戻った(=描き直しが済んだ)のを確かめてから、新しい配置の複製を作る / 本物に戻す。 */
import { HDR_FRAME, HDR_H, SIDEBAR_SPAN } from './headerGeometry';

/** 1 つの動き・ずらす間・台車の遅れ・台車の走行(ms。見本 v3 で masaya が選んだ値) */
export const PHASE_DUR = 420, PHASE_GAP = 80, CARRIAGE_LAG = 60, CARRIAGE_DUR = 480;

type Kind = 'hdr' | 'sb';
const EASE = 'cubic-bezier(.2,0,.15,1)';
const CAR_EASE = 'cubic-bezier(.45,0,.3,1)';
/** 通気口の左の板の右端(溝 chanL の左端・ventLayout の chanL.x) */
const VENT_SEAM = 190;
/** 抜ける / 入る区画が画面の外へ出きる余白(見本の +4) */
const OUT = 4;
/** 複製の切り口以外の辺は、影・突起を切らないよう外側へ広げて切る */
const CLIP_PAD = 16;
/** 描き直しを待つ最大コマ数(これを過ぎたら待たずに進む) */
const SETTLE_MAX_FRAMES = 30;
/** 描き直しが済んだかを確かめる右端の部品(どれも開閉の前後で画面上の位置が同じ) */
const PROBES: Partial<Record<string, string>> = { header: '.milspec-mlv', vent: '[data-vent-rail]' };
/** 光エンジン(engine.ts)が経路として拾う属性。複製からは外す */
const TRACE_ATTRS = ['data-trace', 'data-trace-pc', 'data-trace-next', 'data-trace-end', 'data-bus'];

const zoneOf = (app: HTMLElement, name: string): HTMLElement | null =>
  app.querySelector<HTMLElement>(`[data-ms-zone="${name}"]`);

/** 区画の進み = 開始のずれから終わりへ。途中で 1.8px 行き過ぎて 0.5px 戻って止まる(重く抜けて少し行き過ぎる質感)。
 *  開始 → 行き過ぎ → 戻り → 終わり の 4 点は frames / edgeFrames で共通 */
const steps = (s: number, e: number): number[] => { const o = -Math.sign(s - e) * 1.8; return [s, e + o, e - o * 0.28, e]; };
const STEP_TIMING: Keyframe[] = [{ easing: EASE }, { offset: 0.72, easing: 'ease-in-out' }, { offset: 0.87 }, {}];
const frames = (sx: number, sy: number, endX: number, endY: number): Keyframe[] => {
  const xs = steps(sx, endX), ys = steps(sy, endY);
  return STEP_TIMING.map((k, i) => ({ transform: `translate(${xs[i]}px, ${ys[i]}px)`, ...k }));
};
/** 台車: 一定の速さで走り、最後の 0.8px でカチッと止まる(見本 runCar) */
const carFrames = (sx: number, endX: number): Keyframe[] => [
  { transform: `translateX(${sx}px)`, easing: CAR_EASE },
  { transform: `translateX(${Math.round((endX + Math.sign(sx - endX) * 0.8) * 100) / 100}px)`, offset: 0.9 },
  { transform: `translateX(${endX}px)` },
];

// ---------------------------------------------------------------- 複製(残像)

/** 区画とその親(app)の画面上の矩形。複製を何枚も作る前に 1 回だけ読む(読むたびに配置の再計算が走るため) */
export type Box = { a: DOMRect; r: DOMRect };
const boxOf = (zone: HTMLElement): Box => ({ a: zone.parentElement!.getBoundingClientRect(), r: zone.getBoundingClientRect() });

/** 区画の複製。格子に乗らないよう絶対配置にし、触れず・読み上げず・光エンジンにも拾われないようにする */
function cloneZone(zone: HTMLElement, part: string, { a, r }: Box): HTMLElement {
  const c = zone.cloneNode(true) as HTMLElement;
  c.removeAttribute('data-ms-zone');
  c.classList.add('milspec-split');
  c.setAttribute('data-split', part);
  c.setAttribute('aria-hidden', 'true');
  c.setAttribute('inert', '');
  c.querySelectorAll(TRACE_ATTRS.map((n) => `[${n}]`).join(',')).forEach((e) => TRACE_ATTRS.forEach((n) => e.removeAttribute(n)));
  Object.assign(c.style, {
    position: 'absolute', gridArea: 'auto', margin: '0', pointerEvents: 'none', zIndex: '1', visibility: '',
    left: `${r.left - a.left}px`, top: `${r.top - a.top}px`, width: `${r.width}px`, height: `${r.height}px`,
  });
  return c;
}
const PAD = `-${CLIP_PAD}px`;
/** 右の複製の見える左端を、滑る板の左端(区画の左端からの位置 sx → ex)と同じ動きで動かす(見本 clipMv)。
 *  継ぎ目が板の移動量より左にあるとき(通気口)、板の左側に右の複製(溝)がはみ出さないようにするため */
const edgeFrames = (sx: number, ex: number): Keyframe[] => {
  const xs = steps(sx, ex);
  return STEP_TIMING.map((k, i) => ({ clipPath: `inset(${PAD} ${PAD} ${PAD} ${xs[i]}px)`, ...k }));
};
/** 右の複製: 継ぎ目より右だけ。台車は別の複製が持つので外す */
function rightClone(zone: HTMLElement, seamPx: number, box: Box): HTMLElement {
  const c = cloneZone(zone, 'right', box);
  c.querySelector('[data-vent-carriage]')?.remove();
  c.style.clipPath = `inset(${PAD} ${PAD} ${PAD} ${seamPx}px)`;
  return c;
}

export interface SplitZone {
  left: HTMLElement; right: HTMLElement; carriage: HTMLElement | null; restore(): void;
  /** 右の複製の見える左端を動かす範囲(区画の左端から sx → ex)。継ぎ目が板の移動量より右なら不要(null) */
  edge?: [number, number] | null;
}

/** 区画を隠し、その上に複製を置く。左は継ぎ目 seamPx(区画の左端から・画面 px)より左だけ、右は継ぎ目より右だけを見せる。
 *  通気口のときは、台車([data-vent-carriage])を左右の複製から除き、台車だけの複製を carriage として返す。
 *  重なり順は 右 → 左 → 台車(左の板は右の上を滑る)。 */
export function splitZone(zone: HTMLElement, seamPx: number, box: Box = boxOf(zone)): SplitZone {
  const host = zone.parentElement!;
  const right = rightClone(zone, seamPx, box);
  const left = cloneZone(zone, 'left', box);
  left.querySelector('[data-vent-carriage]')?.remove();
  left.style.clipPath = `inset(${PAD} calc(100% - ${seamPx}px) ${PAD} ${PAD})`;
  let carriage: HTMLElement | null = null;
  if (zone.querySelector('[data-vent-carriage]')) {
    carriage = cloneZone(zone, 'carriage', box);
    // 台車とその祖先だけを残す(格子・溝・レール・暗幕は右の複製が持つ)
    for (let n = carriage.querySelector<HTMLElement>('[data-vent-carriage]'); n && n !== carriage; n = n.parentElement) {
      const keep = n;
      [...keep.parentElement!.children].forEach((sib) => { if (sib !== keep) sib.remove(); });
    }
  }
  host.append(right, left);
  if (carriage) host.append(carriage);
  const prev = zone.style.visibility;
  zone.style.visibility = 'hidden';
  let done = false;
  const sp: SplitZone = {
    left, right, carriage,
    restore() {
      if (done) return;
      done = true;
      sp.right.remove(); sp.left.remove(); sp.carriage?.remove();
      zone.style.visibility = prev;
    },
  };
  return sp;
}

/** 右の複製だけを、今の(change 後・描き直し済みの)区画から作り直す。左の板・台車は左端基準なのでどちらの配置の複製でもよい */
function swapRight(sp: SplitZone, zone: HTMLElement, seamPx: number, box: Box) {
  const n = rightClone(zone, seamPx, box);
  sp.left.before(n);
  sp.right.remove();
  sp.right = n;
}

// ---------------------------------------------------------------- 進行中の状態

interface Run {
  kind: Kind;
  change: () => void;
  changed: boolean;
  dead: boolean;
  timers: ReturnType<typeof setTimeout>[];
  rafs: number[];
  anims: Animation[];
  restores: (() => void)[];
  /** 動きの最中に来た別の種類の開閉(フォーカスモードの S+H 等)。今の動きの後で行う */
  queued: { change: () => void; kind: Kind; reduced: boolean } | null;
}
const runs = new WeakMap<HTMLElement, Run>();

const later = (run: Run, ms: number, fn: () => void) => { run.timers.push(setTimeout(() => { if (!run.dead) fn(); }, ms)); };
const play = (run: Run, el: Element, kf: Keyframe[], opts: KeyframeAnimationOptions): Animation => {
  const a = el.animate(kf, opts);
  run.anims.push(a);
  return a;
};
const cancelAll = (list: Animation[]) => list.forEach((a) => a.cancel());
const doChange = (run: Run) => { if (!run.changed) { run.changed = true; run.change(); } };
const hsOf = (app: HTMLElement): number => {
  const v = parseFloat(app.style.getPropertyValue('--ms-hs') || getComputedStyle(app).getPropertyValue('--ms-hs'));
  return v > 0 ? v : 1;
};

/** 渡した動きが全部終わったら(取れなければ ms + 250 で)fn を 1 回だけ呼ぶ */
function whenDone(run: Run, list: Animation[], ms: number, fn: () => void) {
  let called = false;
  const once = () => { if (!called && !run.dead) { called = true; fn(); } };
  void Promise.allSettled(list.map((a) => a.finished)).then(once);
  later(run, ms + 250, once);
}

/** 右端の部品の画面位置(開閉の前後で同じはず)。change 前に記録し、change 後に一致するまで待つ */
function captureProbes(zones: HTMLElement[]): [HTMLElement, string, number, number][] {
  const out: [HTMLElement, string, number, number][] = [];
  for (const z of zones) {
    const sel = PROBES[z.getAttribute('data-ms-zone') ?? ''];
    const e = sel ? z.querySelector(sel) : null;
    if (!sel || !e) continue;
    const r = e.getBoundingClientRect();
    out.push([z, sel, r.left, r.top]);
  }
  return out;
}
function whenSettled(run: Run, probes: [HTMLElement, string, number, number][], fn: () => void) {
  let n = 0;
  const ok = () => probes.every(([z, sel, x, y]) => {
    const e = z.querySelector(sel);
    if (!e) return true;
    const r = e.getBoundingClientRect();
    return Math.abs(r.left - x) < 0.5 && Math.abs(r.top - y) < 0.5;
  });
  const tick = () => {
    if (run.dead) return;
    if (ok() || ++n >= SETTLE_MAX_FRAMES) fn();
    else run.rafs.push(requestAnimationFrame(tick));
  };
  tick();
}

function finish(app: HTMLElement, run: Run) {
  if (run.dead) return;
  run.dead = true;
  run.timers.forEach(clearTimeout);
  run.rafs.forEach(cancelAnimationFrame);
  run.restores.forEach((r) => r());
  cancelAll(run.anims);
  runs.delete(app);
  app.removeAttribute('data-relayout');
  const q = run.queued;
  if (q) relayoutZones(app, q.change, q.kind, q.reduced);
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

// ---------------------------------------------------------------- 開閉

export function relayoutZones(app: HTMLElement, change: () => void, kind: Kind, reduced: boolean): void {
  const cur = runs.get(app);
  if (cur) {
    // 動きの最中: 同じ種類の 2 回目は無視(状態も変えない)。別の種類は 1 つだけ控えて後で行う
    if (cur.kind !== kind && !cur.queued) cur.queued = { change, kind, reduced };
    return;
  }
  const src = zoneOf(app, kind === 'hdr' ? 'header' : 'sidebar');
  // 動きを減らす / 区画が無い / WAAPI が無い: 即時に切り替えるだけ
  if (reduced || !src || typeof src.animate !== 'function') { change(); return; }

  const run: Run = { kind, change, changed: false, dead: false, timers: [], rafs: [], anims: [], restores: [], queued: null };
  runs.set(app, run);
  app.setAttribute('data-relayout', kind);
  if (kind === 'hdr') {
    if (src.hasAttribute('data-collapsed')) headerOpen(app, run, src); else headerClose(app, run, src);
  } else if (src.hasAttribute('data-open')) sidebarClose(app, run, src);
  else sidebarOpen(app, run);
}

const SLIDE_ZONES = ['rail', 'workspace', 'footer'] as const;
const zonesOf = (app: HTMLElement, names: readonly string[]) =>
  names.map((n) => zoneOf(app, n)).filter((z): z is HTMLElement => !!z);
/** サイドバーの開閉で切り分ける区画(閉じたヘッダーは見えないので切らない) */
function splitTargets(app: HTMLElement): HTMLElement[] {
  const h = zoneOf(app, 'header'), v = zoneOf(app, 'vent');
  return [h && !h.hasAttribute('data-collapsed') ? h : null, v].filter((z): z is HTMLElement => !!z);
}
const seamOf = (app: HTMLElement, z: HTMLElement) =>
  (z.getAttribute('data-ms-zone') === 'vent' ? VENT_SEAM : HDR_FRAME.sx) * hsOf(app);

/** 切り分けた左の板を sx → ex で滑らせ、台車を csx → cex で走らせる(右の複製は動かさない)。
 *  paused のときは最初の位置で止めておく(launch で一斉に動かす)。moving() で台車のランプ・車輪を動かす */
function slidePlates(run: Run, sp: SplitZone, sx: number, ex: number, csx: number, cex: number, paused: boolean): { anims: Animation[]; moving(): void } {
  const mk = paused ? held : play;
  const anims = [mk(run, sp.left, frames(sx, 0, ex, 0), { duration: PHASE_DUR, fill: 'both' })];
  if (sp.edge) anims.push(mk(run, sp.right, edgeFrames(sp.edge[0], sp.edge[1]), { duration: PHASE_DUR, fill: 'both' }));
  const car = sp.carriage?.querySelector('[data-vent-carriage]') ?? null;
  if (sp.carriage) {
    const a = mk(run, sp.carriage, carFrames(csx, cex), { duration: CARRIAGE_DUR, delay: CARRIAGE_LAG, fill: 'both' });
    void a.finished?.then(() => car?.classList.remove('is-moving'), () => {});
    anims.push(a);
  }
  const moving = () => { car?.classList.add('is-moving'); };
  if (!paused) moving();
  return { anims, moving };
}

/** 1 段目が画面から見えなくなった所(cond が真・遅くとも deadline ms)で fn を 1 回呼ぶ。from ms までは確かめない。
 *  change の重い再描画を「ずらす間」の中に隠し、2 段目は予定の時刻に始めるため */
function whenHidden(run: Run, from: number, deadline: number, cond: () => boolean, fn: () => void) {
  let called = false;
  const fire = () => { if (!called && !run.dead) { called = true; fn(); } };
  const tick = () => { if (called || run.dead) return; if (cond()) fire(); else run.rafs.push(requestAnimationFrame(tick)); };
  later(run, from, tick);
  later(run, deadline, fire);
}
/** 渡した動きが全部終わったか(終わると true になる入れ物) */
function doneFlag(list: Animation[]): { v: boolean } {
  const f = { v: false };
  void Promise.allSettled(list.map((a) => a.finished)).then(() => { f.v = true; });
  return f;
}
/** 2 段目まで止めておく動き(最初の keyframe の位置で待つ) */
const held = (run: Run, el: Element, kf: Keyframe[], opts: KeyframeAnimationOptions): Animation => {
  const a = play(run, el, kf, opts);
  a.pause();
  return a;
};
/** 1 段目の動きが実際に始まった時刻(document.timeline の ms)。取れなければ null(テストの代役など) */
const startOf = (a: Animation | undefined): number | null => (typeof a?.startTime === 'number' ? a.startTime : null);
const timelineNow = (): number | null => {
  const t = typeof document !== 'undefined' ? document.timeline?.currentTime : null;
  return typeof t === 'number' ? t : null;
};
/** 止めてある 2 段目の動きを「1 段目の開始時刻 base + offset」に一斉に動かす。開始時刻を timeline に直接入れるので、
 *  change の重い再描画で主スレッドが詰まっていても時刻どおりに動き出す。時刻が取れない / もう過ぎているときは今すぐ。
 *  onStart は動き出す時刻に呼ぶ。戻り値は動き出すまでの ms */
function launch(run: Run, anims: Animation[], base: number | null, offset: number, onStart?: () => void): number {
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
const canStart = (gapOver: boolean, base: number | null) => gapOver || (base !== null && timelineNow() !== null);

/** サイドバーを閉じる: サイドバーだけ左へ抜ける → 下地 → 他の区画と左の板が滑り込む(台車はレールを走る) */
function sidebarClose(app: HTMLElement, run: Run, sb: HTMLElement) {
  const a = app.getBoundingClientRect(), s = sb.getBoundingClientRect();
  const slides = zonesOf(app, SLIDE_ZONES);
  const before = new Map(slides.map((z) => [z, z.getBoundingClientRect().left]));
  const targets = splitTargets(app);
  const probes = captureProbes(targets);
  const p1 = [play(run, sb, frames(0, 0, -(s.right - a.left + OUT), 0), { duration: PHASE_DUR, fill: 'forwards' })];

  let base: number | null = null, D = 0, settled = false, gapOver = false, started = false;
  let wait: Animation[] = [], plates: ReturnType<typeof slidePlates>[] = [];
  const edges: Animation[] = [];
  const go = () => {
    if (!run.changed || !settled || started || !canStart(gapOver, base)) return;
    started = true;
    const all = [...wait, ...edges, ...plates.flatMap((p) => p.anims)];
    const w = launch(run, all, base, PHASE_DUR + PHASE_GAP, () => plates.forEach((p) => p.moving()));
    whenDone(run, all, w + Math.max(PHASE_DUR, CARRIAGE_LAG + CARRIAGE_DUR), () => finish(app, run));
  };
  // サイドバーが画面の外へ抜けきったら change。ヘッダー・通気口は change 前の配置で切り分けて押さえる
  // (左の板・台車はこの複製のまま 2 段目で動かす。右の複製だけ、描き直しが済んでから新しい配置で作り直す)
  whenHidden(run, PHASE_DUR * 0.4, PHASE_DUR, () => sb.getBoundingClientRect().right <= app.getBoundingClientRect().left + 0.5, () => {
    const boxes = targets.map(boxOf);
    const splits = targets.map((z, i) => splitZone(z, seamOf(app, z), boxes[i]));
    run.restores.push(...splits.map((sp) => sp.restore));
    base = startOf(p1[0]);
    doChange(run);
    cancelAll(p1);
    slides.forEach((z) => { D = Math.max(D, before.get(z)! - z.getBoundingClientRect().left); });
    if (D < 0.5) D = SIDEBAR_SPAN;
    // rail / workspace / footer は新しい配置で +D(= 元の画面位置)に止めておき、2 段目の開始で一斉に動かす
    wait = slides.map((z) => held(run, z, frames(D, 0, 0, 0), { duration: PHASE_DUR, fill: 'both' }));
    plates = splits.map((sp) => slidePlates(run, sp, 0, -D, 0, -D / 2, true));
    whenSettled(run, probes, () => {
      const bx = targets.map(boxOf);
      targets.forEach((z, i) => {
        const seam = seamOf(app, z);
        swapRight(splits[i], z, seam, bx[i]);
        // 継ぎ目が移動量より左(通気口): 右の複製(溝)の見える左端を板の左端と一緒に動かす。新しい配置では D → 0
        if (seam < D - 0.5) edges.push(held(run, splits[i].right, edgeFrames(D, 0), { duration: PHASE_DUR, fill: 'both' }));
      });
      settled = true;
      go();
    });
  });
  later(run, PHASE_DUR + PHASE_GAP, () => { gapOver = true; go(); });
}

/** サイドバーを開く: 他の区画と左の板が右へよける(台車も走る) → 下地 → サイドバーが左から入る */
function sidebarOpen(app: HTMLElement, run: Run) {
  // change 前なので、動く量は「開いたときのサイドバーの幅 + 隙間」
  const D = SIDEBAR_SPAN;
  const targets = splitTargets(app);
  const probes = captureProbes(targets);
  const p1 = zonesOf(app, SLIDE_ZONES).map((z) => play(run, z, frames(0, 0, D, 0), { duration: PHASE_DUR, fill: 'forwards' }));
  const plateAnims = targets.flatMap((z) => {
    const seam = seamOf(app, z);
    const sp = splitZone(z, seam);
    run.restores.push(sp.restore);
    if (seam < D - 0.5) sp.edge = [0, D];
    return slidePlates(run, sp, 0, D, 0, D / 2, false).anims;
  });
  const phase1End = Math.max(PHASE_DUR, CARRIAGE_LAG + CARRIAGE_DUR);

  let base: number | null = null, entry: Animation | null = null, gapOver = false, started = false, settled = false, ended = false;
  const end = () => { if (settled && ended) finish(app, run); };
  const go = () => {
    if (!run.changed || started || !canStart(gapOver, base)) return;
    started = true;
    const list = entry ? [entry] : [];
    const w = launch(run, list, base, phase1End + PHASE_GAP);
    whenDone(run, list, w + PHASE_DUR, () => { ended = true; end(); });
  };
  // rail / workspace / footer が 1 段目の行き先に着いたら change(新しい配置 = 行き先なので、止めても画面上は動かない)
  const p1Done = doneFlag(p1);
  whenHidden(run, PHASE_DUR, phase1End + PHASE_GAP, () => p1Done.v, () => {
    base = startOf(p1[0]);
    doChange(run);
    cancelAll(p1);
    const sb = zoneOf(app, 'sidebar');
    if (sb) {
      const a = app.getBoundingClientRect(), s = sb.getBoundingClientRect();
      entry = held(run, sb, frames(-(s.right - a.left + OUT), 0, 0, 0), { duration: PHASE_DUR, fill: 'both' });
    }
    // ヘッダー・通気口は、描き直しが済み、左の板・台車が着ききってから本物に戻す(複製は新しい配置と同じ位置に止まる)
    whenSettled(run, probes, () => whenDone(run, plateAnims, 0, () => { settled = true; run.restores.forEach((r) => r()); end(); }));
    go();
  });
  later(run, phase1End + PHASE_GAP, () => { gapOver = true; go(); });
}

/** ヘッダーを開く: 通気口とタイムラインが一緒に下がる → 上に下地 → ヘッダーが上から下りる */
function headerOpen(app: HTMLElement, run: Run, hdr: HTMLElement) {
  // change 前(行の高さ 0)なので、動く量はヘッダーの高さ(102 × 縮小率)
  const D = HDR_H * hsOf(app);
  const p1 = zonesOf(app, ['vent', 'workspace']).map((z) => play(run, z, frames(0, 0, 0, D), { duration: PHASE_DUR, fill: 'forwards' }));
  let base: number | null = null, entry: Animation | null = null, gapOver = false, started = false;
  const go = () => {
    if (!run.changed || started || !entry || !canStart(gapOver, base)) return;
    started = true;
    const w = launch(run, [entry], base, PHASE_DUR + PHASE_GAP);
    whenDone(run, [entry], w + PHASE_DUR, () => finish(app, run));
  };
  const p1Done = doneFlag(p1);
  whenHidden(run, PHASE_DUR, PHASE_DUR + PHASE_GAP, () => p1Done.v, () => {
    base = startOf(p1[0]);
    doChange(run);
    cancelAll(p1);
    const a = app.getBoundingClientRect(), r = hdr.getBoundingClientRect();
    entry = held(run, hdr, frames(0, -(r.bottom - a.top + OUT), 0, 0), { duration: PHASE_DUR, fill: 'both' });
    go();
  });
  later(run, PHASE_DUR + PHASE_GAP, () => { gapOver = true; go(); });
}

/** ヘッダーを閉じる: ヘッダー(本物)が上へ抜ける → 下地 → 通気口とタイムラインが上がる */
function headerClose(app: HTMLElement, run: Run, hdr: HTMLElement) {
  const a = app.getBoundingClientRect(), r = hdr.getBoundingClientRect();
  const keep = zonesOf(app, ['vent', 'workspace']);
  const before = new Map(keep.map((z) => [z, z.getBoundingClientRect().top]));
  const p1 = [play(run, hdr, frames(0, 0, 0, -(r.bottom - a.top + OUT)), { duration: PHASE_DUR, fill: 'forwards' })];
  let base: number | null = null, gapOver = false, started = false;
  const wait: Animation[] = [];
  const go = () => {
    if (!run.changed || started || !canStart(gapOver, base)) return;
    started = true;
    const w = launch(run, wait, base, PHASE_DUR + PHASE_GAP);
    whenDone(run, wait, w + PHASE_DUR, () => finish(app, run));
  };
  // ヘッダーが画面の上へ抜けきったら change。通気口・タイムラインは新しい配置で元の位置に止めておく
  whenHidden(run, PHASE_DUR * 0.4, PHASE_DUR, () => hdr.getBoundingClientRect().bottom <= app.getBoundingClientRect().top + 0.5, () => {
    base = startOf(p1[0]);
    doChange(run);
    cancelAll(p1);
    keep.forEach((z) => {
      const dy = before.get(z)! - z.getBoundingClientRect().top;
      if (Math.abs(dy) >= 0.5) wait.push(held(run, z, frames(0, dy, 0, 0), { duration: PHASE_DUR, fill: 'both' }));
    });
    go();
  });
  later(run, PHASE_DUR + PHASE_GAP, () => { gapOver = true; go(); });
}
