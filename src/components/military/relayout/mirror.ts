// ---------------------------------------------------------------- 複製に写した電源投入の演出

/** 複製の暗幕・ランプを本物に毎コマ合わせる。電源投入の演出(power.ts の暗幕の animate・lampSequence のランプ)は
 *  本物にだけ付くので、複製のままでは止まって見え、本物に戻した瞬間に明るさが飛ぶ。
 *  暗幕は「本物の暗幕がいま覆っている画面上の範囲」を複製の位置に直して覆う(滑る板と一緒に帯の縁が動かないように)。
 *  台車の複製の暗幕は台車の範囲だけを覆う(右の複製の暗幕と二重にならないように) */
interface DimPair { real: HTMLElement; copy: HTMLElement; within: HTMLElement | null }
interface Mirror { dims: DimPair[]; leds: [HTMLElement, HTMLElement][]; seen: boolean; mo: MutationObserver | null }
export const mirrors = new Map<HTMLElement, Mirror>();
let mirrorRaf = 0;
export const dimOf = (el: Element): HTMLElement | null =>
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
export function syncMirrors() {
  for (const [root, m] of mirrors) {
    if (root.isConnected) { m.seen = true; syncMirror(m); } else if (m.seen) { m.mo?.disconnect(); mirrors.delete(root); }
  }
  // 次のコマも合わせる(呼ばれるたびに予約し直す。予約が捨てられても止まらないように)
  if (typeof requestAnimationFrame !== 'function') return;
  if (mirrorRaf) cancelAnimationFrame(mirrorRaf);
  mirrorRaf = mirrors.size ? requestAnimationFrame(() => { mirrorRaf = 0; syncMirrors(); }) : 0;
}
/** 複製を作ったときに、本物との対応(暗幕・ランプ)を登録する */
export function registerMirror(zone: HTMLElement, clone: HTMLElement) {
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
