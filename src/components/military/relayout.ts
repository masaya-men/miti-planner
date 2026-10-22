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
import { HDR_FRAME, HDR_H, RAIL_MARGIN, SIDEBAR_SPAN, VENT_PLATE_X } from './headerGeometry';

/** 1 つの動き・ずらす間・台車の遅れ・台車の走行(ms。見本 v3 で masaya が選んだ値) */
export const PHASE_DUR = 420, PHASE_GAP = 80, CARRIAGE_LAG = 60, CARRIAGE_DUR = 480;

type Kind = 'hdr' | 'sb';
const EASE = 'cubic-bezier(.2,0,.15,1)';
const CAR_EASE = 'cubic-bezier(.45,0,.3,1)';
/** 通気口の左の板の右端(溝 chanL の左端・ventLayout の chanL.x) */
const VENT_SEAM = VENT_PLATE_X;
/** 抜ける / 入る区画が画面の外へ出きる余白(見本の +4) */
const OUT = 4;
/** 複製の切り口以外の辺は、影・突起を切らないよう外側へ広げて切る */
const CLIP_PAD = 16;
/** 描き直しを待つ最大コマ数(これを過ぎたら待たずに進む) */
const SETTLE_MAX_FRAMES = 30;
/** 描き直しが済んだかを確かめる右端の部品(どれも開閉の前後で区画の右端からの位置が同じ)。
 *  footer / workspace は装甲の SVG(ResizeObserver で描き直す)の右端 */
const PROBES: Partial<Record<string, string>> = {
  header: '.milspec-mlv', vent: '[data-vent-rail]', footer: '.milspec-armor-panel', workspace: '.milspec-armor-panel',
};
/** フッターの継ぎ目: 左寄せの文字(著作権の 1 行)の右端から 12px 右(右のリンクとの間の無地) */
const FOOTER_TEXT = '.milspec-flink.static';
const FOOTER_SEAM_GAP = 12;
/** 表の区画の継ぎ目(区画の左端から。MilspecWorkspace の TABLE_FRAME.sx = 600)。これより右の装甲は右端基準 */
const WS_SEAM = 600;
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

// ---------------------------------------------------------------- 複製に写した電源投入の演出

/** 複製の暗幕・ランプを本物に毎コマ合わせる。電源投入の演出(power.ts の暗幕の animate・lampSequence のランプ)は
 *  本物にだけ付くので、複製のままでは止まって見え、本物に戻した瞬間に明るさが飛ぶ。
 *  暗幕は「本物の暗幕がいま覆っている画面上の範囲」を複製の位置に直して覆う(滑る板と一緒に帯の縁が動かないように)。
 *  台車の複製の暗幕は台車の範囲だけを覆う(右の複製の暗幕と二重にならないように) */
interface DimPair { real: HTMLElement; copy: HTMLElement; within: HTMLElement | null }
interface Mirror { dims: DimPair[]; leds: [HTMLElement, HTMLElement][]; seen: boolean; mo: MutationObserver | null }
const mirrors = new Map<HTMLElement, Mirror>();
let mirrorRaf = 0;
const dimOf = (el: Element): HTMLElement | null =>
  ([...el.children].find((k) => k.classList.contains('milspec-dim')) as HTMLElement | undefined) ?? null;

/** clip-path の inset(...) を 上・右・下・左 の px に直す(% は暗幕の大きさ基準。calc(a% + bpx) も読む) */
function insetPx(v: string, w: number, h: number): [number, number, number, number] {
  const m = /^inset\((.*)\)$/.exec(v.trim());
  if (!m) return [0, 0, 0, 0];
  const body = m[1].split(/\sround\s/)[0];
  const parts: string[] = [];
  let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) parts.push(cur);
  const [t = '0', r = t, b = t, l = r] = parts;
  const len = (s: string, size: number) => {
    let sum = 0;
    for (const [, sign, num, unit] of s.matchAll(/([+-]?)\s*(\d*\.?\d+)(px|%)?/g)) sum += (sign === '-' ? -1 : 1) * Number(num) * (unit === '%' ? size / 100 : 1);
    return sum;
  };
  return [len(t, h), len(r, w), len(b, h), len(l, w)];
}

