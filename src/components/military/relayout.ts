/** ヘッダー / サイドバーの開閉で他の区画を滑らせる動き(見本 milspec-v11.js の relayout js:763-781 をそのまま移植)。
 *  閉じるとき: 対象区画の複製(残像)が、隣の区画と同じ距離だけ抜けていく(隣の縁にくっついたまま)。
 *  開くとき: 対象区画自身が、隣の区画と同じ距離だけ手前から入って収まる。
 *  残像/対象区画と 通気口・workspace・footer・rail は 同じ 620ms・同じ easing・同じ開始時刻で一体に動く
 *  (取っ手のある vent / rail が別の区画の上に重ならない)。少し行き過ぎて止まる質感は共通の keyframe で保つ。 */

/** 滑らせる区画(見本 keep の #z-vent / #z-ftr / #z-rail と、本番の workspace)。 */
const KEEP_ZONES = ['vent', 'workspace', 'footer', 'rail'] as const;

const zoneOf = (app: HTMLElement, name: string): HTMLElement | null =>
  app.querySelector<HTMLElement>(`[data-ms-zone="${name}"]`);

export function relayoutZones(app: HTMLElement, change: () => void, kind: 'hdr' | 'sb', reduced: boolean): void {
  const src = zoneOf(app, kind === 'hdr' ? 'header' : 'sidebar');
  // 動きを減らす / 区画が無い: 即時に切り替えるだけ
  if (reduced || !src) { change(); return; }

  const before = new Map<string, DOMRect>();
  for (const n of KEEP_ZONES) { const z = zoneOf(app, n); if (z) before.set(n, z.getBoundingClientRect()); }
  // 閉じる側か: ヘッダーは data-collapsed が無い(= 開いている)、サイドバーは data-open がある(= 開いている)
  const closing = kind === 'hdr' ? !src.hasAttribute('data-collapsed') : src.hasAttribute('data-open');

  // 閉じるとき: 元の位置に複製(残像)を置く。複製は格子に乗らないよう絶対配置にする
  let ghost: HTMLElement | null = null;
  if (closing) {
    const a = app.getBoundingClientRect(), r = src.getBoundingClientRect();
    ghost = src.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('data-ms-zone');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.classList.add('milspec-ghost');
    ghost.setAttribute('inert', '');
    // 光エンジンが経路として拾わないよう、識別属性を複製から外す(engine.ts の data-trace 系と bus)
    ghost.querySelectorAll('[data-trace],[data-trace-pc],[data-trace-next],[data-trace-end],[data-bus]').forEach((e) => {
      ['data-trace', 'data-trace-pc', 'data-trace-next', 'data-trace-end', 'data-bus'].forEach((a) => e.removeAttribute(a));
    });
    Object.assign(ghost.style, {
      position: 'absolute', gridArea: 'auto', pointerEvents: 'none',
      left: `${r.left - a.left}px`, top: `${r.top - a.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    });
    app.append(ghost);
  }

  change();

  const far = kind === 'hdr' ? -112 : -290;

  // 動く距離 D: 隣の区画が実際に動く量(ヘッダー=縦・サイドバー=横)。取れなければ従来値で代用
  const moved = new Map<string, { dx: number; dy: number }>();
  before.forEach((a, n) => {
    const z = zoneOf(app, n);
    if (!z) return;
    const b = z.getBoundingClientRect();
    moved.set(n, { dx: a.left - b.left, dy: a.top - b.top });
  });
  let dist = 0;
  moved.forEach((m) => { const v = Math.abs(kind === 'hdr' ? m.dy : m.dx); if (v > dist) dist = v; });
  if (dist < 0.5) dist = Math.abs(far);

  // 全員が同じ時間・同じ easing・同じ開始時刻で動く(ひとかたまり)。
  // 区画の進み = 開始のずれ s から 0 へ。途中で 1.8px 行き過ぎて 0.5px 戻って止まる(重く抜けて少し行き過ぎる質感)。
  const DUR = 620, EASE = 'cubic-bezier(.2,0,.15,1)';
  const frames = (sx: number, sy: number, endX: number, endY: number): Keyframe[] => {
    const ox = -Math.sign(sx - endX) * 1.8, oy = -Math.sign(sy - endY) * 1.8;
    return [
      { transform: `translate(${sx}px, ${sy}px)`, easing: EASE },
      { transform: `translate(${endX + ox}px, ${endY + oy}px)`, offset: 0.72, easing: 'ease-in-out' },
      { transform: `translate(${endX - ox * 0.28}px, ${endY - oy * 0.28}px)`, offset: 0.87 },
      { transform: `translate(${endX}px, ${endY}px)` },
    ];
  };
  const dirX = kind === 'sb' ? 1 : 0, dirY = kind === 'hdr' ? 1 : 0;
  if (ghost) {
    // 残像は「隣と同じ量」だけ抜ける(隣の縁にくっついたまま・重ならない)
    const g = ghost;
    const a = g.animate(frames(0, 0, -dirX * dist, -dirY * dist), { duration: DUR });
    a.onfinish = () => g.remove();
  } else {
    src.animate(frames(-dirX * dist, -dirY * dist, 0, 0), { duration: DUR });
  }

  moved.forEach((m, n) => {
    const z = zoneOf(app, n);
    if (!z || (Math.abs(m.dx) < 0.5 && Math.abs(m.dy) < 0.5)) return;
    z.animate(frames(m.dx, m.dy, 0, 0), { duration: DUR, fill: 'backwards' });
  });
}
