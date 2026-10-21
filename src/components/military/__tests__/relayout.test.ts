// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { relayoutZones } from '../relayout';

/** 区画を持つ偽の app を作る。change 後は vent/workspace/footer の top が詰まる(矩形を偽装) */
function setup() {
  const app = document.createElement('div');
  const rects: Record<string, number> = { header: 0, vent: 104, workspace: 150, footer: 600, rail: 0 };
  const zones: Record<string, HTMLElement> = {};
  for (const n of Object.keys(rects)) {
    const z = document.createElement('div');
    z.setAttribute('data-ms-zone', n);
    z.getBoundingClientRect = () => ({ left: 0, top: rects[n], width: 100, height: 20, right: 100, bottom: rects[n] + 20, x: 0, y: rects[n], toJSON() {} }) as DOMRect;
    app.append(z); zones[n] = z;
  }
  const anim = vi.fn(() => ({ onfinish: null as null | (() => void) }));
  for (const z of Object.values(zones)) (z as unknown as { animate: unknown }).animate = anim;
  (HTMLElement.prototype as unknown as { animate: unknown }).animate = anim;
  const collapse = () => { zones.header.setAttribute('data-collapsed', ''); rects.vent = 2; rects.workspace = 48; rects.footer = 600; };
  return { app, zones, anim, collapse, rects };
}

describe('relayoutZones', () => {
  const origAnimate = (HTMLElement.prototype as unknown as { animate: unknown }).animate;
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { (HTMLElement.prototype as unknown as { animate: unknown }).animate = origAnimate; });

  it('動きを減らす設定では animate を呼ばず change だけ実行する', () => {
    const { app, anim, collapse } = setup();
    const change = vi.fn(collapse);
    relayoutZones(app, change, 'hdr', true);
    expect(change).toHaveBeenCalledTimes(1);
    expect(anim).not.toHaveBeenCalled();
  });

  it('閉じるとき: 残像を置いて 440ms で抜け、動いた区画だけ 640ms で滑る', () => {
    const { app, zones, anim, collapse } = setup();
    zones.header.innerHTML = '<svg><path data-trace="a"/></svg><i data-bus="s1"></i>';
    document.body.append(app);
    relayoutZones(app, collapse, 'hdr', false);
    const ghost = app.querySelector('.milspec-ghost') as HTMLElement;
    expect(ghost).not.toBeNull();
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.hasAttribute('data-ms-zone')).toBe(false);
    expect(ghost.style.pointerEvents).toBe('none');
    expect(ghost.hasAttribute('inert')).toBe(true);
    // 光エンジンが拾う属性は複製から外れている(元は残る)
    expect(ghost.querySelector('[data-trace],[data-bus]')).toBeNull();
    expect(zones.header.querySelector('[data-trace]')).not.toBeNull();
    const delays = anim.mock.calls.map((c: unknown[]) => (c[1] as { delay?: number }).delay);
    expect(delays.filter((d) => d === 70)).toHaveLength(2);
    const durations = anim.mock.calls.map((c: unknown[]) => (c[1] as { duration: number }).duration);
    expect(durations.filter((d) => d === 440)).toHaveLength(1);
    // vent / workspace は動く・footer / rail は動かない
    expect(durations.filter((d) => d === 640)).toHaveLength(2);
  });

  it('開くとき: 残像は作らず、ヘッダー自身が 620ms で降りてくる', () => {
    const { app, zones, anim, rects } = setup();
    zones.header.setAttribute('data-collapsed', '');
    rects.vent = 2; rects.workspace = 48;
    relayoutZones(app, () => { zones.header.removeAttribute('data-collapsed'); rects.vent = 104; rects.workspace = 150; }, 'hdr', false);
    expect(app.querySelector('.milspec-ghost')).toBeNull();
    const durations = anim.mock.calls.map((c: unknown[]) => (c[1] as { duration: number }).duration);
    expect(durations).toContain(620);
    const flips = anim.mock.calls.filter((c: unknown[]) => (c[1] as { duration: number }).duration === 640);
    expect(flips).toHaveLength(2);
    expect(flips.every((c: unknown[]) => ((c[1] as { delay?: number }).delay ?? 0) === 0)).toBe(true);
  });
});
