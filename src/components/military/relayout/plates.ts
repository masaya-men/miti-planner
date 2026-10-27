/** 2 段目に動く部品: 表の区画の右端の縁・切り分けた板と台車・上の板の縁の影 */
import { CARRIAGE_DUR, CARRIAGE_LAG, CLIP_PAD, PAD, PHASE_DUR, STEP_TIMING, carFrames, edgeFrames, frames, steps } from './motion';
import { boxOf, cloneZone, px, stairPolygon } from './split';
import type { Box, SplitZone } from './split';
import { held, play } from './run';
import type { Run } from './run';

/** 表の区画の継ぎ目(区画の左端から。MilspecWorkspace の TABLE_FRAME.sx = 600)。これより右の装甲は右端基準 */
const WS_SEAM = 600;

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
export interface EdgePin { boxes: { el: HTMLElement; sb: number }[]; swap(dx: number): void; restore(): void }
/** 表の区画(workspace)の右端の縁を画面に留める。表(Timeline)は重いので複製せず、本物の区画をそのまま滑らせる。
 *  - 本物の装甲・縁の暗がりは継ぎ目(WS_SEAM)より左だけを見せる(=左の板)
 *  - 継ぎ目より右の装甲(右の縁・右下の切り欠き)とスクロールバーは、本物の区画の「下」に置いた静止した複製が見せる
 *    (複製の表の中身は隠す。本物の表の中身はその上を滑る。切り欠きの外は複製も本物も描かないので下地が見える)
 *  - 右端で切れる箱(見出しの行・スクロールする本体)は、見える右端が画面上で動かないよう clip を区画の動きと逆に動かす(boxClips)
 *  - 右上の印(scr-mark.tr)は中身より上に描くので、静止した印の複製を上に置く */
export function pinWorkspaceEdge(z: HTMLElement): EdgePin {
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
export function boxClips(run: Run, pin: EdgePin, sx: number, ex: number, paused: boolean, fill: FillMode): Animation[] {
  const mk = paused ? held : play;
  return pin.boxes.map(({ el, sb }) => {
    // スクロールバーのある箱は、行き過ぎ(区画が終わりより 1.8px 左)の間も本物のスクロールバーを見せない(切り詰めは sb 以上)
    const xs = steps(sx + sb, ex + sb).map((x) => (sb > 0 ? Math.max(x, sb) : x));
    return mk(run, el, STEP_TIMING.map((k, i) => ({ clipPath: `inset(${PAD} ${xs[i]}px ${PAD} ${PAD})`, ...k })), { duration: PHASE_DUR, fill });
  });
}

/** 切り分けた左の板を sx → ex で滑らせ、台車を csx → cex で走らせる(右の複製は動かさない)。
 *  paused のときは最初の位置で止めておく(launch で一斉に動かす)。moving() で台車のランプ・車輪を動かす */
export function slidePlates(run: Run, sp: SplitZone, sx: number, ex: number, csx: number, cex: number, paused: boolean): { anims: Animation[]; moving(): void } {
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

/** 上の板の縁の影を、滑る左の板の縁に付けて一緒に動かす(見本 v3 の render(): 影は縁のすぐ下 3.5px 濃い + 穴の底へ 18px 薄い)。
 *  本物の影(下の板の SVG)は静止した位置にあるので、本物の区画(= 窓が開いた配置)の影の矩形を測り、
 *  左の板の縁(near-l / far-l)だけを写した 1 枚を左の複製の下・右の複製の上に置く。窓の右の縁(右の板)より右は切るので、
 *  右の板の上には影が乗らない。sx → ex は左の板と同じずれ(この 1 枚は窓が開いた配置の位置が基準なので、左の板の動きに +D を足した向き)。
 *  影の矩形が測れない(テストの代役など)ときは null */
export function shadowFollow(app: HTMLElement, zone: HTMLElement, run: Run, sx: number, ex: number, paused: boolean): Animation | null {
  const g = zone.querySelector('.drw-shadow');
  if (!g) return null;
  const rects = (n: string) => [...g.querySelectorAll<SVGRectElement>(`[data-sh="${n}"]`)]
    .sort((a, b) => Number(a.getAttribute('data-band')) - Number(b.getAttribute('data-band'))).map((e) => e.getBoundingClientRect());
  const nl = rects('near-l'), fl = rects('far-l'), nr = rects('near-r');
  if (!nl.length || nl.length !== fl.length || nl.length !== nr.length) return null;
  const a = app.getBoundingClientRect(), z = zone.getBoundingClientRect();
  const ox = z.left - a.left, oy = z.top - a.top;
  const op = g.getAttribute('opacity') ?? '1';
  const el = document.createElement('div');
  el.classList.add('milspec-split');
  el.setAttribute('data-split', 'shadow');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('inert', '');
  Object.assign(el.style, { position: 'absolute', gridArea: 'auto', margin: '0', pointerEvents: 'none', zIndex: '1', left: `${ox}px`, top: `${oy}px`, width: `${z.width}px`, height: `${z.height}px` });
  // 窓の右の縁(右の板の左の縁)より左だけを見せる階段
  el.style.clipPath = stairPolygon(nr.map((r) => ({ x: r.right - z.left, y0: r.top - z.top, y1: r.bottom - z.top })), -CLIP_PAD, z.height);
  const rect = (r: DOMRect, grad: string) => `<rect x="${px(r.left - z.left)}" y="${px(r.top - z.top)}" width="${px(r.width)}" height="${px(r.height)}" fill="url(#${grad})"/>`;
  const body = nl.map((r, i) => rect(fl[i], 'sh-far-l') + rect(r, 'sh-near-l')).join('');
  // 切り抜き(静止)の中で、この箱だけが滑る
  el.innerHTML = `<div style="position:absolute;inset:0"><svg width="${z.width}" height="${z.height}" style="position:absolute;left:0;top:0;overflow:visible"><g opacity="${op}">${body}</g></svg></div>`;
  const slider = el.firstElementChild as HTMLElement;
  // 左の複製のすぐ下(右の複製の上)に置く
  const left = app.querySelector('[data-split="left"][data-zone="header"]');
  if (left) left.before(el); else app.append(el);
  run.restores.push(() => el.remove());
  if (typeof slider.animate !== 'function') return null;
  return (paused ? held : play)(run, slider, frames(sx, 0, ex, 0), { duration: PHASE_DUR, fill: 'both' });
}