function syncMirror(m: Mirror) {
  for (const d of m.dims) {
    if (!d.copy.isConnected) continue;
    const cs = getComputedStyle(d.real);
    d.copy.style.opacity = cs.opacity;
    const R = d.real.getBoundingClientRect();
    const [t, r, b, l] = insetPx(cs.clipPath || 'none', R.width, R.height);
    let L = R.left + l, T = R.top + t, Rt = R.right - r, B = R.bottom - b;
    if (d.within) {
      const w = d.within.getBoundingClientRect();
      L = Math.max(L, w.left); T = Math.max(T, w.top); Rt = Math.min(Rt, w.right); B = Math.min(B, w.bottom);
    }
    if (Rt <= L || B <= T) { d.copy.style.clipPath = 'inset(50%)'; continue; }
    const C = d.copy.getBoundingClientRect();
    d.copy.style.clipPath = `inset(${T - C.top}px ${C.right - Rt}px ${C.bottom - B}px ${L - C.left}px)`;
  }
  for (const [real, copy] of m.leds) if (copy.isConnected && copy.className !== real.className) copy.className = real.className;
}
/** 全ての複製を本物に合わせる。消えた複製は登録から外す(作った直後・まだ置く前のものは残す) */
function syncMirrors() {
  for (const [root, m] of mirrors) {
    if (root.isConnected) { m.seen = true; syncMirror(m); } else if (m.seen) { m.mo?.disconnect(); mirrors.delete(root); }
  }
  // 次のコマも合わせる(呼ばれるたびに予約し直す。予約が捨てられても止まらないように)
  if (typeof requestAnimationFrame !== 'function') return;
  if (mirrorRaf) cancelAnimationFrame(mirrorRaf);
  mirrorRaf = mirrors.size ? requestAnimationFrame(() => { mirrorRaf = 0; syncMirrors(); }) : 0;
}
/** 複製を作ったときに、本物との対応(暗幕・ランプ)を登録する */
function registerMirror(zone: HTMLElement, clone: HTMLElement) {
  const real = dimOf(zone), copy = dimOf(clone);
  const rl = zone.querySelectorAll<HTMLElement>('.milspec-led'), cl = clone.querySelectorAll<HTMLElement>('.milspec-led');
  const m: Mirror = {
    dims: real && copy ? [{ real, copy, within: null }] : [],
    leds: [...rl].map((e, i) => [e, cl[i]] as [HTMLElement, HTMLElement]).filter(([, c]) => !!c),
    seen: false, mo: null,
  };
  // ランプの点灯(タイマーで class が変わる)と電源の切替(<html data-ms-power>)は、次のコマを待たずにその場で写す
  if (typeof MutationObserver === 'function' && (m.leds.length || m.dims.length)) {
    m.mo = new MutationObserver(() => { if (clone.isConnected) syncMirror(m); });
    m.mo.observe(zone, { subtree: true, attributes: true, attributeFilter: ['class'] });
    m.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ms-power'] });
  }
  mirrors.set(clone, m);
}

/** 区画とその親(app)の画面上の矩形。複製を何枚も作る前に 1 回だけ読む(読むたびに配置の再計算が走るため) */
export type Box = { a: DOMRect; r: DOMRect };
const boxOf = (zone: HTMLElement): Box => ({ a: zone.parentElement!.getBoundingClientRect(), r: zone.getBoundingClientRect() });

