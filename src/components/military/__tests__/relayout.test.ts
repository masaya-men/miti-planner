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
    + '<div class="milspec-rail" data-vent-rail></div><div class="milspec-carriage" data-vent-carriage><b class="milspec-carriage-led"></b></div>'
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
    // 2 段目: rail / workspace / footer は +D(276) から 0 へ
    for (const n of ['rail', 'workspace', 'footer'] as const) {
      expect(animOf(n)[1]).toMatchObject({ duration: 420 });
      expect(firstTransform(animOf(n)[0])).toBe('translate(276px, 0px)');
      expect(lastTransform(animOf(n)[0])).toBe('translate(0px, 0px)');
    }
    // ヘッダー・通気口は change 前の配置で切り分けた複製: 左の板が 0 から -D(= 新しい配置の位置)へ
    expect(app.querySelectorAll('.milspec-split')).not.toHaveLength(0);
    const lefts = splitAnims('left');
    expect(lefts).toHaveLength(2);
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

  it('右の複製は動かない(transform なし)・継ぎ目は ヘッダー 700×hs / 通気口 190×hs', () => {
    const { app, sbClose, splitAnims } = setup();
    app.style.setProperty('--ms-hs', '0.5');
    relayoutZones(app, sbClose, 'sb', false);
    vi.advanceTimersByTime(500);
    // 右の複製は位置を動かさない。継ぎ目が移動量(276)より左の通気口だけ、見える左端(clip)を板の左端と一緒に動かす
    const rightAnims = splitAnims('right');
    expect(rightAnims.every((a) => a.frames.every((k) => k.transform === undefined))).toBe(true);
    expect(rightAnims.map((a) => (a.el as HTMLElement).classList.contains('vent-zone'))).toEqual([true]);
    const clips = rightAnims[0].frames.map((k) => k.clipPath);
    expect([clips[0], clips[1], clips[3]]).toEqual(['inset(-16px -16px -16px 276px)', 'inset(-16px -16px -16px -1.8px)', 'inset(-16px -16px -16px 0px)']);
    const rights = [...app.querySelectorAll<HTMLElement>('.milspec-split[data-split="right"]')];
    const leftsEl = [...app.querySelectorAll<HTMLElement>('.milspec-split[data-split="left"]')];
    expect(rights).toHaveLength(2);
    expect(rights.map((e) => e.style.clipPath).sort()).toEqual(['inset(-16px -16px -16px 350px)', 'inset(-16px -16px -16px 95px)'].sort());
    expect(leftsEl.map((e) => e.style.clipPath).sort()).toEqual(['inset(-16px calc(100% - 350px) -16px -16px)', 'inset(-16px calc(100% - 95px) -16px -16px)'].sort());
  });

  it('サイドバーを開く: 1 段目で他区画・左の板が 0→+276、台車は 0→+138(60・480)。1 段目の終わり(540)+80 = 620ms 後に change → サイドバーが入る', () => {
    const { app, sbOpenFn, animOf, splitAnims, carriageAnim, zones, anims } = setup({ sbOpen: false });
    relayoutZones(app, sbOpenFn, 'sb', false);
    for (const n of ['rail', 'workspace', 'footer'] as const) {
      expect(animOf(n)[1]).toMatchObject({ duration: 420 });
      expect(lastTransform(animOf(n)[0])).toBe('translate(276px, 0px)');
    }
    expect(splitAnims('left').map((a) => lastTransform(a.frames))).toEqual(['translate(276px, 0px)', 'translate(276px, 0px)']);
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
    expect(app.querySelectorAll('.milspec-split[data-split="right"]')).toHaveLength(2);
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

  it('台車の無い区画では carriage は null', () => {
    const app = document.createElement('div');
    const z = document.createElement('div');
    app.append(z); document.body.append(app);
    expect(splitZone(z, 700).carriage).toBeNull();
  });
});
