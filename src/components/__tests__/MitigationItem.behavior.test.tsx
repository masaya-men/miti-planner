// @vitest-environment happy-dom
// MitigationItem の振る舞い(右クリックで消す・長押しで消す・ドラッグで時間変更・置けない時のトースト・棒クリックの転送・対象バッジ)を固める。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('../../lib/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {},
  analytics: Promise.resolve(null),
  ensureAppCheck: () => null,
  getActiveAppCheck: () => null,
}));
vi.mock('../../lib/appCheck', () => ({
  createLazyAppCheck: () => ({ ensureAppCheck: () => null, getActiveAppCheck: () => null }),
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: () => () => {},
  signInWithCustomToken: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
  getAuth: vi.fn(),
}));
vi.mock('firebase/app-check', () => ({
  getToken: vi.fn(),
  initializeAppCheck: vi.fn(),
  ReCaptchaV3Provider: vi.fn(),
}));
vi.mock('firebase/firestore', () => {
  const passthrough = (...args: unknown[]) =>
    typeof args[args.length - 1] === 'function' ? () => {} : {};
  return new Proxy({} as Record<string, unknown>, { get: (t, p: string) => (p in t ? t[p] : passthrough) });
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, f?: unknown) => (typeof f === 'string' ? f : k),
    i18n: { language: 'ja', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
  I18nextProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import React from 'react';
import { MitigationItem } from '../timeline/MitigationItem';
import { computeRowLayout } from '../timeline/rowLayout';
import { useMitigationStore } from '../../store/useMitigationStore';

const times = Array.from({ length: 200 }, (_, i) => i - 10);
const rowLayout = computeRowLayout({
  times, eventCountAt: () => 1, hasMitigationStartAt: () => false,
  hideEmptyRows: false, maxPopulatedTime: -11, unitPx: 25,
});
const mitigation = { id: 'b-m1', mitigationId: 'vengeance', ownerId: 'MT', time: 30, duration: 15 };

function setup(over: Record<string, unknown> = {}) {
  const onRemove = vi.fn();
  const onUpdateTime = vi.fn();
  const onCellClick = vi.fn();
  const scrollContainerRef = { current: document.createElement('div') };
  const utils = render(
    <MitigationItem
      mitigation={mitigation as never}
      rowLayout={rowLayout}
      onRemove={onRemove}
      onUpdateTime={onUpdateTime}
      top={rowLayout.topOf(30)}
      height={100}
      left={10}
      scrollContainerRef={scrollContainerRef}
      activeMitigations={[mitigation as never]}
      onCellClick={onCellClick}
      {...over}
    />,
  );
  const icon = utils.container.querySelector('[data-mit-icon]')!.parentElement!.parentElement as HTMLElement;
  return { ...utils, onRemove, onUpdateTime, onCellClick, icon };
}

beforeEach(() => {
  useMitigationStore.setState({ myMemberId: null } as never);
  (HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  (HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('MitigationItem: 振る舞い', () => {
  it('右クリックで onRemove が呼ばれる', () => {
    const { icon, onRemove } = setup();
    fireEvent.contextMenu(icon);
    expect(onRemove).toHaveBeenCalledWith('b-m1');
  });

  it('仮想アイテムは右クリックしても消えない', () => {
    const { icon, onRemove } = setup({ isVirtual: true });
    fireEvent.contextMenu(icon);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('スプシ表示(小さいアイコン)は右クリックでも消えない', () => {
    const { icon, onRemove } = setup({ iconPx: 10 });
    fireEvent.contextMenu(icon);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('長押し 600ms で消え、途中で動かすと消えない', () => {
    vi.useFakeTimers();
    const a = setup();
    fireEvent.touchStart(a.icon);
    act(() => { vi.advanceTimersByTime(650); });
    expect(a.onRemove).toHaveBeenCalledWith('b-m1');
    cleanup();
    const b = setup();
    fireEvent.touchStart(b.icon);
    fireEvent.touchMove(b.icon);
    act(() => { vi.advanceTimersByTime(650); });
    expect(b.onRemove).not.toHaveBeenCalled();
  });

  it('下へドラッグして離すと onUpdateTime が新しい時間で呼ばれる', () => {
    const { icon, onUpdateTime } = setup();
    fireEvent.pointerDown(icon, { button: 0, clientX: 0, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(icon, { clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(icon, { clientY: 150, clientX: 0, pointerId: 1 });
    expect(onUpdateTime).toHaveBeenCalledWith('b-m1', 32);
  });

  it('動かさずに離すと onUpdateTime は呼ばれず、onIconTap が呼ばれる', () => {
    const onIconTap = vi.fn();
    const { icon, onUpdateTime } = setup({ onIconTap });
    fireEvent.pointerDown(icon, { button: 0, clientX: 0, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(icon, { clientY: 100, clientX: 0, pointerId: 1 });
    expect(onUpdateTime).not.toHaveBeenCalled();
    expect(onIconTap).toHaveBeenCalledTimes(1);
  });

  it('効果棒をクリックすると onCellClick へ持ち主と秒が転送される', () => {
    const { container, onCellClick } = setup();
    fireEvent.click(container.querySelector('[data-mit-bar]')!, { clientY: 0 });
    expect(onCellClick).toHaveBeenCalledTimes(1);
    expect(onCellClick.mock.calls[0][0]).toBe('MT');
    expect(typeof onCellClick.mock.calls[0][1]).toBe('number');
  });

  it('対象がある時は対象バッジが出る', () => {
    const { container } = setup({ mitigation: { ...mitigation, targetId: 'H1' } });
    expect(container.textContent).toContain('H1');
  });

  it('対象が無い時は対象バッジが出ない', () => {
    const { container } = setup();
    expect(container.textContent).not.toContain('H1');
  });

  it('置けない場所へ離すと onUpdateTime は呼ばれず、トーストが出て 2.5 秒で消える', () => {
    vi.useFakeTimers();
    // アストラルドローは同じ種類を連続で置けない(直前のドローと交互制約)
    const draw = { id: 'b-m1', mitigationId: 'astral_draw', ownerId: 'MT', time: 30, duration: 15 };
    const other = { id: 'b-m2', mitigationId: 'astral_draw', ownerId: 'MT', time: 20, duration: 15 };
    const { icon, onUpdateTime, container } = setup({ mitigation: draw, activeMitigations: [draw, other] as never });
    fireEvent.pointerDown(icon, { button: 0, clientX: 0, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(icon, { clientY: 150, clientX: 0, pointerId: 1 });
    expect(onUpdateTime).not.toHaveBeenCalled();
    expect(container.ownerDocument.body.textContent).toContain('timeline.cannot_place_here');
    act(() => { vi.advanceTimersByTime(2600); });
    expect(container.ownerDocument.body.textContent).not.toContain('timeline.cannot_place_here');
  });
});
