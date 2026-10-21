// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { useRef } from 'react';

let reduced = false;
vi.mock('../../../../lib/housing/useReducedMotion', () => ({ useReducedMotion: () => reduced }));
vi.mock('../../../../store/useMitigationStore', () => ({
  useMitigationStore: { getState: () => ({ partyMembers: [{ id: 'MT', jobId: 'war' }] }) },
}));

import { MilspecReticle } from '../MilspecReticle';

/** 表の器の中に、時刻セル・攻撃の段・効果アイコンを持つ最小の DOM(実 DOM と同じ属性・入れ子)を作る */
function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="timeline-scroll-container" data-testid="scroller"><div ref={ref} data-testid="root">
      <div data-time-row="75">
        <div />
        <div />
        <div data-testid="tm" />
        <div>
          <div data-event-slot="" data-testid="slot0" />
          <div data-event-slot="" data-testid="slot1" />
        </div>
      </div>
      <div className="group">
        <div>
          <div>
            <div data-mit-icon="" data-mit-t="30" data-mit-owner="MT" data-mit-dur="15" data-testid="icon" />
          </div>
        </div>
        <div data-mit-bar="" data-testid="bar" />
      </div>
      <div data-testid="empty" />
      <MilspecReticle rootRef={ref} />
    </div></div>
  );
}

const rect = (l: number, t: number, w: number, h: number) =>
  ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t, toJSON: () => ({}) }) as DOMRect;

function over(el: Element) {
  act(() => { el.dispatchEvent(new Event('pointerover', { bubbles: true })); });
}

describe('MilspecReticle(表の照準)', () => {
  beforeEach(() => {
    reduced = false;
    // rAF は即時に実行(まとめ書きの結果だけ見る)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  function setup() {
    const r = render(<Harness />);
    const q = (id: string) => r.getByTestId(id) as HTMLElement;
    q('root').getBoundingClientRect = () => rect(100, 50, 1000, 800);
    q('icon').getBoundingClientRect = () => rect(300, 90, 24, 24);
    q('slot1').getBoundingClientRect = () => rect(200, 150, 400, 25);
    q('tm').getBoundingClientRect = () => rect(150, 100, 50, 25);
    const ret = r.container.querySelector('.milspec-ret') as HTMLElement;
    return { q, ret, tag: ret.querySelector('.milspec-ret-tag') as HTMLElement };
  }

  it('効果アイコンに乗ると、器基準の位置(余白 4px)とタグ(時刻・ジョブ・秒)が出る', () => {
    const { q, ret, tag } = setup();
    over(q('icon'));
    expect(ret.classList.contains('on')).toBe(true);
    expect(ret.style.transform).toBe('translate(196.0px, 36.0px)'); // 300-100-4 / 90-50-4
    expect(ret.style.width).toBe('32px');
    expect(tag.textContent).toBe('T+0:30 · WAR · 15s');
    expect(ret.classList.contains('lock')).toBe(true);
  });

  it('効果帯に乗っても同じアイコンを狙う', () => {
    const { q, ret, tag } = setup();
    over(q('bar'));
    expect(ret.classList.contains('on')).toBe(true);
    expect(tag.textContent).toBe('T+0:30 · WAR · 15s');
  });

  it('攻撃の段は「何本目/全体」・時刻セルは「同時刻の数」をタグに出す', () => {
    const { q, tag } = setup();
    over(q('slot1'));
    expect(tag.textContent).toBe('T+1:15 · ATK 2/2');
    over(q('tm'));
    expect(tag.textContent).toBe('T+1:15 · 2 EVT');
  });

  it('対象のない所に出ると消える・pointerleave でも消える', () => {
    const { q, ret } = setup();
    over(q('icon'));
    over(q('empty'));
    expect(ret.classList.contains('on')).toBe(false);
    over(q('icon'));
    expect(ret.classList.contains('on')).toBe(true);
    act(() => { q('root').dispatchEvent(new Event('pointerleave')); });
    expect(ret.classList.contains('on')).toBe(false);
  });

  it('右端で足りないときはタグを左へ折り返す(flip)', () => {
    const { q, ret } = setup();
    // 表の見えている右端(クリップ)をアイコンのすぐ右に置く
    const scroller = q('scroller');
    Object.defineProperty(scroller, 'clientWidth', { value: 260, configurable: true });
    scroller.getBoundingClientRect = () => rect(100, 50, 260, 800); // 右端 = 360
    over(q('icon'));
    expect(ret.classList.contains('flip')).toBe(true);
    over(q('slot1'));
    expect(ret.classList.contains('flip')).toBe(true);
  });

  it('動きを減らす設定では吸い付く動きも lock の演出も付けない', () => {
    reduced = true;
    const { q, ret } = setup();
    over(q('icon'));
    expect(ret.getAttribute('data-reduced')).not.toBeNull();
    expect(ret.style.transition).toBe('none');
    expect(ret.classList.contains('lock')).toBe(false);
    expect(ret.classList.contains('on')).toBe(true);
  });

  it('ボタンを押している間(ドラッグ中)は出さない', () => {
    const { q, ret } = setup();
    act(() => { q('icon').dispatchEvent(Object.assign(new Event('pointerover', { bubbles: true }), { buttons: 1 })); });
    expect(ret.classList.contains('on')).toBe(false);
  });
});
