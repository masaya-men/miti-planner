// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { relayoutZones } from '../relayout';
import { setup, type Rect, type FakeAnim } from './relayoutTestSetup';

describe('relayoutZones(2 段階の開閉)', () => {
  const origAnimate = (HTMLElement.prototype as unknown as { animate: unknown }).animate;
  beforeEach(() => { document.body.innerHTML = ''; vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); (HTMLElement.prototype as unknown as { animate: unknown }).animate = origAnimate; });
  describe('表の区画(workspace)の右端', () => {
    /** 表の区画に 装甲・縁の暗がり・右上の印・見出しの行・スクロールする本体 を置く(矩形は区画の位置から決める) */
    function setupWs(sbOpen: boolean) {
      const base = setup({ sbOpen });
      const ws = base.zones.workspace;
      ws.innerHTML = '<div class="milspec-tbl-armor"><div class="milspec-armor"></div><div class="milspec-vig"></div>'
        + '<span class="milspec-scr-mark tr"></span></div>'
        + '<div class="milspec-tbl-wrap"><div class="hdr-row" style="overflow: hidden"></div><div class="scroller" style="overflow: auto"><div class="rows"></div></div></div>';
      const at = (el: Element, f: (z: Rect) => Rect) => {
        (el as HTMLElement).getBoundingClientRect = () => { const r = f(base.rects.workspace); return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON() {} } as DOMRect; };
      };
      at(ws.querySelector('.milspec-armor')!, (z) => ({ ...z }));
      at(ws.querySelector('.milspec-vig')!, (z) => ({ left: z.left + 10, top: z.top + 10, width: z.width - 20, height: z.height - 20 }));
      at(ws.querySelector('.milspec-scr-mark')!, (z) => ({ left: z.left + z.width - 21, top: z.top + 12, width: 9, height: 9 }));
      at(ws.querySelector('.hdr-row')!, (z) => ({ left: z.left + 10, top: z.top + 10, width: z.width - 20, height: 40 }));
      at(ws.querySelector('.scroller')!, (z) => ({ left: z.left + 10, top: z.top + 50, width: z.width - 20, height: 300 }));
      const sc = ws.querySelector('.scroller') as HTMLElement;
      Object.defineProperty(sc, 'offsetWidth', { value: 1169 });
      Object.defineProperty(sc, 'clientWidth', { value: 1155 }); // 縦のスクロールバー 14px
      return { ...base, ws };
    }
    const clipsOf = (a: FakeAnim) => a.frames.map((k) => k.clipPath);

    it('サイドバーを閉じる: 下に静止した装甲の複製・本物の装甲は継ぎ目より左だけ・右端で切れる箱は見える右端が動かない・右上の印は静止', () => {
      const { app, ws, sbClose, anims, finishAllAnimations } = setupWs(true);
      relayoutZones(app, sbClose, 'sb', false);
      vi.advanceTimersByTime(500);
      // 下に置いた複製(本物の区画の直前 = 下に描かれる)。継ぎ目 600 より右だけ・表の中身は隠す
      const baseEl = ws.previousElementSibling as HTMLElement;
      expect(baseEl.getAttribute('data-split')).toBe('base');
      expect(baseEl.style.clipPath).toBe('inset(-16px -16px -16px 600px)');
      expect(baseEl.style.zIndex).toBe('auto');
      // 表の中身は持たない。スクロールバーのある箱だけ、同じ位置・大きさ・スクロール量の空の箱で代わりに見せる
      expect(baseEl.querySelector('.milspec-tbl-wrap, .rows, .hdr-row')).toBeNull();
      const stand = baseEl.querySelector('.scroller') as HTMLElement;
      expect(stand.style.position).toBe('absolute');
      expect([stand.style.left, stand.style.width]).toEqual(['10px', '1445px']); // 描き直し後(閉じた配置・幅 1465)で作り直した位置
      // 描き直し後に作り直した複製でも、装甲は切られていない(本物に付けた「継ぎ目より左だけ」を持ち込まない)
      expect((baseEl.querySelector('.milspec-armor') as HTMLElement).style.clipPath).toBe('');
      expect((baseEl.querySelector('.milspec-vig') as HTMLElement).style.clipPath).toBe('');
      expect((baseEl.querySelector('.scroller > div') as HTMLElement).style.visibility).toBe('hidden');
      // 本物の装甲・縁の暗がりは継ぎ目より左だけ(縁の暗がりは区画の左端から 10px 内側にある)
      expect((ws.querySelector('.milspec-armor') as HTMLElement).style.clipPath).toBe('inset(-16px calc(100% - 600px) -16px -16px)');
      expect((ws.querySelector('.milspec-vig') as HTMLElement).style.clipPath).toBe('inset(-16px calc(100% - 590px) -16px -16px)');
      // 右上の印: 本物は隠し、静止した複製を上に置く
      expect((ws.querySelector('.milspec-scr-mark') as HTMLElement).style.visibility).toBe('hidden');
      const mark = app.querySelector('[data-split="mark"]') as HTMLElement;
      expect(mark.style.left).toBe(`${1489 - 21}px`);
      expect(mark.style.right).toBe('auto');
      // 右端で切れる箱: 区画のずれ D → 0 に合わせて右の切り詰めが D+sb → sb(見える右端 = スクロールバーの左で不動)
      const hdr = anims.filter((a) => (a.el as HTMLElement).classList?.contains('hdr-row')).pop()!;
      const scr = anims.filter((a) => (a.el as HTMLElement).classList?.contains('scroller')).pop()!;
      expect([clipsOf(hdr)[0], clipsOf(hdr)[3]]).toEqual(['inset(-16px 276px -16px -16px)', 'inset(-16px 0px -16px -16px)']);
      expect([clipsOf(scr)[0], clipsOf(scr)[3]]).toEqual(['inset(-16px 290px -16px -16px)', 'inset(-16px 14px -16px -16px)']);
      // 行き過ぎの間も、スクロールバーのある箱は本物のスクロールバー(sb)を切ったまま
      expect(clipsOf(scr)[1]).toBe('inset(-16px 14px -16px -16px)');
      expect(clipsOf(hdr)[1]).toBe('inset(-16px -1.8px -16px -16px)');
      expect(scr.play).toHaveBeenCalled();
      expect(scr.opts).toMatchObject({ duration: 420 });
      // 終わると全部元どおり
      vi.runAllTimers(); finishAllAnimations();
      expect(app.querySelector('[data-split]')).toBeNull();
      expect((ws.querySelector('.milspec-armor') as HTMLElement).style.clipPath).toBe('');
      expect((ws.querySelector('.milspec-scr-mark') as HTMLElement).style.visibility).toBe('');
    });

    it('サイドバーを開く: 1 段目で区画が 0 → +D、箱の右の切り詰めは sb → D+sb', () => {
      const { app, ws, sbOpenFn, anims } = setupWs(false);
      relayoutZones(app, sbOpenFn, 'sb', false);
      expect((ws.previousElementSibling as HTMLElement).getAttribute('data-split')).toBe('base');
      const scr = anims.filter((a) => (a.el as HTMLElement).classList?.contains('scroller')).pop()!;
      expect([clipsOf(scr)[0], clipsOf(scr)[3]]).toEqual(['inset(-16px 14px -16px -16px)', 'inset(-16px 290px -16px -16px)']);
      expect(scr.pause).not.toHaveBeenCalled();
      vi.advanceTimersByTime(620);
      expect(sbOpenFn).toHaveBeenCalledTimes(1);
      expect(scr.cancel).toHaveBeenCalled(); // change で新しい配置 = 1 段目の行き先になるので止める
    });
  });
});