/** 区画の複製。格子に乗らないよう絶対配置にし、触れず・読み上げず・光エンジンにも拾われないようにする */
function cloneZone(zone: HTMLElement, part: string, { a, r }: Box): HTMLElement {
  const c = zone.cloneNode(true) as HTMLElement;
  // 光の帯(電源投入の演出。animate は複製に写らず止まって見える)は外し、暗幕・ランプは本物に合わせ続ける
  c.querySelectorAll('.milspec-sweep').forEach((e) => e.remove());
  registerMirror(zone, c);
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
    // 台車とその祖先だけを残す(格子・溝・レールは右の複製が持つ)。暗幕は残し、台車の範囲だけを覆わせる
    const car = carriage.querySelector<HTMLElement>('[data-vent-carriage]');
    const dim = dimOf(carriage);
    for (let n = car; n && n !== carriage; n = n.parentElement) {
      const keep = n;
      [...keep.parentElement!.children].forEach((sib) => { if (sib !== keep && sib !== dim) sib.remove(); });
    }
    mirrors.get(carriage)?.dims.forEach((d) => { d.within = car; });
  }
  host.append(right, left);
  if (carriage) host.append(carriage);
  syncMirrors();
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
  syncMirrors();
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
/** change() の後は、複製の暗幕・ランプを新しい配置の本物にその場で合わせる(次のコマまで古い範囲が残らないように) */
const doChange = (run: Run) => { if (!run.changed) { run.changed = true; run.change(); syncMirrors(); } };
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
    const r = e.getBoundingClientRect(), zr = z.getBoundingClientRect();
    out.push([z, sel, r.right - zr.right, r.top - zr.top]);
  }
  return out;
}
function whenSettled(run: Run, probes: [HTMLElement, string, number, number][], fn: () => void) {
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

/** そのままの形で滑る区画(workspace は右端の縁を pinWorkspaceEdge で留める) */
const SLIDE_ZONES = ['rail', 'workspace'] as const;
const zonesOf = (app: HTMLElement, names: readonly string[]) =>
  names.map((n) => zoneOf(app, n)).filter((z): z is HTMLElement => !!z);
/** サイドバーの開閉で切り分ける区画(閉じたヘッダーは見えないので切らない) */
function splitTargets(app: HTMLElement): HTMLElement[] {
  const h = zoneOf(app, 'header'), v = zoneOf(app, 'vent'), f = zoneOf(app, 'footer');
  return [h && !h.hasAttribute('data-collapsed') ? h : null, v, f].filter((z): z is HTMLElement => !!z);
}
/** 継ぎ目(区画の左端から・画面 px)。左寄せの部品は開閉の前後で区画の左端からの位置が同じなので、どちらの配置で測ってもよい */
function seamOf(app: HTMLElement, z: HTMLElement): number {
  const name = z.getAttribute('data-ms-zone');
  if (name === 'footer') {
    const t = z.querySelector(FOOTER_TEXT), zr = z.getBoundingClientRect();
    return t ? t.getBoundingClientRect().right - zr.left + FOOTER_SEAM_GAP : zr.width / 2;
  }
  return (name === 'vent' ? VENT_SEAM : HDR_FRAME.sx) * hsOf(app);
}

/** 区画の右端で終わる「切り抜きの箱」(表の見出しの行・スクロールする本体)。中身は左寄せで、この箱の右端で切れる。
 *  区画の右端から 40px 以内(区画の右端ちょうどは画面の端なので除く)で終わる、幅の広い overflow の箱。入れ子は外側だけ */
function rightClipBoxes(z: HTMLElement): { el: HTMLElement; sb: number }[] {
  const zr = z.getBoundingClientRect();
  const out: { el: HTMLElement; sb: number }[] = [];
  for (const el of z.querySelectorAll<HTMLElement>('*')) {
    if (out.some((b) => b.el.contains(el))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < zr.width / 2 || r.right < zr.right - 40 || r.right > zr.right - 0.5) continue;
    const st = getComputedStyle(el);
    if (st.overflowX === 'visible' && st.overflowY === 'visible') continue;
    // 縦のスクロールバーの幅(箱の右端にあり、右端基準)
    out.push({ el, sb: Math.max(0, el.offsetWidth - el.clientWidth) });
  }
  return out;
}
interface EdgePin { boxes: { el: HTMLElement; sb: number }[]; swap(dx: number): void; restore(): void }
/** 表の区画(workspace)の右端の縁を画面に留める。表(Timeline)は重いので複製せず、本物の区画をそのまま滑らせる。
 *  - 本物の装甲・縁の暗がりは継ぎ目(WS_SEAM)より左だけを見せる(=左の板)
 *  - 継ぎ目より右の装甲(右の縁・右下の切り欠き)とスクロールバーは、本物の区画の「下」に置いた静止した複製が見せる
 *    (複製の表の中身は隠す。本物の表の中身はその上を滑る。切り欠きの外は複製も本物も描かないので下地が見える)
 *  - 右端で切れる箱(見出しの行・スクロールする本体)は、見える右端が画面上で動かないよう clip を区画の動きと逆に動かす(boxClips)
 *  - 右上の印(scr-mark.tr)は中身より上に描くので、静止した印の複製を上に置く */
function pinWorkspaceEdge(z: HTMLElement): EdgePin {
  const app = z.parentElement!;
  // --- 読む(DOM を変える前に全部読む。読むたびに配置の再計算が走らないように)
  const boxes = rightClipBoxes(z);
  /** スクロールバーを持つ箱の、区画の左上からの位置・大きさ・スクロール量(下の複製で同じスクロールバーを出す) */
  const scrollInfo = () => {
    const zr = z.getBoundingClientRect();
    return boxes.filter(({ el }) => /auto|scroll/.test(getComputedStyle(el).overflowY || getComputedStyle(el).overflow)
      && (el.offsetWidth > el.clientWidth || el.offsetHeight > el.clientHeight)).map(({ el }) => {
      const r = el.getBoundingClientRect(), st = getComputedStyle(el);
      return {
        cls: el.className, left: r.left - zr.left, top: r.top - zr.top, width: r.width, height: r.height,
        sw: el.scrollWidth, sh: el.scrollHeight, sl: el.scrollLeft, stp: el.scrollTop, ox: st.overflowX, oy: st.overflowY,
      };
    });
  };
  const zr0 = z.getBoundingClientRect(), a0 = app.getBoundingClientRect();
  const armor = [...z.querySelectorAll<HTMLElement>('.milspec-tbl-armor > .milspec-armor, .milspec-tbl-armor > .milspec-vig')]
    .map((el) => ({ el, seam: WS_SEAM - (el.getBoundingClientRect().left - zr0.left) }));
  const marks = [...z.querySelectorAll<HTMLElement>('.milspec-scr-mark.tr')].map((m) => ({ m, r: m.getBoundingClientRect() }));
  const info0 = scrollInfo(), box0 = boxOf(z);

  /** 下に置く静止した複製: 装甲(継ぎ目より右)と、スクロールバーの代わりの空の箱だけ。表の中身は持たない(軽く保つ) */
  const makeBase = (box: Box, info: ReturnType<typeof scrollInfo>): HTMLElement => {
    const b = cloneZone(z, 'base', box);
    b.style.zIndex = 'auto';
    b.style.clipPath = `inset(${PAD} ${PAD} ${PAD} ${WS_SEAM}px)`;
    [...b.children].forEach((c) => { if (!c.classList.contains('milspec-tbl-armor')) c.remove(); });
    // 作り直し(swap)のときは、本物に付けた「継ぎ目より左だけ」を持ち込まない
    b.querySelectorAll<HTMLElement>('.milspec-tbl-armor > .milspec-armor, .milspec-tbl-armor > .milspec-vig').forEach((el) => { el.style.clipPath = ''; });
    const stand = info.map((s) => {
      const c = document.createElement('div');
      c.className = s.cls;
      Object.assign(c.style, {
        position: 'absolute', left: `${s.left}px`, top: `${s.top}px`, width: `${s.width}px`, height: `${s.height}px`,
        overflowX: s.ox, overflowY: s.oy, flex: 'none', margin: '0',
      });
      const pad = document.createElement('div');
      Object.assign(pad.style, { width: `${s.sw}px`, height: `${s.sh}px`, visibility: 'hidden' });
      c.append(pad);
      b.append(c);
      return c;
    });
    z.before(b); // 本物の区画より下に描く
    stand.forEach((c, i) => { if (info[i].stp) c.scrollTop = info[i].stp; if (info[i].sl) c.scrollLeft = info[i].sl; });
    return b;
  };

  // --- 書く
  let base = makeBase(box0, info0);
  const undo: (() => void)[] = [];
  // 本物の装甲・縁の暗がり: 継ぎ目より左だけ
  armor.forEach(({ el, seam }) => {
    const prev = el.style.clipPath;
    el.style.clipPath = `inset(${PAD} calc(100% - ${seam}px) ${PAD} ${PAD})`;
    undo.push(() => { el.style.clipPath = prev; });
  });
  // 右上の印: 静止した複製を上に置き、本物は隠す
  marks.forEach(({ m, r }) => {
    const c = m.cloneNode(true) as HTMLElement;
    c.classList.add('milspec-split');
    c.setAttribute('data-split', 'mark');
    Object.assign(c.style, { left: `${r.left - a0.left}px`, top: `${r.top - a0.top}px`, right: 'auto', bottom: 'auto' });
    app.append(c);
    const prev = m.style.visibility;
    m.style.visibility = 'hidden';
    undo.push(() => { c.remove(); m.style.visibility = prev; });
  });
  let done = false;
  return {
    boxes,
    // 描き直しが済んだ新しい配置で下の複製を作り直す(dx = いま区画を止めているずれ。複製は動かない位置に置く)
    swap(dx) {
      const box = boxOf(z), info = scrollInfo();
      const r = box.r;
      const nb = makeBase({ a: box.a, r: new DOMRect(r.x - dx, r.y, r.width, r.height) }, info);
      base.remove();
      base = nb;
    },
    restore() {
      if (done) return;
      done = true;
      base.remove();
      undo.forEach((u) => u());
    },
  };
}
/** 右端で切れる箱の見える右端を、区画のずれ sx → ex と同じ動きで切り詰め、画面上の右端(スクロールバーの左)を動かさない */
function boxClips(run: Run, pin: EdgePin, sx: number, ex: number, paused: boolean, fill: FillMode): Animation[] {
  const mk = paused ? held : play;
  return pin.boxes.map(({ el, sb }) => {
    // スクロールバーのある箱は、行き過ぎ(区画が終わりより 1.8px 左)の間も本物のスクロールバーを見せない(切り詰めは sb 以上)
    const xs = steps(sx + sb, ex + sb).map((x) => (sb > 0 ? Math.max(x, sb) : x));
    return mk(run, el, STEP_TIMING.map((k, i) => ({ clipPath: `inset(${PAD} ${xs[i]}px ${PAD} ${PAD})`, ...k })), { duration: PHASE_DUR, fill });
  });
}

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

/** 台車の画面上の走行量 = レールの長さ − 台車の幅 − 両端の余白(狭い画面では headerGeometry の ventCarriageRun で縮む)。
 *  レールは開閉で画面上不動なので、どちらの状態で測っても同じ。測れなければサイドバーぶんの半分 */
function carriageTravel(app: HTMLElement): number {
  const v = zoneOf(app, 'vent');
  const rail = v?.querySelector('[data-vent-rail]'), car = v?.querySelector('[data-vent-carriage]');
  const w = rail && car ? rail.getBoundingClientRect().width - car.getBoundingClientRect().width - 2 * RAIL_MARGIN * hsOf(app) : 0;
  return w > 0.5 ? w : SIDEBAR_SPAN / 2;
}

/** サイドバーを閉じる: サイドバーだけ左へ抜ける → 下地 → 他の区画と左の板が滑り込む(台車はレールを走る) */
function sidebarClose(app: HTMLElement, run: Run, sb: HTMLElement) {
  const a = app.getBoundingClientRect(), s = sb.getBoundingClientRect();
  const slides = zonesOf(app, SLIDE_ZONES);
  const before = new Map(slides.map((z) => [z, z.getBoundingClientRect().left]));
  const targets = splitTargets(app);
  const seams = new Map(targets.map((z) => [z, seamOf(app, z)]));
  const ws = zoneOf(app, 'workspace');
  const probes = captureProbes(ws ? [...targets, ws] : targets);
  const travel = carriageTravel(app);
  const p1 = [play(run, sb, frames(0, 0, -(s.right - a.left + OUT), 0), { duration: PHASE_DUR, fill: 'forwards' })];

  let base: number | null = null, D = 0, settled = false, gapOver = false, started = false;
  let wait: Animation[] = [], plates: ReturnType<typeof slidePlates>[] = [];
  const edges: Animation[] = [];
  let pin: EdgePin | null = null;
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
    // 表の区画は右端の縁を留める(change 前の配置で。DOM を変える前に読むので切り分けより先)
    if (ws) { pin = pinWorkspaceEdge(ws); run.restores.push(pin.restore); }
    const splits = targets.map((z, i) => splitZone(z, seams.get(z)!, boxes[i]));
    run.restores.push(...splits.map((sp) => sp.restore));
    base = startOf(p1[0]);
    doChange(run);
    cancelAll(p1);
    slides.forEach((z) => { D = Math.max(D, before.get(z)! - z.getBoundingClientRect().left); });
    if (D < 0.5) D = SIDEBAR_SPAN;
    // rail / workspace / footer は新しい配置で +D(= 元の画面位置)に止めておき、2 段目の開始で一斉に動かす
    wait = slides.map((z) => held(run, z, frames(D, 0, 0, 0), { duration: PHASE_DUR, fill: 'both' }));
    if (pin) wait.push(...boxClips(run, pin, D, 0, true, 'both'));
    plates = splits.map((sp) => slidePlates(run, sp, 0, -D, 0, -travel, true));
    whenSettled(run, probes, () => {
      const bx = targets.map(boxOf);
      targets.forEach((z, i) => {
        const seam = seams.get(z)!;
        swapRight(splits[i], z, seam, bx[i]);
        // 継ぎ目が移動量より左(通気口): 右の複製(溝)の見える左端を板の左端と一緒に動かす。新しい配置では D → 0
        if (seam < D - 0.5) edges.push(held(run, splits[i].right, edgeFrames(D, 0), { duration: PHASE_DUR, fill: 'both' }));
      });
      pin?.swap(D);
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
  const ws = zoneOf(app, 'workspace');
  const probes = captureProbes(ws ? [...targets, ws] : targets);
  const travel = carriageTravel(app);
  const pin = ws ? pinWorkspaceEdge(ws) : null;
  if (pin) run.restores.push(pin.restore);
  const p1 = zonesOf(app, SLIDE_ZONES).map((z) => play(run, z, frames(0, 0, D, 0), { duration: PHASE_DUR, fill: 'forwards' }));
  if (pin) p1.push(...boxClips(run, pin, 0, D, false, 'forwards'));
  const plateAnims = targets.flatMap((z) => {
    const seam = seamOf(app, z);
    const sp = splitZone(z, seam);
    run.restores.push(sp.restore);
    if (seam < D - 0.5) sp.edge = [0, D];
    return slidePlates(run, sp, 0, D, 0, travel, false).anims;
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
