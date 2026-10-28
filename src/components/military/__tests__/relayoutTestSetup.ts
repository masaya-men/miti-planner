// relayout テスト共通の準備(偽の app と animate の記録)。vi.mock は無いのでここに置ける
import { vi } from 'vitest';

export type Rect = { left: number; top: number; width: number; height: number };
export interface FakeAnim {
  el: Element; frames: Keyframe[]; opts: KeyframeAnimationOptions;
  cancel: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>;
  finished: Promise<unknown>; resolve: () => void;
}

export const ZONES = ['header', 'vent', 'sidebar', 'rail', 'workspace', 'footer'] as const;
type Zone = typeof ZONES[number];

/** 区画を持つ偽の app。各区画の矩形は rects を書き換えると変わる(change で格子が組み替わったことの偽装) */
export function setup(opts: { sbOpen?: boolean; hdrOpen?: boolean } = {}) {
  const sbOpen = opts.sbOpen ?? true, hdrOpen = opts.hdrOpen ?? true;
  const app = document.createElement('div');
  app.style.setProperty('--ms-hs', '1');
  app.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1489, height: 679, right: 1489, bottom: 679, x: 0, y: 0, toJSON() {} }) as DOMRect;
  const rects = {} as Record<Zone, Rect>;
  const zones = {} as Record<Zone, HTMLElement>;
  const layout = (sb: boolean, hd: boolean) => {
    const x = sb ? 300 : 24, w = 1489 - x, vy = hd ? 104 : 2;
    rects.sidebar = { left: 0, top: 0, width: sb ? 274 : 0, height: 679 };
    rects.rail = { left: sb ? 276 : 0, top: 0, width: 22, height: 679 };
    rects.header = { left: x, top: 0, width: w, height: hd ? 102 : 0 };
    rects.vent = { left: x, top: vy, width: w, height: 19 };
    rects.workspace = { left: x, top: vy + 23, width: w, height: 400 };
    rects.footer = { left: x, top: 657, width: w, height: 22 };
  };
  layout(sbOpen, hdrOpen);
  for (const n of ZONES) {
    const z = document.createElement('div');
    z.setAttribute('data-ms-zone', n);
    z.getBoundingClientRect = () => { const r = rects[n]; return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON() {} } as DOMRect; };
    app.append(z); zones[n] = z;
  }
  zones.vent.classList.add('vent-zone');
  if (sbOpen) zones.sidebar.setAttribute('data-open', '');
  if (!hdrOpen) zones.header.setAttribute('data-collapsed', '');
  zones.header.innerHTML = '<div class="milspec-hs-box"><svg><path data-trace="h3"/></svg><i data-bus="s1"></i></div>';
  zones.vent.innerHTML = '<div class="milspec-hs-box"><div class="milspec-vent"><i class="perf"></i>'
    + '<div class="milspec-vent-rail" data-vent-rail></div><div class="milspec-carriage" data-vent-carriage><b class="milspec-carriage-led"></b></div>'
    + '<i class="hazR"></i></div></div>';
  document.body.append(app);

  const anims: FakeAnim[] = [];
  (HTMLElement.prototype as unknown as { animate: unknown }).animate = function (this: Element, frames: Keyframe[], o: KeyframeAnimationOptions) {
    let resolve = () => {};
    const finished = new Promise<unknown>((r) => { resolve = () => r(undefined); });
    const a: FakeAnim = { el: this, frames, opts: o, cancel: vi.fn(), pause: vi.fn(), play: vi.fn(), finished, resolve };
    anims.push(a);
    return a;
  };
  const sbClose = vi.fn(() => { zones.sidebar.removeAttribute('data-open'); layout(false, !zones.header.hasAttribute('data-collapsed')); });
  const sbOpenFn = vi.fn(() => { zones.sidebar.setAttribute('data-open', ''); layout(true, !zones.header.hasAttribute('data-collapsed')); });
  const hdClose = vi.fn(() => { zones.header.setAttribute('data-collapsed', ''); layout(zones.sidebar.hasAttribute('data-open'), false); });
  const hdOpen = vi.fn(() => { zones.header.removeAttribute('data-collapsed'); layout(zones.sidebar.hasAttribute('data-open'), true); });

  /** その区画(本物)の最後の animate 呼び出し */
  const animOf = (n: Zone): [Keyframe[], KeyframeAnimationOptions] => {
    const list = anims.filter((a) => a.el === zones[n]);
    const a = list[list.length - 1];
    return a ? [a.frames, a.opts] : ([undefined, undefined] as never);
  };
  const splitAnims = (part: string) => anims.filter((a) => (a.el as HTMLElement).getAttribute?.('data-split') === part);
  const carriageAnim = (): [Keyframe[], KeyframeAnimationOptions] => { const a = splitAnims('carriage').pop()!; return [a.frames, a.opts]; };
  const finishAllAnimations = () => anims.forEach((a) => a.resolve());
  return { app, zones, rects, anims, sbClose, sbOpenFn, hdClose, hdOpen, animOf, splitAnims, carriageAnim, finishAllAnimations };
}

export const lastTransform = (f: Keyframe[]) => f[f.length - 1].transform;
export const firstTransform = (f: Keyframe[]) => f[0].transform;
