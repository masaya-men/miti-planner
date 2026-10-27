/** 区画の複製(残像)と、継ぎ目での左右の切り分け */
import { CLIP_PAD, PAD } from './motion';
import { dimOf, mirrors, registerMirror, syncMirrors } from './mirror';

/** 光エンジン(engine.ts)が経路として拾う属性。複製からは外す */
const TRACE_ATTRS = ['data-trace', 'data-trace-pc', 'data-trace-next', 'data-trace-end', 'data-bus'];

/** 区画とその親(app)の画面上の矩形。複製を何枚も作る前に 1 回だけ読む(読むたびに配置の再計算が走るため) */
export type Box = { a: DOMRect; r: DOMRect };
export const boxOf = (zone: HTMLElement): Box => ({ a: zone.parentElement!.getBoundingClientRect(), r: zone.getBoundingClientRect() });

let cloneSeq = 0;
const REF_ATTRS = ['fill', 'stroke', 'clip-path', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end', 'style', 'href', 'xlink:href'];
/** REF_ATTRS のどれかに参照(url(# / #)を持ちうる要素 */
const REF_SELECTOR = ['fill', 'stroke', 'marker-start', 'marker-mid', 'marker-end', 'style'].map((a) => `[${a}*="url("]`)
  .concat(['[clip-path]', '[mask]', '[filter]', '[href^="#"]', '[*|href^="#"]']).join(',');
/** 複製の中の id を複製ごとに付け直し、url(#…) / href="#…" の参照も付け直した id へ向ける。
 *  そのままだと参照は文書で先に出る本物の定義(pattern・clipPath・mask)を指す。本物の区画は visibility: hidden なので
 *  pattern の中身・clipPath の形も描かれず(網・基板が消える)、配置が変わった後の本物の形で切られてしまう */
function renameIds(c: HTMLElement) {
  const withId = c.querySelectorAll<Element>('[id]');
  if (!withId.length) return;
  const n = ++cloneSeq, map = new Map<string, string>();
  withId.forEach((e) => { const nu = `${e.id}--ms${n}`; map.set(e.id, nu); e.id = nu; });
  const fix = (v: string) => v.replace(/url\((['"]?)#([^'")]+)\1\)/g, (m, q: string, id: string) => (map.has(id) ? `url(${q}#${map.get(id)}${q})` : m));
  // 参照を持つ要素だけを走査する(全要素 約 7k を毎回なめない)。id を持つ要素(pattern 等の中の参照)は含める
  let found: Iterable<Element>;
  try { found = c.querySelectorAll(REF_SELECTOR); } catch { found = c.querySelectorAll('*'); } // 名前空間つき属性の選択子が使えない環境(テストの代役)では全走査
  const targets = new Set<Element>(found);
  withId.forEach((e) => targets.add(e));
  targets.forEach((e) => {
    for (const name of REF_ATTRS) {
      const v = e.getAttribute(name);
      if (!v || !v.includes('#')) continue;
      const nv = name.endsWith('href') ? (v.startsWith('#') && map.has(v.slice(1)) ? `#${map.get(v.slice(1))}` : v) : fix(v);
      if (nv !== v) e.setAttribute(name, nv);
    }
  });
}

/** 区画の複製。格子に乗らないよう絶対配置にし、触れず・読み上げず・光エンジンにも拾われないようにする */
export function cloneZone(zone: HTMLElement, part: string, { a, r }: Box): HTMLElement {
  const c = zone.cloneNode(true) as HTMLElement;
  renameIds(c);
  registerMirror(zone, c);
  c.removeAttribute('data-ms-zone');
  c.setAttribute('data-zone', zone.getAttribute('data-ms-zone') ?? '');
  c.classList.add('milspec-split');
  c.setAttribute('data-split', part);
  c.setAttribute('aria-hidden', 'true');
  c.setAttribute('inert', '');
  c.querySelectorAll(TRACE_ATTRS.map((n) => `[${n}]`).join(',')).forEach((e) => TRACE_ATTRS.forEach((n) => e.removeAttribute(n)));
  // 光エンジンが本物に足した走行中の粒は、複製では止まった点になるので持ち込まない
  c.querySelectorAll('.milspec-pz-g, .milspec-pz-c').forEach((e) => e.remove());
  Object.assign(c.style, {
    position: 'absolute', gridArea: 'auto', margin: '0', pointerEvents: 'none', zIndex: '1', visibility: '',
    left: `${r.left - a.left}px`, top: `${r.top - a.top}px`, width: `${r.width}px`, height: `${r.height}px`,
  });
  return c;
}
/** 継ぎ目(区画の左端から・画面 px)。数値 = 縦 1 本の線(通気口・フッター)。
 *  配列 = 帯ごとの階段(ヘッダー。上の板の切れ目が 外枠 700 / 上段 714 / 下段 683 と段違いなので、
 *  1 本線で切ると右の複製に左の板の切れ端が残り、窓の中に静止して見える) */
export type Seam = number | { x: number; y0: number; y1: number }[];
export const px = (v: number) => `${Math.round(v * 1000) / 1000}px`;
/** 階段の多角形。outer = 階段の反対側の辺の x(左の複製 = −CLIP_PAD / 右の複製 = 区画の幅 + CLIP_PAD)。
 *  左右で同じ階段の点列を共有するので、合わせ目に隙間も重なりもできない。上下の端は CLIP_PAD だけ外へ広げる */
export function stairPolygon(seam: { x: number; y0: number; y1: number }[], outer: number, h: number): string {
  const pts: [number, number][] = [[outer, -CLIP_PAD]];
  seam.forEach((b, i) => {
    pts.push([b.x, i === 0 ? -CLIP_PAD : b.y0], [b.x, i === seam.length - 1 ? h + CLIP_PAD : b.y1]);
  });
  pts.push([outer, h + CLIP_PAD]);
  return `polygon(${pts.map(([x, y]) => `${px(x)} ${px(y)}`).join(', ')})`;
}
const leftClip = (seam: Seam, { r }: Box) =>
  typeof seam === 'number' ? `inset(${PAD} calc(100% - ${seam}px) ${PAD} ${PAD})` : stairPolygon(seam, -CLIP_PAD, r.height);
const rightClip = (seam: Seam, { r }: Box) =>
  typeof seam === 'number' ? `inset(${PAD} ${PAD} ${PAD} ${seam}px)` : stairPolygon(seam, r.width + CLIP_PAD, r.height);

/** 右の複製: 継ぎ目より右だけ。台車は別の複製が持つので外す */
function rightClone(zone: HTMLElement, seam: Seam, box: Box): HTMLElement {
  const c = cloneZone(zone, 'right', box);
  c.querySelector('[data-vent-carriage]')?.remove();
  // ヘッダー: 左の板の縁の影(near-l / far-l)は滑る専用の 1 枚(shadowFollow)が持つ。ここに残すと二重になる
  if (Array.isArray(seam)) c.querySelectorAll('[data-sh="near-l"], [data-sh="far-l"]').forEach((e) => e.remove());
  c.style.clipPath = rightClip(seam, box);
  return c;
}

export interface SplitZone {
  left: HTMLElement; right: HTMLElement; carriage: HTMLElement | null; restore(): void;
  /** 右の複製の見える左端を動かす範囲(区画の左端から sx → ex)。継ぎ目が板の移動量より右なら不要(null)。
   *  階段の継ぎ目(ヘッダー)では常に null(継ぎ目 ≥ 移動量。edgeFrames は inset の 1 本線しか動かせない) */
  edge?: [number, number] | null;
}

/** 区画を隠し、その上に複製を置く。左は継ぎ目 seam(区画の左端から・画面 px。配列なら帯ごとの階段)より左だけ、右は継ぎ目より右だけを見せる。
 *  通気口のときは、台車([data-vent-carriage])を左右の複製から除き、台車だけの複製を carriage として返す。
 *  重なり順は 右 → 左 → 台車(左の板は右の上を滑る)。 */
export function splitZone(zone: HTMLElement, seam: Seam, box: Box = boxOf(zone)): SplitZone {
  const host = zone.parentElement!;
  const right = rightClone(zone, seam, box);
  const left = cloneZone(zone, 'left', box);
  left.querySelector('[data-vent-carriage]')?.remove();
  left.style.clipPath = leftClip(seam, box);
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
    left, right, carriage, edge: null,
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
export function swapRight(sp: SplitZone, zone: HTMLElement, seam: Seam, box: Box) {
  const n = rightClone(zone, seam, box);
  sp.left.before(n);
  sp.right.remove();
  sp.right = n;
  syncMirrors();
}
