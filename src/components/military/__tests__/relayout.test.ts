// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { relayoutZones, cancelRelayout, splitZone, PHASE_DUR, PHASE_GAP, CARRIAGE_LAG, CARRIAGE_DUR } from '../relayout';

type Rect = { left: number; top: number; width: number; height: number };
interface FakeAnim {
  el: Element; frames: Keyframe[]; opts: KeyframeAnimationOptions;
  cancel: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>;
  finished: Promise<unknown>; resolve: () => void;
}

const ZONES = ['header', 'vent', 'sidebar', 'rail', 'workspace', 'footer'] as const;
type Zone = typeof ZONES[number];

/** 区画を持つ偽の app。各区画の矩形は rects を書き換えると変わる(change で格子が組み替わったことの偽装) */
function setup(opts: { sbOpen?: boolean; hdrOpen?: boolean } = {}) {
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

const lastTransform = (f: Keyframe[]) => f[f.length - 1].transform;
const firstTransform = (f: Keyframe[]) => f[0].transform;

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

  it('動きの最中の 2 回目(同じ種類)は無視され、終わると複製が残らない', () => {
    const { app, sbClose, sbOpenFn, finishAllAnimations, zones } = setup();
    relayoutZones(app, sbClose, 'sb', false);
    relayoutZones(app, sbOpenFn, 'sb', false);
    vi.runAllTimers(); finishAllAnimations();
    expect(sbClose).toHaveBeenCalledTimes(1);
    expect(sbOpenFn).not.toHaveBeenCalled();
    expect(app.querySelector('.milspec-split, .milspec-ghost')).toBeNull();
    expect(app.hasAttribute('data-relayout')).toBe(false);
    expect(zones.header.style.visibility).toBe('');
    expect(zones.vent.style.visibility).toBe('');
  });

  it('動きの最中に来た別の種類(フォーカスモードの S+H)は、今の動きが終わってから順に行う', () => {
    const { app, sbClose, hdClose } = setup();
    relayoutZones(app, sbClose, 'sb', false);
    relayoutZones(app, hdClose, 'hdr', false);
    vi.advanceTimersByTime(500);
    expect(hdClose).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(sbClose).toHaveBeenCalledTimes(1);
    expect(hdClose).toHaveBeenCalledTimes(1);
    expect(app.hasAttribute('data-relayout')).toBe(false);
  });

  it('cancelRelayout: 途中で止めると change 済みになり、複製・属性が残らない(後に控えた分も即時に行う)', () => {
    const { app, sbOpenFn, hdOpen, anims, zones } = setup({ sbOpen: false, hdrOpen: false });
    relayoutZones(app, sbOpenFn, 'sb', false);
    relayoutZones(app, hdOpen, 'hdr', false);
    expect(app.querySelectorAll('.milspec-split').length).toBeGreaterThan(0);
    vi.advanceTimersByTime(200);
    cancelRelayout(app);
    expect(sbOpenFn).toHaveBeenCalledTimes(1);
    expect(hdOpen).toHaveBeenCalledTimes(1);
    expect(anims.every((a) => a.cancel.mock.calls.length > 0)).toBe(true);
    expect(app.querySelector('.milspec-split')).toBeNull();
    expect(app.hasAttribute('data-relayout')).toBe(false);
    expect(zones.vent.style.visibility).toBe('');
    vi.runAllTimers();
    expect(sbOpenFn).toHaveBeenCalledTimes(1);
    cancelRelayout(app); // 何もしていないときは何もしない
  });

  it('中身の描き直しが追いつくまで(右の部品が元の位置に戻るまで)2 段目を待つ', () => {
    const { app, zones, sbClose, splitAnims, anims } = setup();
    const lever = document.createElement('i');
    lever.className = 'milspec-mlv';
    zones.header.firstElementChild!.append(lever);
    let leverX = 1339;
    lever.getBoundingClientRect = () => ({ left: leverX, top: 14, width: 36, height: 30, right: leverX + 36, bottom: 44, x: leverX, y: 14, toJSON() {} }) as DOMRect;
    relayoutZones(app, () => { sbClose(); leverX = 1063; }, 'sb', false); // change 直後は古い位置(描き直し前)
    vi.advanceTimersByTime(600);
    expect(sbClose).toHaveBeenCalledTimes(1);
    // 区画の見た目は change 前の複製が押さえていて、2 段目はまだ動き出さない
    expect(zones.header.style.visibility).toBe('hidden');
    const rightBefore = app.querySelector('.milspec-split.milspec-zone-header[data-split="right"]') ?? app.querySelector('.milspec-split[data-split="right"]');
    expect(splitAnims('left').every((a) => a.play.mock.calls.length === 0)).toBe(true);
    expect(anims.filter((a) => a.el === zones.workspace).pop()!.play).not.toHaveBeenCalled();
    leverX = 1339; // 描き直し完了
    vi.advanceTimersByTime(40);
    expect(splitAnims('left').every((a) => a.play.mock.calls.length > 0)).toBe(true);
    expect(anims.filter((a) => a.el === zones.workspace).pop()!.play).toHaveBeenCalled();
    // 右の複製だけ、新しい配置から作り直されている
    expect(rightBefore!.isConnected).toBe(false);
    expect(app.querySelectorAll('.milspec-split[data-split="right"]')).toHaveLength(3);
  });
});

