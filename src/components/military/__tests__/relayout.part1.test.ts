// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { relayoutZones, PHASE_DUR, PHASE_GAP, CARRIAGE_LAG, CARRIAGE_DUR } from '../relayout';
import { setup, lastTransform, firstTransform } from './relayoutTestSetup';

describe('relayoutZones(2 段階の開閉)', () => {
  const origAnimate = (HTMLElement.prototype as unknown as { animate: unknown }).animate;
  beforeEach(() => { document.body.innerHTML = ''; vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); (HTMLElement.prototype as unknown as { animate: unknown }).animate = origAnimate; });
  it('既定値', () => {
    expect([PHASE_DUR, PHASE_GAP, CARRIAGE_LAG, CARRIAGE_DUR]).toEqual([420, 80, 60, 480]);
  });

  it('動きを減らす設定: animate なしで change だけ', () => {
    const { app, anims, hdClose, sbClose } = setup();
    relayoutZones(app, hdClose, 'hdr', true);
    relayoutZones(app, sbClose, 'sb', true);
    expect(hdClose).toHaveBeenCalledTimes(1);
    expect(sbClose).toHaveBeenCalledTimes(1);
    expect(anims).toHaveLength(0);
    expect(app.hasAttribute('data-relayout')).toBe(false);
  });

  it('サイドバーを閉じる: 1 段目はサイドバーだけ(420)・2 段目は 500ms で左の板/他区画(420)・台車は +60 で 480', () => {
    const { app, sbClose, animOf, splitAnims, carriageAnim, anims } = setup();
    relayoutZones(app, sbClose, 'sb', false);
    expect(sbClose).not.toHaveBeenCalled();
    expect(app.hasAttribute('data-relayout')).toBe(true);
    // 1 段目: サイドバー(本物)だけが左へ抜ける
    expect(anims).toHaveLength(1);
    expect(animOf('sidebar')[1]).toMatchObject({ duration: 420 });
    expect(lastTransform(animOf('sidebar')[0])).toBe('translate(-278px, 0px)');
    vi.advanceTimersByTime(499);
    // サイドバーが抜けきった所で change(中身が新しい幅に追いつくまで複製で押さえる)。2 段目はまだ
    expect(sbClose).toHaveBeenCalledTimes(1);
    // 新しい配置の複製は置いてあるが、まだ止まっている(500 で一斉に動き出す)
    expect(splitAnims('left').every((a) => a.pause.mock.calls.length > 0 && a.play.mock.calls.length === 0)).toBe(true);
    expect(app.querySelector('.milspec-split[data-split="carriage"] [data-vent-carriage]')!.classList.contains('is-moving')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(splitAnims('left').every((a) => a.play.mock.calls.length > 0)).toBe(true);
    // 2 段目: rail / workspace は +D(276) から 0 へ(footer は切り分けて左の板が滑る)
    expect(animOf('footer')[0]).toBeUndefined();
    for (const n of ['rail', 'workspace'] as const) {
      expect(animOf(n)[1]).toMatchObject({ duration: 420 });
      expect(firstTransform(animOf(n)[0])).toBe('translate(276px, 0px)');
      expect(lastTransform(animOf(n)[0])).toBe('translate(0px, 0px)');
    }
    // ヘッダー・通気口は change 前の配置で切り分けた複製: 左の板が 0 から -D(= 新しい配置の位置)へ
    expect(app.querySelectorAll('.milspec-split')).not.toHaveLength(0);
    const lefts = splitAnims('left');
    expect(lefts).toHaveLength(3);
    for (const a of lefts) {
      expect(a.opts).toMatchObject({ duration: 420 });
      expect(firstTransform(a.frames)).toBe('translate(0px, 0px)');
      expect(lastTransform(a.frames)).toBe('translate(-276px, 0px)');
    }
    // 台車は 0 から -D/2 へ・遅れて 480ms・最後に 0.8px
    expect(carriageAnim()[1]).toMatchObject({ delay: 60, duration: 480 });
    const cf = carriageAnim()[0];
    expect(cf.map((k) => k.transform)).toEqual(['translateX(0px)', 'translateX(-137.2px)', 'translateX(-138px)']);
    expect(cf[0].easing).toBe('cubic-bezier(.45,0,.3,1)');
    expect(app.querySelector('.milspec-split[data-split="carriage"] [data-vent-carriage]')!.classList.contains('is-moving')).toBe(true);
  });

  it('右の複製は動かない(transform なし)・継ぎ目は ヘッダー = 帯ごとの階段(700/714/700/683/700 × hs)/ 通気口 190×hs', () => {
    const { app, sbClose, splitAnims } = setup();
    relayoutZones(app, sbClose, 'sb', false);
    vi.advanceTimersByTime(500);
    // 右の複製は位置を動かさない。継ぎ目が移動量(276)より左の通気口だけ、見える左端(clip)を板の左端と一緒に動かす
    const rightAnims = splitAnims('right');
    expect(rightAnims.every((a) => a.frames.every((k) => k.transform === undefined))).toBe(true);
    expect(rightAnims.map((a) => (a.el as HTMLElement).classList.contains('vent-zone'))).toEqual([true]);
    const hdr = app.querySelector('[data-split="right"][data-zone="header"]') as HTMLElement;
    expect(hdr.style.clipPath).toMatch(/^polygon\(/);
    expect(hdr.style.clipPath).toContain('714px'); expect(hdr.style.clipPath).toContain('683px'); expect(hdr.style.clipPath).toContain('700px');
    expect(hdr.style.clipPath).not.toContain('path(');
    // 右 = 階段より右(描き直し後に作り直した新しい配置の複製なので、右端は 区画の幅 1465 + 16)。上の板の切れ端(上段 700〜714 / 下段 683〜700)を右の複製に残さない
    expect(hdr.style.clipPath).toBe('polygon(1481px -16px, 700px -16px, 700px 4px, 714px 4px, 714px 48px, 700px 48px, 700px 52px, 683px 52px, 683px 100px, 700px 100px, 700px 118px, 1481px 118px)');
    const left = app.querySelector('[data-split="left"][data-zone="header"]') as HTMLElement;
    expect(left.style.clipPath).toBe('polygon(-16px -16px, 700px -16px, 700px 4px, 714px 4px, 714px 48px, 700px 48px, 700px 52px, 683px 52px, 683px 100px, 700px 100px, 700px 118px, -16px 118px)');
    const vent = app.querySelector('[data-split="right"][data-zone="vent"]') as HTMLElement;
    expect(vent.style.clipPath).toBe('inset(-16px -16px -16px 190px)');
    expect(hdr.getAnimations?.().length ?? 0).toBe(0);
    // 通気口・フッターの継ぎ目は今の inset のまま(フッターは左寄せの文字が無いときは幅の半分 1189/2)
    const rights = [...app.querySelectorAll<HTMLElement>('.milspec-split[data-split="right"]')];
    const leftsEl = [...app.querySelectorAll<HTMLElement>('.milspec-split[data-split="left"]')];
    expect(rights).toHaveLength(3);
    expect(rights.map((e) => e.getAttribute('data-zone')).sort()).toEqual(['footer', 'header', 'vent']);
    expect((app.querySelector('[data-split="right"][data-zone="footer"]') as HTMLElement).style.clipPath).toBe('inset(-16px -16px -16px 594.5px)');
    expect(leftsEl.filter((e) => e.getAttribute('data-zone') !== 'header').map((e) => e.style.clipPath).sort())
      .toEqual(['inset(-16px calc(100% - 190px) -16px -16px)', 'inset(-16px calc(100% - 594.5px) -16px -16px)'].sort());
  });

  it('階段の継ぎ目: 縮小率 0.8 なら x も y も 0.8 倍・通気口の継ぎ目は 190×0.8', () => {
    const { app, sbClose, splitAnims } = setup();
    app.style.setProperty('--ms-hs', '0.8');
    relayoutZones(app, sbClose, 'sb', false);
    vi.advanceTimersByTime(500);
    const hdr = app.querySelector('[data-split="right"][data-zone="header"]') as HTMLElement;
    const left = app.querySelector('[data-split="left"][data-zone="header"]') as HTMLElement;
    for (const v of ['571.2px', '546.4px', '560px', '3.2px', '38.4px', '41.6px', '80px']) {
      expect(hdr.style.clipPath).toContain(v);
      expect(left.style.clipPath).toContain(v);
    }
    // 区画の高さ 102 + 16 = 118(テストの区画は縮小率を反映しない固定の高さ)
    expect(hdr.style.clipPath).toBe('polygon(1481px -16px, 560px -16px, 560px 3.2px, 571.2px 3.2px, 571.2px 38.4px, 560px 38.4px, 560px 41.6px, 546.4px 41.6px, 546.4px 80px, 560px 80px, 560px 118px, 1481px 118px)');
    expect((app.querySelector('[data-split="right"][data-zone="vent"]') as HTMLElement).style.clipPath).toBe('inset(-16px -16px -16px 152px)');
    // 通気口だけ右の複製の見える左端を動かす(ヘッダーの階段は継ぎ目 ≥ 移動量なので動かさない)
    expect(splitAnims('right').map((a) => (a.el as HTMLElement).getAttribute('data-zone'))).toEqual(['vent']);
  });

  it('サイドバーを開く: ヘッダーの複製も階段で切り、右の複製の見える左端は動かさない', () => {
    const { app, sbOpenFn, splitAnims } = setup({ sbOpen: false });
    relayoutZones(app, sbOpenFn, 'sb', false);
    const hdr = app.querySelector('[data-split="right"][data-zone="header"]') as HTMLElement;
    // 閉じた配置: 区画の幅 1465 → 右端 1481
    expect(hdr.style.clipPath).toBe('polygon(1481px -16px, 700px -16px, 700px 4px, 714px 4px, 714px 48px, 700px 48px, 700px 52px, 683px 52px, 683px 100px, 700px 100px, 700px 118px, 1481px 118px)');
    expect(splitAnims('right').map((a) => (a.el as HTMLElement).getAttribute('data-zone'))).toEqual(['vent']);
  });

  it('上の板の縁の影: 左の板の縁に付いて一緒に滑る(閉じる 276→0 / 開く 0→276)。右の板の縁より右は切る', () => {
    const fakeRect = (l: number, t: number, w: number, h: number) => () => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t, toJSON() {} }) as DOMRect;
    const withShadow = (zones: Record<string, HTMLElement>, left: number) => {
      // 窓が開いた配置: 区画の左端 = left、帯 0(y0-4・切れ目 700)と帯 1(4-48・714)。窓の右の縁 = 切れ目 + 276
      zones.header.innerHTML = '<div class="milspec-hs-box"><svg><g class="drw-shadow" opacity="1">'
        + [0, 1].map((i) => `<rect data-sh="far-l" data-band="${i}"/><rect data-sh="far-r" data-band="${i}"/><rect data-sh="near-l" data-band="${i}"/><rect data-sh="near-r" data-band="${i}"/>`).join('')
        + '</g></svg></div>';
      const g = zones.header.querySelector('.drw-shadow')!;
      const bands = [{ i: 0, y: 0, h: 4, c: 700 }, { i: 1, y: 4, h: 44, c: 714 }];
      for (const b of bands) {
        const q = (n: string) => g.querySelector(`[data-sh="${n}"][data-band="${b.i}"]`) as SVGRectElement;
        q('far-l').getBoundingClientRect = fakeRect(left + b.c, b.y, 18, b.h);
        q('near-l').getBoundingClientRect = fakeRect(left + b.c, b.y, 3.5, b.h);
        q('far-r').getBoundingClientRect = fakeRect(left + b.c + 276 - 18, b.y, 18, b.h);
        q('near-r').getBoundingClientRect = fakeRect(left + b.c + 276 - 3.5, b.y, 3.5, b.h);
      }
    };
    // 開く: 閉じた配置(区画の左端 24)の本物から測り、左の板と一緒に 0 → 276
    const o = setup({ sbOpen: false });
    withShadow(o.zones, 24);
    relayoutZones(o.app, o.sbOpenFn, 'sb', false);
    const sh = o.app.querySelector('[data-split="shadow"]') as HTMLElement;
    expect(sh).not.toBeNull();
    expect(sh.nextElementSibling).toBe(o.app.querySelector('[data-split="left"][data-zone="header"]'));
    expect(sh.style.clipPath).toContain('polygon(');
    expect(sh.style.clipPath).toContain('976px'); // 帯 0 の窓の右の縁(区画の左端から 700 + 276)
    expect(sh.style.clipPath).toContain('990px'); // 帯 1(714 + 276)
    const slider = sh.firstElementChild!;
    expect(sh.querySelectorAll('rect')).toHaveLength(4);
    const a = o.anims.find((x) => x.el === slider)!;
    expect(firstTransform(a.frames)).toBe('translate(0px, 0px)');
    expect(lastTransform(a.frames)).toBe('translate(276px, 0px)');
    expect(a.opts).toMatchObject({ duration: 420 });
  });

  it('サイドバーを開く: 1 段目で他区画・左の板が 0→+276、台車は 0→+138(60・480)。1 段目の終わり(540)+80 = 620ms 後に change → サイドバーが入る', () => {
    const { app, sbOpenFn, animOf, splitAnims, carriageAnim, zones, anims } = setup({ sbOpen: false });
    relayoutZones(app, sbOpenFn, 'sb', false);
    for (const n of ['rail', 'workspace'] as const) {
      expect(animOf(n)[1]).toMatchObject({ duration: 420 });
      expect(lastTransform(animOf(n)[0])).toBe('translate(276px, 0px)');
    }
    expect(animOf('footer')[0]).toBeUndefined();
    expect(splitAnims('left').map((a) => lastTransform(a.frames))).toEqual(['translate(276px, 0px)', 'translate(276px, 0px)', 'translate(276px, 0px)']);
    // 右の複製: 位置は動かさない。通気口だけ見える左端が板の左端と一緒に 0 → 276
    expect(splitAnims('right')).toHaveLength(1);
    expect(splitAnims('right')[0].frames.every((k) => k.transform === undefined)).toBe(true);
    expect(splitAnims('right')[0].frames.at(-1)!.clipPath).toBe('inset(-16px -16px -16px 276px)');
    expect(carriageAnim()[1]).toMatchObject({ delay: 60, duration: 480 });
    expect(carriageAnim()[0].map((k) => k.transform)).toEqual(['translateX(0px)', 'translateX(137.2px)', 'translateX(138px)']);
    expect(animOf('sidebar')[0]).toBeUndefined();
    vi.advanceTimersByTime(619);
    expect(sbOpenFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(sbOpenFn).toHaveBeenCalledTimes(1);
    expect(animOf('sidebar')[1]).toMatchObject({ duration: 420 });
    expect(firstTransform(animOf('sidebar')[0])).toBe('translate(-278px, 0px)');
    const entry = anims.filter((a) => a.el === zones.sidebar).pop()!;
    expect(entry.play).toHaveBeenCalled();
    expect(zones.sidebar.hasAttribute('data-open')).toBe(true);
  });

  it('サイドバーを開く: よけた区画が行き先に着いたら(動きの終わり)すぐ change し、サイドバーは隠れた位置で 620ms まで待つ', async () => {
    const { app, sbOpenFn, anims, zones } = setup({ sbOpen: false });
    relayoutZones(app, sbOpenFn, 'sb', false);
    vi.advanceTimersByTime(430);
    anims.forEach((a) => a.resolve());
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    vi.advanceTimersByTime(20);
    expect(sbOpenFn).toHaveBeenCalledTimes(1);
    const entry = anims.filter((a) => a.el === zones.sidebar).pop()!;
    expect(entry.pause).toHaveBeenCalled();
    expect(entry.play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(620 - 450);
    expect(entry.play).toHaveBeenCalled();
  });

  it('ヘッダーを開く: 1 段目で vent/workspace が 102 下がり、500ms 後に change → ヘッダーが上から下りる', () => {
    const { app, hdOpen, animOf, anims } = setup({ hdrOpen: false });
    relayoutZones(app, hdOpen, 'hdr', false);
    expect(anims.map((a) => (a.el as HTMLElement).getAttribute('data-ms-zone')).sort()).toEqual(['vent', 'workspace']);
    expect(lastTransform(animOf('vent')[0])).toBe('translate(0px, 102px)');
    expect(lastTransform(animOf('workspace')[0])).toBe('translate(0px, 102px)');
    vi.advanceTimersByTime(499);
    expect(hdOpen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(hdOpen).toHaveBeenCalledTimes(1);
    expect(animOf('header')[1]).toMatchObject({ duration: 420 });
    expect(firstTransform(animOf('header')[0])).toBe('translate(0px, -106px)');
    expect(app.querySelector('.milspec-split, .milspec-ghost')).toBeNull();
  });

  it('ヘッダーを閉じる: 1 段目はヘッダーだけ(残像は作らない)、500ms 後に change → vent/workspace が上がる', () => {
    const { app, hdClose, animOf, anims } = setup();
    relayoutZones(app, hdClose, 'hdr', false);
    expect(anims).toHaveLength(1);
    expect(lastTransform(animOf('header')[0])).toBe('translate(0px, -106px)');
    expect(app.querySelector('.milspec-ghost, .milspec-split')).toBeNull();
    // ヘッダーが抜けきった所(遅くとも 420)で change。通気口・タイムラインは元の位置に止めて 500 で動き出す
    vi.advanceTimersByTime(420);
    expect(hdClose).toHaveBeenCalledTimes(1);
    const vent = anims.filter((a) => (a.el as HTMLElement).getAttribute('data-ms-zone') === 'vent').pop()!;
    expect(vent.pause).toHaveBeenCalled();
    expect(vent.play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(80);
    expect(vent.play).toHaveBeenCalled();
    expect(firstTransform(animOf('vent')[0])).toBe('translate(0px, 102px)');
    expect(firstTransform(animOf('workspace')[0])).toBe('translate(0px, 102px)');
    expect(animOf('footer')[0]).toBeUndefined();
  });

  it('台車の走行量はレールの長さ − 台車の幅 − 両端の余白(狭い画面で縮めた分もそのまま使う)', () => {
    const { app, zones, sbClose, carriageAnim } = setup();
    app.style.setProperty('--ms-hs', '0.5');
    const r = (w: number) => () => ({ left: 0, top: 0, width: w, height: 5, right: w, bottom: 5, x: 0, y: 0, toJSON() {} }) as DOMRect;
    (zones.vent.querySelector('[data-vent-rail]') as HTMLElement).getBoundingClientRect = r(100 + 126 + 6); // 走行 100・台車 126(=252×0.5)・余白 6×0.5×2
    (zones.vent.querySelector('[data-vent-carriage]') as HTMLElement).getBoundingClientRect = r(126);
    relayoutZones(app, sbClose, 'sb', false);
    vi.advanceTimersByTime(500);
    expect(carriageAnim()[0].map((k) => k.transform)).toEqual(['translateX(0px)', 'translateX(-99.2px)', 'translateX(-100px)']);
  });

  it('フッター: 継ぎ目は左寄せの文字の右端 + 12px(右のリンクは右の複製に残り動かない)', () => {
    const { app, zones, sbClose, splitAnims } = setup();
    zones.footer.innerHTML = '<span class="milspec-flink static">© LoPo</span><div class="milspec-ftr-right"><a class="milspec-flink">X</a></div>';
    const text = zones.footer.querySelector('.milspec-flink') as HTMLElement;
    text.getBoundingClientRect = () => ({ left: 362, right: 897, top: 664, bottom: 671, width: 535, height: 7, x: 362, y: 664, toJSON() {} }) as DOMRect;
    relayoutZones(app, sbClose, 'sb', false);
    vi.advanceTimersByTime(500);
    const right = [...app.querySelectorAll<HTMLElement>('.milspec-split[data-split="right"]')].find((e) => e.querySelector('.milspec-ftr-right'))!;
    expect(right.style.clipPath).toBe('inset(-16px -16px -16px 609px)');
    const left = [...app.querySelectorAll<HTMLElement>('.milspec-split[data-split="left"]')].find((e) => e.querySelector('.milspec-ftr-right'))!;
    expect(left.style.clipPath).toBe('inset(-16px calc(100% - 609px) -16px -16px)');
    expect(splitAnims('right').some((a) => a.el === right)).toBe(false);
    expect(zones.footer.style.visibility).toBe('hidden');
  });
});
