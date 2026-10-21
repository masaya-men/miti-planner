/** ヘッダーの開閉で他の区画を滑らせる動き(見本 milspec-v11.js の relayout js:763-781 をそのまま移植)。
 *  閉じるとき: ヘッダー区画の複製(残像)が元の位置から重く抜けていく。
 *  開くとき: ヘッダー区画自身が上から降りて収まる(少し行き過ぎて止まる)。
 *  どちらも 通気口・workspace・footer・rail は元の位置から滑って収まる(FLIP)。 */

/** 滑らせる区画(見本 keep の #z-vent / #z-ftr / #z-rail と、本番の workspace)。 */
const KEEP_ZONES = ['vent', 'workspace', 'footer', 'rail'] as const;

const zoneOf = (app: HTMLElement, name: string): HTMLElement | null =>
  app.querySelector<HTMLElement>(`[data-ms-zone="${name}"]`);

export function relayoutZones(app: HTMLElement, change: () => void, kind: 'hdr', reduced: boolean): void {
  void kind; // 今はヘッダーだけ(見本のサイドバー側は区画③で足す)
  const src = zoneOf(app, 'header');
  // 動きを減らす / 区画が無い: 即時に切り替えるだけ
  if (reduced || !src) { change(); return; }

  const before = new Map<string, DOMRect>();
  for (const n of KEEP_ZONES) { const z = zoneOf(app, n); if (z) before.set(n, z.getBoundingClientRect()); }
  const closing = !src.hasAttribute('data-collapsed');

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

  const far = -112;
  if (ghost) {
    const g = ghost;
    const a = g.animate([
      { transform: 'none', easing: 'cubic-bezier(.4,0,.8,.3)' },
      { transform: 'translateY(1.4px)', offset: 0.16, easing: 'cubic-bezier(.6,0,.9,.5)' },
      { transform: `translateY(${far}px)` },
    ], { duration: 440 });
    a.onfinish = () => g.remove();
  } else {
    src.animate([
      { transform: `translateY(${far}px)`, easing: 'cubic-bezier(.2,0,.15,1)' },
      { transform: 'translateY(1.8px)', offset: 0.72, easing: 'ease-in-out' },
      { transform: 'translateY(-0.5px)', offset: 0.87 },
      { transform: 'none' },
    ], { duration: 620 });
  }

  before.forEach((a, n) => {
    const z = zoneOf(app, n);
    if (!z) return;
    const b = z.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const ox = -Math.sign(dx) * 1.5, oy = -Math.sign(dy) * 1.5;
    z.animate([
      { transform: `translate(${dx}px, ${dy}px)`, easing: 'cubic-bezier(.65,0,.2,1)' },
      { transform: `translate(${ox}px, ${oy}px)`, offset: 0.78, easing: 'ease-in-out' },
      { transform: `translate(${-ox * 0.3}px, ${-oy * 0.3}px)`, offset: 0.9 },
      { transform: 'none' },
    ], { duration: 640, delay: closing ? 70 : 0, fill: 'backwards' });
  });
}