describe('splitZone', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('区画を隠し、光エンジンの属性を外した複製を 左 / 右 / 台車 の 3 枚置く。restore で元どおり', () => {
    const app = document.createElement('div');
    const z = document.createElement('div');
    z.setAttribute('data-ms-zone', 'vent');
    z.innerHTML = '<div class="milspec-vent"><svg><path data-trace="a" data-trace-pc="seam"/></svg><i data-bus="b"></i>'
      + '<div data-vent-rail></div><div class="milspec-carriage" data-vent-carriage><b></b></div></div>';
    app.append(z); document.body.append(app);
    const s = splitZone(z, 190);
    expect(z.style.visibility).toBe('hidden');
    for (const c of [s.left, s.right, s.carriage!]) {
      expect(c.classList.contains('milspec-split')).toBe(true);
      expect(c.hasAttribute('inert')).toBe(true);
      expect(c.getAttribute('aria-hidden')).toBe('true');
      expect(c.hasAttribute('data-ms-zone')).toBe(false);
      expect(c.style.pointerEvents).toBe('none');
      expect(c.style.position).toBe('absolute');
      expect(c.querySelector('[data-trace],[data-trace-pc],[data-bus]')).toBeNull();
    }
    // 台車は左右の複製から外れ、台車の複製には台車だけが残る
    expect(s.left.querySelector('[data-vent-carriage]')).toBeNull();
    expect(s.right.querySelector('[data-vent-carriage]')).toBeNull();
    expect(s.right.querySelector('[data-vent-rail]')).not.toBeNull();
    expect(s.carriage!.querySelector('[data-vent-carriage]')).not.toBeNull();
    expect(s.carriage!.querySelector('[data-vent-rail], svg')).toBeNull();
    // 元の区画の属性は残る
    expect(z.querySelector('[data-trace]')).not.toBeNull();
    s.restore();
    expect(app.querySelector('.milspec-split')).toBeNull();
    expect(z.style.visibility).toBe('');
  });

  it('電源投入の演出: 暗幕(不透明度・切り抜き)とランプは毎コマ本物に合わせる', () => {
    vi.useFakeTimers();
    try {
      const app = document.createElement('div');
      const z = document.createElement('div');
      z.innerHTML = '<div class="milspec-vent"><i class="milspec-led is-warn"></i><div class="milspec-carriage" data-vent-carriage><i class="milspec-led"></i></div></div>'
        + '<span class="milspec-dim"></span>';
      app.append(z); document.body.append(app);
      const box = (l: number, t: number, w: number, h: number) => () => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t, toJSON() {} }) as DOMRect;
      z.getBoundingClientRect = box(300, 104, 1189, 19);
      const dim = z.querySelector('.milspec-dim') as HTMLElement;
      dim.getBoundingClientRect = box(300, 104, 1189, 19);
      dim.style.opacity = '0.55';
      dim.style.clipPath = 'inset(0px 0px 0px calc(50% + 0px))'; // 暗幕が退いた左半分は明るい(暗幕は右半分だけ)
      const s = splitZone(z, 190);
      // 複製の暗幕は、本物の暗幕が覆っている画面上の範囲を、複製の位置に直して覆う(作った直後から)
      const ld = s.left.querySelector('.milspec-dim') as HTMLElement;
      expect(ld.style.opacity).toBe('0.55');
      expect(ld.style.clipPath).toBe('inset(104px -1489px -123px 894.5px)'); // 複製の暗幕の矩形は 0(テストの代役)
      ld.getBoundingClientRect = box(300, 104, 1189, 19);
      // 台車の複製の暗幕は台車の範囲だけ(右の複製の暗幕と二重にならない)
      const car = s.carriage!.querySelector('[data-vent-carriage]') as HTMLElement;
      car.getBoundingClientRect = box(1000, 104, 252, 19);
      const cd = s.carriage!.querySelector('.milspec-dim') as HTMLElement;
      cd.getBoundingClientRect = box(300, 104, 1189, 19);
      // 本物が進む(暗幕が消えていく・ランプが点く)と、次のコマで複製も同じになる
      dim.style.opacity = '0.3';
      (z.querySelector('.milspec-vent > .milspec-led') as HTMLElement).className = 'milspec-led is-on is-flick';
      vi.advanceTimersByTime(20);
      expect(ld.style.opacity).toBe('0.3');
      expect(ld.style.clipPath).toBe('inset(0px 0px 0px 594.5px)');
      expect(cd.style.clipPath).toBe('inset(0px 237px 0px 700px)');
      expect((s.right.querySelector('.milspec-vent > .milspec-led') as HTMLElement).className).toBe('milspec-led is-on is-flick');
      // 台車が暗幕の外(左の明るい側)にいるときは、台車の暗幕は覆わない
      car.getBoundingClientRect = box(500, 104, 252, 19);
      vi.advanceTimersByTime(20);
      expect(cd.style.clipPath).toBe('inset(50%)');
      s.restore();
    } finally { vi.useRealTimers(); }
  });

  it('台車の無い区画では carriage は null', () => {
    const app = document.createElement('div');
    const z = document.createElement('div');
    app.append(z); document.body.append(app);
    expect(splitZone(z, 700).carriage).toBeNull();
  });

  it('複製の SVG の id は複製ごとに付け直し、url(#…) / href の参照も複製の中の定義を指す(本物は隠すので、本物の pattern・clipPath を参照すると網・基板が消える)', () => {
    const app = document.createElement('div');
    const z = document.createElement('div');
    z.innerHTML = '<svg><defs><pattern id="hdr-1-mesh"></pattern><clipPath id="hdr-2-win"><rect/></clipPath></defs>'
      + '<rect fill="url(#hdr-1-mesh)" style="fill:url(&quot;#hdr-1-mesh&quot;)"/><g clip-path="url(#hdr-2-win)"></g><use href="#hdr-1-mesh"/></svg>';
    app.append(z); document.body.append(app);
    const s = splitZone(z, [{ x: 700, y0: 0, y1: 102 }]);
    const ids = (c: HTMLElement) => [...c.querySelectorAll('[id]')].map((e) => e.id);
    for (const c of [s.left, s.right]) {
      const [mesh, win] = ids(c);
      expect(mesh).not.toBe('hdr-1-mesh'); expect(win).not.toBe('hdr-2-win');
      expect(mesh.startsWith('hdr-1-mesh')).toBe(true);
      expect(c.querySelector('rect[fill]')!.getAttribute('fill')).toBe(`url(#${mesh})`);
      expect(c.querySelector('rect[fill]')!.getAttribute('style')).toContain(`#${mesh}`);
      expect(c.querySelector('g')!.getAttribute('clip-path')).toBe(`url(#${win})`);
      expect(c.querySelector('use')!.getAttribute('href')).toBe(`#${mesh}`);
    }
    expect(ids(s.left)[0]).not.toBe(ids(s.right)[0]);
    // 本物はそのまま
    expect(z.querySelector('rect[fill]')!.getAttribute('fill')).toBe('url(#hdr-1-mesh)');
    s.restore();
  });

  it('ヘッダーの右の複製は左の縁の影(near-l / far-l)を持たない(滑る影と二重にならない)。走行中の粒も複製には持ち込まない', () => {
    const app = document.createElement('div');
    const z = document.createElement('div');
    z.innerHTML = '<svg><g class="drw-shadow"><rect data-sh="near-l"/><rect data-sh="far-l"/><rect data-sh="near-r"/><rect data-sh="far-r"/></g>'
      + '<path class="milspec-pz-g"/><path class="milspec-pz-c"/></svg>';
    app.append(z); document.body.append(app);
    const s = splitZone(z, [{ x: 700, y0: 0, y1: 102 }]);
    expect(s.right.querySelectorAll('[data-sh="near-l"], [data-sh="far-l"]')).toHaveLength(0);
    expect(s.right.querySelectorAll('[data-sh="near-r"], [data-sh="far-r"]')).toHaveLength(2);
    for (const c of [s.left, s.right]) expect(c.querySelectorAll('.milspec-pz-g, .milspec-pz-c')).toHaveLength(0);
    expect(z.querySelectorAll('.milspec-pz-g')).toHaveLength(1); // 本物はそのまま
    s.restore();
  });
});
