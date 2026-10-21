// 表の行の描き込み(見本 v11 js:672-676 / css:540-542)。
// 見えている [data-time-row] だけに class を付け直し、上から順に描き込む。最後に効果のアイコンと帯が現れる。
// 全行の位置は測らない: 行は上から順に並ぶので、可視の先頭を二分探索し、そこから下へ可視の間だけ進む。

const STEP = 32;

const prefersReduced = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** container の可視範囲にある行を上から順に返す(行は DOM 順 = 縦の並び順) */
function visibleRows(container: HTMLElement): HTMLElement[] {
  const all = container.querySelectorAll<HTMLElement>('[data-time-row]');
  const box = container.getBoundingClientRect();
  // 下端が可視の上端より下にある最初の行
  let lo = 0, hi = all.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (all[mid].getBoundingClientRect().bottom <= box.top) lo = mid + 1; else hi = mid;
  }
  const out: HTMLElement[] = [];
  for (let i = lo; i < all.length; i++) {
    if (all[i].getBoundingClientRect().top >= box.bottom) break;
    out.push(all[i]);
  }
  return out;
}

/** 行自身の printin が終わったときだけ class を外す(子孫から bubble した animationend は無視) */
function done(this: HTMLElement, e: AnimationEvent): void {
  if (e.target !== e.currentTarget || e.animationName !== 'milspec-printin') return;
  this.classList.remove('milspec-pr');
  this.removeEventListener('animationend', done);
}

/** 前回の描き込みの後始末(再トリガで listener と WAAPI を残さない) */
const running = new WeakMap<HTMLElement, Animation[]>();
const printed = new WeakMap<HTMLElement, HTMLElement[]>();

/** 走っている描き込みを全部やめる(標準へ戻すとき)。行の class / listener / WAAPI を残さない */
export function cancelPrintRows(container: HTMLElement): void {
  printed.get(container)?.forEach((r) => { r.removeEventListener('animationend', done); r.classList.remove('milspec-pr'); });
  running.get(container)?.forEach((a) => a.cancel());
  printed.delete(container);
  running.delete(container);
}

export function printRows(container: HTMLElement, base: number): void {
  if (prefersReduced()) return;
  cancelPrintRows(container);
  const rs = visibleRows(container);
  rs.forEach((r, i) => {
    r.classList.remove('milspec-pr');
    void r.offsetWidth; // アニメを最初から掛け直す(見えている行だけなので強制レイアウトは数十行)
    r.style.setProperty('--d', `${base + i * STEP}ms`);
    r.classList.add('milspec-pr');
    r.addEventListener('animationend', done);
  });
  printed.set(container, rs);
  const anims: Animation[] = [];
  const box = container.getBoundingClientRect();
  container.querySelectorAll<HTMLElement>('[data-mit-icon], [data-mit-bar]').forEach((m) => {
    if (typeof m.animate !== 'function') return;
    // 縦の可視範囲にあるものだけ(画面外の数百個に Animation を作らない)
    const mr = m.getBoundingClientRect();
    if (mr.bottom <= box.top || mr.top >= box.bottom) return;
    // 終点は書かない = アイコン本来の opacity / filter / ホバーの明るさに任せる
    const a = m.animate(
      [{ opacity: 0, filter: 'brightness(2)' }],
      { duration: 360, delay: base + rs.length * STEP + 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
    );
    if (a) anims.push(a);
  });
  running.set(container, anims);
}
