// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { relayoutZones, cancelRelayout } from '../relayout';
import { setup } from './relayoutTestSetup';

describe('relayoutZones(2 段階の開閉)', () => {
  const origAnimate = (HTMLElement.prototype as unknown as { animate: unknown }).animate;
  beforeEach(() => { document.body.innerHTML = ''; vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); (HTMLElement.prototype as unknown as { animate: unknown }).animate = origAnimate; });

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
