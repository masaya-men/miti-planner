// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import i18n from '../../../../i18n';
import { MilspecControlDeck, type MilspecControlDeckProps } from '../MilspecControlDeck';
import { deckPanel, boardPanel, DECK_W } from '../deckGeometry';
import type { PanelSpec } from '../../armor/types';

const h = vi.hoisted(() => ({ reduced: false, traffic: vi.fn() }));
vi.mock('../../../../lib/housing/useReducedMotion', () => ({ useReducedMotion: () => h.reduced }));
vi.mock('../../fx/engine', async (orig) => ({ ...(await orig<typeof import('../../fx/engine')>()), trafficBp: h.traffic }));

const base = (): MilspecControlDeckProps => ({
  hideEmptyRows: true, onToggleHideEmpty: vi.fn(),
  isMemoMode: false, onToggleMemo: vi.fn(),
  showRowBorders: true, onToggleRowBorders: vi.fn(),
  pipSupported: true, pipActive: false, pipMenuRef: { current: null }, onPipEnter: vi.fn(), onPipLeave: vi.fn(), onPipClick: vi.fn(),
  recastRowVisible: false, onToggleRecast: vi.fn(),
  isAaModeEnabled: false, onAaClick: vi.fn(), aaKeyRef: { current: null },
  canUndo: true, canRedo: true, readOnly: false, onUndo: vi.fn(), onRedo: vi.fn(),
  onClearClick: vi.fn(), clearKeyRef: { current: null },
});
const q = (c: HTMLElement, k: string) => c.querySelector(`[data-deck="${k}"]`) as HTMLButtonElement;

beforeEach(async () => { await i18n.changeLanguage('ja'); h.reduced = false; h.traffic.mockClear(); vi.useFakeTimers(); });
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });

