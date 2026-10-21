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
  const anim = vi.fn((_k?: unknown, _o?: unknown) => ({ onfinish: null as null | (() => void) }));
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

  it('閉じるとき: 残像と動いた区画が同じ 620ms・同じ開始で一体に動く', () => {
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
    // 残像 + 動いた区画(vent / workspace)が全員 620ms・delay なしで一体に動く(footer / rail は動かない)
    const opts = anim.mock.calls.map((c: unknown[]) => c[1] as { duration: number; delay?: number });
    expect(opts).toHaveLength(3);
    expect(opts.every((o) => o.duration === 620 && !o.delay)).toBe(true);
    // 残像は隣と同じ距離(vent の動き 102px)だけ上へ抜ける
    const gframes = anim.mock.calls[0][0] as { transform: string }[];
    expect(gframes[gframes.length - 1].transform).toBe('translate(0px, -102px)');
  });

  it('開くとき: 残像は作らず、ヘッダー自身が 620ms で降りてくる', () => {
    const { app, zones, anim, rects } = setup();
    zones.header.setAttribute('data-collapsed', '');
    rects.vent = 2; rects.workspace = 48;
    relayoutZones(app, () => { zones.header.removeAttribute('data-collapsed'); rects.vent = 104; rects.workspace = 150; }, 'hdr', false);
    expect(app.querySelector('.milspec-ghost')).toBeNull();
    const durations = anim.mock.calls.map((c: unknown[]) => (c[1] as { duration: number }).duration);
    expect(durations).toContain(620);
    // ヘッダー自身 + vent + workspace がすべて 620ms・delay なし
    expect(anim.mock.calls).toHaveLength(3);
    expect(durations.every((d) => d === 620)).toBe(true);
    expect(anim.mock.calls.every((c: unknown[]) => ((c[1] as { delay?: number }).delay ?? 0) === 0)).toBe(true);
  });

  describe("kind = 'sb'(サイドバー)", () => {
    /** sidebar 区画を足し、開閉で他の区画の left が動くよう偽装する */
    function setupSb(open: boolean) {
      const base = setup();
      const lefts: Record<string, number> = { sidebar: 0, vent: open ? 300 : 24, workspace: open ? 300 : 24, footer: open ? 300 : 24, rail: open ? 276 : 0 };
      const sb = document.createElement('div');
      sb.setAttribute('data-ms-zone', 'sidebar');
      if (open) sb.setAttribute('data-open', '');
      sb.getBoundingClientRect = () => ({ left: 0, top: 0, width: 274, height: 600, right: 274, bottom: 600, x: 0, y: 0, toJSON() {} }) as DOMRect;
      (sb as unknown as { animate: unknown }).animate = base.anim;
      base.app.append(sb);
      for (const n of ['vent', 'workspace', 'footer', 'rail']) {
        const z = base.zones[n];
        z.getBoundingClientRect = () => ({ left: lefts[n], top: 0, width: 100, height: 20, right: lefts[n] + 100, bottom: 20, x: lefts[n], y: 0, toJSON() {} }) as DOMRect;
      }
      return { ...base, sb, lefts };
    }

    it('動きを減らす設定では animate を呼ばず change だけ実行する', () => {
      const { app, anim } = setupSb(true);
      const change = vi.fn();
      relayoutZones(app, change, 'sb', true);
      expect(change).toHaveBeenCalledTimes(1);
      expect(anim).not.toHaveBeenCalled();
    });

    it('閉じるとき: サイドバーの残像が隣と同じ距離(276px)だけ左へ抜け、全員 620ms・delay なしで一体に動く', () => {
      const { app, sb, anim, lefts } = setupSb(true);
      sb.innerHTML = '<svg><path data-trace="a"/></svg>';
      document.body.append(app);
      relayoutZones(app, () => { sb.removeAttribute('data-open'); lefts.vent = lefts.workspace = lefts.footer = 24; lefts.rail = 0; }, 'sb', false);
      const ghost = app.querySelector('.milspec-ghost') as HTMLElement;
      expect(ghost).not.toBeNull();
      expect(ghost.hasAttribute('data-ms-zone')).toBe(false);
      expect(ghost.querySelector('[data-trace]')).toBeNull();
      const frames = anim.mock.calls[0][0] as { transform: string }[];
      expect(frames[frames.length - 1].transform).toBe('translate(-276px, 0px)');
      // 残像 + vent / workspace / footer / rail
      expect(anim.mock.calls).toHaveLength(5);
      expect(anim.mock.calls.every((c: unknown[]) => (c[1] as { duration: number; delay?: number }).duration === 620 && !(c[1] as { delay?: number }).delay)).toBe(true);
    });

    it('開くとき: 残像なし・サイドバー自身が -276px から 620ms で入る', () => {
      const { app, sb, anim, lefts } = setupSb(false);
      relayoutZones(app, () => { sb.setAttribute('data-open', ''); lefts.vent = lefts.workspace = lefts.footer = 300; lefts.rail = 276; }, 'sb', false);
      expect(app.querySelector('.milspec-ghost')).toBeNull();
      const scall = anim.mock.calls.find((c: unknown[]) => (c[0] as { transform: string }[])[0].transform === 'translate(-276px, 0px)');
      expect(scall).toBeDefined();
      expect((scall![1] as { duration: number }).duration).toBe(620);
    });
  });
});