describe('MilspecControlDeck', () => {
  it('スイッチは role=switch・aria-checked・aria-label を持つ', () => {
    const p = base();
    const { container } = render(<MilspecControlDeck {...p} hideEmptyRows={false} isMemoMode />);
    const expand = q(container, 'expand');
    expect(expand.getAttribute('role')).toBe('switch');
    expect(expand.getAttribute('aria-checked')).toBe('true'); // 表を展開 = 空行も出す = hideEmptyRows が false
    expect(expand.getAttribute('aria-label')).toBeTruthy();
    for (const k of ['memo', 'borders', 'pip', 'recast']) {
      const b = q(container, k);
      expect(b.getAttribute('role')).toBe('switch');
      expect(b.getAttribute('aria-label')).toBeTruthy();
    }
    expect(q(container, 'memo').getAttribute('aria-checked')).toBe('true');
    expect(q(container, 'borders').getAttribute('aria-checked')).toBe('true');
    expect(q(container, 'recast').getAttribute('aria-checked')).toBe('false');
  });

  it('各スイッチを押すと対応する関数が 1 回呼ばれ、光 trafficBp が出る', () => {
    const p = base();
    const { container } = render(<MilspecControlDeck {...p} />);
    fireEvent.click(q(container, 'expand')); expect(p.onToggleHideEmpty).toHaveBeenCalledTimes(1); expect(h.traffic).toHaveBeenLastCalledWith(560);
    fireEvent.click(q(container, 'memo')); expect(p.onToggleMemo).toHaveBeenCalledTimes(1); expect(h.traffic).toHaveBeenLastCalledWith(260);
    fireEvent.click(q(container, 'borders')); expect(p.onToggleRowBorders).toHaveBeenCalledTimes(1);
    fireEvent.click(q(container, 'recast')); expect(p.onToggleRecast).toHaveBeenCalledTimes(1);
    fireEvent.click(q(container, 'pip')); expect(p.onPipClick).toHaveBeenCalledTimes(1);
  });

  it('PiP は未対応なら出さず、ホバーの出入りを PiP の枠へ渡す', () => {
    const p = base();
    const { container, rerender } = render(<MilspecControlDeck {...p} />);
    const wrap = q(container, 'pip').closest('.milspec-hr-u') as HTMLElement;
    fireEvent.mouseEnter(wrap); expect(p.onPipEnter).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(wrap); expect(p.onPipLeave).toHaveBeenCalledTimes(1);
    rerender(<MilspecControlDeck {...p} pipSupported={false} />);
    expect(q(container, 'pip')).toBeNull();
  });

  it('キー(AA・元に戻す・やり直す・削除)は押すと関数が呼ばれ trafficBp(150)', () => {
    const p = base();
    const { container } = render(<MilspecControlDeck {...p} />);
    fireEvent.click(q(container, 'aa')); expect(p.onAaClick).toHaveBeenCalledTimes(1); expect(h.traffic).toHaveBeenLastCalledWith(150);
    fireEvent.click(q(container, 'undo')); expect(p.onUndo).toHaveBeenCalledTimes(1);
    fireEvent.click(q(container, 'redo')); expect(p.onRedo).toHaveBeenCalledTimes(1);
    fireEvent.click(q(container, 'clear')); expect(p.onClearClick).toHaveBeenCalledTimes(1);
  });

  it('ポップオーバーの基準 ref は AA キー・削除キーの button を指す', () => {
    const p = base();
    const { container } = render(<MilspecControlDeck {...p} />);
    expect(p.aaKeyRef.current).toBe(q(container, 'aa'));
    expect(p.clearKeyRef.current).toBe(q(container, 'clear'));
  });

  it('元に戻す/やり直しは canUndo/canRedo が false か読み取り専用で押せない', () => {
    const p = base();
    const { container, rerender } = render(<MilspecControlDeck {...p} canUndo={false} />);
    expect(q(container, 'undo').disabled).toBe(true);
    expect(q(container, 'redo').disabled).toBe(false);
    fireEvent.click(q(container, 'undo')); expect(p.onUndo).not.toHaveBeenCalled();
    rerender(<MilspecControlDeck {...p} readOnly />);
    expect(q(container, 'undo').disabled).toBe(true);
    expect(q(container, 'redo').disabled).toBe(true);
    expect(q(container, 'clear').disabled).toBe(true);
    fireEvent.click(q(container, 'clear')); expect(p.onClearClick).not.toHaveBeenCalled();
  });

  it('AA モード中はキーが押された状態(aria-pressed)', () => {
    const { container } = render(<MilspecControlDeck {...base()} isAaModeEnabled />);
    expect(q(container, 'aa').getAttribute('aria-pressed')).toBe('true');
  });

  it('ロッカーのランプは ON にした 200ms 後に点く(OFF は即消える)', () => {
    const p = base();
    const { container, rerender } = render(<MilspecControlDeck {...p} />);
    const lamp = () => q(container, 'recast').closest('.milspec-hr-u')!.querySelector('.milspec-led')!;
    expect(lamp().classList.contains('is-on')).toBe(false);
    rerender(<MilspecControlDeck {...p} recastRowVisible />);
    expect(lamp().classList.contains('is-on')).toBe(false);
    act(() => { vi.advanceTimersByTime(210); });
    expect(lamp().classList.contains('is-on')).toBe(true);
    rerender(<MilspecControlDeck {...p} recastRowVisible={false} />);
    expect(lamp().classList.contains('is-on')).toBe(false);
  });

  it('横スライドは押すとつまみが WAAPI で 620ms 動く(reduced なら動かさない)', () => {
    const p = base();
    const anim = vi.fn(() => ({ cancel: vi.fn() }));
    const { container, unmount } = render(<MilspecControlDeck {...p} />);
    const kn = container.querySelector('.milspec-hs-kn') as HTMLElement;
    kn.animate = anim as never;
    fireEvent.click(q(container, 'expand'));
    expect(anim).toHaveBeenCalledTimes(1);
    expect((anim.mock.calls[0] as unknown[])[1]).toMatchObject({ duration: 620 });
    unmount();
    h.reduced = true;
    const r2 = render(<MilspecControlDeck {...p} />);
    const kn2 = r2.container.querySelector('.milspec-hs-kn') as HTMLElement;
    const anim2 = vi.fn();
    kn2.animate = anim2 as never;
    fireEvent.click(q(r2.container, 'expand'));
    expect(anim2).not.toHaveBeenCalled();
  });

  it('漏れ光の経路 lk:tb は操作列の幅いっぱい', () => {
    const { container } = render(<MilspecControlDeck {...base()} />);
    const t = container.querySelector('path[data-trace="lk:tb"]');
    expect(t?.getAttribute('d')).toBe(`M 0 -2 H ${DECK_W}`);
  });
});

describe('deckGeometry', () => {
  it('操作列の装甲は 3 つの凹み(AA・丸キー 2 つ・削除)を持つ', () => {
    const p = deckPanel();
    expect(p.w).toBe(DECK_W);
    expect((p.spec as PanelSpec).pockets).toHaveLength(3);
  });
  it('副装甲は基板の床の窪みを 1 つ持つ', () => {
    expect((boardPanel().spec as PanelSpec).pockets).toHaveLength(1);
  });
});
