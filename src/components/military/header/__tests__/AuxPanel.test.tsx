// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import i18n from '../../../../i18n';
import { AuxPanel } from '../AuxPanel';
import { ThemeRocker } from '../ThemeRocker';
import { ModeLever } from '../ModeLever';
import { initPower, disposePower, isPowered } from '../../power/power';
import { TransitionOverlayProvider } from '../../../ui/TransitionOverlay';
import { useThemeStore } from '../../../../store/useThemeStore';
import { usePlanStore } from '../../../../store/usePlanStore';
import { useAuthStore } from '../../../../store/useAuthStore';

const h = vi.hoisted(() => ({ reduced: false, openShareUI: vi.fn(), isOn: false }));
vi.mock('../../../../lib/housing/useReducedMotion', () => ({ useReducedMotion: () => h.reduced }));
vi.mock('../../../collab/useShareFlow', () => ({
  useShareFlow: () => ({ openShareUI: h.openShareUI, isOn: h.isOn, liveCount: 0, active: false, modals: <div data-testid="share-modals" /> }),
}));
vi.mock('../../../LoginModal', () => ({ LoginModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="login-modal" /> : null) }));

const setUser = (u: object | null) => useAuthStore.setState({ user: u as never });
const renderAux = (extra?: Partial<React.ComponentProps<typeof AuxPanel>>) =>
  render(<TransitionOverlayProvider><AuxPanel MW={1189} theme="dark" onToggleTheme={() => {}} {...extra} /></TransitionOverlayProvider>);

beforeEach(async () => {
  await i18n.changeLanguage('ja');
  vi.useFakeTimers();
  h.reduced = false; h.isOn = false; h.openShareUI.mockClear();
  setUser(null);
  usePlanStore.setState({ plans: [], currentPlanId: null, _cloudStatus: 'idle' } as never);
  useThemeStore.setState({ theme: 'dark', themeStyle: 'military' });
  document.body.querySelectorAll('.milspec-wipe').forEach((n) => n.remove());
});
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });

describe('AuxPanel', () => {
  it('刻印 AUX/DSP/MODE/COM と型番 H4 を出す', () => {
    const { container } = renderAux();
    for (const s of ['AUX', 'DSP', 'MODE', 'COM', 'H4']) expect(container.textContent).toContain(s);
  });

  it('チュートリアル・言語のキーを押すとメニューが開き、名前が読める', () => {
    const { getByRole, queryAllByText } = renderAux();
    const tut = getByRole('button', { name: 'チュートリアルを見る' });
    fireEvent.click(tut);
    // メニューは body 直下に出る(キー自身の名前とは別に項目が出る)
    expect(document.body.textContent).toContain('チュートリアル');
    expect(queryAllByText('チュートリアルを見る').length).toBeGreaterThan(0);
    const lang = getByRole('button', { name: '言語切替' });
    fireEvent.click(lang);
    expect(document.body.textContent).toContain('English');
  });

  it('プランが無いときは共有キーを出さない(標準ヘッダーと同じ条件)', () => {
    usePlanStore.setState({ plans: [], currentPlanId: null } as never);
    const { queryByRole } = renderAux();
    expect(queryByRole('button', { name: '共有' })).toBeNull();
  });

  it('共有キーで共有フローが開く / 共同編集中は押し込まれたまま', () => {
    usePlanStore.setState({ plans: [{ id: 'p1' }], currentPlanId: 'p1' } as never);
    const { getByRole, rerender } = renderAux();
    fireEvent.click(getByRole('button', { name: '共有' }));
    expect(h.openShareUI).toHaveBeenCalledTimes(1);
    expect(getByRole('button', { name: '共有' }).hasAttribute('data-pressed')).toBe(false);
    h.isOn = true;
    rerender(<TransitionOverlayProvider><AuxPanel MW={1189} theme="dark" onToggleTheme={() => {}} /></TransitionOverlayProvider>);
    expect(getByRole('button', { name: '共同編集中' }).hasAttribute('data-pressed')).toBe(true);
  });

  it('同期キー: 未ログインでは出ず、ログイン + プランありで出て押すと同期する', () => {
    const { queryByRole, rerender } = renderAux();
    expect(queryByRole('button', { name: '保存済み' })).toBeNull();
    const manualSync = vi.fn(() => Promise.resolve());
    setUser({ uid: 'u1' });
    usePlanStore.setState({ currentPlanId: 'p1', manualSync, updatePlan: vi.fn() } as never);
    rerender(<TransitionOverlayProvider><AuxPanel MW={1189} theme="dark" onToggleTheme={() => {}} /></TransitionOverlayProvider>);
    fireEvent.click(queryByRole('button', { name: '保存済み' })!);
    expect(manualSync).toHaveBeenCalledWith('u1', 'User');
  });

  it('ログインキーで LoginModal が開く', () => {
    const { getByRole, queryByTestId } = renderAux();
    expect(queryByTestId('login-modal')).toBeNull();
    fireEvent.click(getByRole('button', { name: 'ログイン' }));
    expect(queryByTestId('login-modal')).toBeTruthy();
  });

  it('頭文字の刻印', () => {
    setUser({ uid: 'u1' });
    useAuthStore.setState({ profileDisplayName: 'masa' } as never);
    const { getByRole } = renderAux();
    expect(getByRole('button', { name: 'ログイン' }).textContent).toContain('M');
  });
});

describe('ThemeRocker', () => {
  it('押すと走査線が出て 360ms 後に onToggle・走査線は後で消える', () => {
    const onToggle = vi.fn();
    const { getByRole } = render(<ThemeRocker theme="dark" onToggle={onToggle} />);
    const btn = getByRole('button', { name: 'テーマ' });
    expect(btn.getAttribute('data-v')).toBe('night');
    fireEvent.click(btn);
    expect(btn.getAttribute('data-v')).toBe('day');
    expect(document.body.querySelector('.milspec-wipe')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(359); });
    expect(onToggle).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onToggle).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(document.body.querySelector('.milspec-wipe')).toBeNull();
  });

  it('動きを減らす設定なら即時(走査線なし)', () => {
    h.reduced = true;
    const onToggle = vi.fn();
    const { getByRole } = render(<ThemeRocker theme="light" onToggle={onToggle} />);
    fireEvent.click(getByRole('button', { name: 'テーマ' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('.milspec-wipe')).toBeNull();
  });
});

describe('ModeLever', () => {
  const lever = () => render(<ModeLever x={0} y={0} w={36} h={30} />);
  const spies: { mockRestore: () => void }[] = [];
  const spy = () => { const s = vi.spyOn(useThemeStore.getState(), 'setThemeStyle'); spies.push(s); return s; };
  // 電源断(300ms)の Promise を進めるため非同期で時間を進める
  const flush = (ms = 1500) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  beforeEach(() => { vi.stubEnv('DEV', true); });
  afterEach(() => { vi.unstubAllEnvs(); spies.splice(0).forEach((s) => s.mockRestore()); disposePower(); window.history.replaceState({}, '', '/'); });

  it('電源 on で開くと aria-checked=true。クリックで上がり、240ms + 電源断 300ms の後に標準へ', async () => {
    const s = spy();
    const { getByRole } = lever();
    const sw = getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    await flush(500);
    expect(isPowered()).toBe(false); // 電源断は始まっている
    expect(s).not.toHaveBeenCalled(); // 300ms の電源断が終わるまで標準へは戻らない
    await flush(100);
    expect(s).toHaveBeenCalledWith('standard');
    expect(useThemeStore.getState().themeStyle).toBe('standard');
  });

  it('切替が実行されなくても、1500ms 後にレバーは下へ戻り電源も入り直す', async () => {
    const s = spy();
    s.mockImplementation(() => {}); // 切替が実行されず軍事のまま
    const { getByRole } = lever();
    const sw = getByRole('switch');
    fireEvent.click(sw);
    await flush(600);
    await flush(1600);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(isPowered()).toBe(true);
    s.mockClear();
    fireEvent.click(sw); // 再操作できる
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('ポインタのドラッグで上へ引き上げても標準へ / 中途半端なら戻って切り替えない', async () => {
    const s = spy();
    const { getByRole } = lever();
    const sw = getByRole('switch');
    fireEvent.pointerDown(sw, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(sw, { clientY: 99, pointerId: 1 });
    fireEvent.pointerMove(sw, { clientY: 95, pointerId: 1 }); // 18→13: 中間(10)より下
    fireEvent.pointerUp(sw, { pointerId: 1 });
    await flush();
    expect(s).not.toHaveBeenCalled();
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.pointerDown(sw, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(sw, { clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(sw, { pointerId: 1 });
    await flush();
    expect(s).toHaveBeenCalledWith('standard');
  });

  it('キーボード(Space / Enter)でも切り替わる', async () => {
    const s = spy();
    const { getByRole } = lever();
    fireEvent.keyDown(getByRole('switch'), { key: ' ' });
    await flush();
    expect(s).toHaveBeenCalledWith('standard');
  });

  it('電源 off で開くとレバーは上(aria-checked=false)。700ms で下り、240ms 後に電源が入る', async () => {
    initPower(); // 既定は off
    const { getByRole } = lever();
    const sw = getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(isPowered()).toBe(false);
    await flush(699);
    expect(sw.getAttribute('aria-checked')).toBe('false');
    await flush(1);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await flush(239);
    expect(isPowered()).toBe(false);
    await flush(1);
    expect(isPowered()).toBe(true);
  });

  it('自動で下りてから電源が入るまでの 240ms の間に上げると、標準へ進む', async () => {
    initPower();
    const s = spy();
    const { getByRole } = lever();
    const sw = getByRole('switch');
    await flush(700); // 自動で下りた
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw); // 電源が入る前に上げる
    expect(sw.getAttribute('aria-checked')).toBe('false');
    await flush(1000);
    expect(s).toHaveBeenCalledWith('standard');
  });

  it('ドラッグ中は自動で下ろさない', async () => {
    initPower();
    const { getByRole } = lever();
    const sw = getByRole('switch');
    fireEvent.pointerDown(sw, { clientY: 100, pointerId: 1 });
    await flush(900);
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('aria-label は上でも下でも「見た目を切り替える」', async () => {
    initPower();
    const { getByRole } = lever();
    const sw = getByRole('switch');
    expect(sw.getAttribute('aria-label')).toBe(i18n.t('app.theme_style_switch'));
    await flush(1000);
    expect(sw.getAttribute('aria-label')).toBe(i18n.t('app.theme_style_switch'));
  });

  it('L1: ガラス窓・左右のラック・溝を流れる光がある', () => {
    const { container } = lever();
    expect(container.querySelectorAll('.milspec-mlv-rack')).toHaveLength(2);
    expect(container.querySelector('.milspec-mlv-glass')).not.toBeNull();
    expect(container.querySelector('.milspec-mlv-slot .milspec-mlv-run')).not.toBeNull();
  });

  it('StrictMode で描画しても電源が入る', async () => {
    initPower();
    render(<React.StrictMode><ModeLever x={0} y={0} w={36} h={30} /></React.StrictMode>);
    await flush(1000);
    expect(isPowered()).toBe(true);
  });

  it('?noboot なら最初から on で、レバーは自動で動かない', async () => {
    window.history.replaceState({}, '', '/?noboot');
    initPower();
    const { getByRole } = lever();
    expect(getByRole('switch').getAttribute('aria-checked')).toBe('true');
    await flush(2000);
    expect(isPowered()).toBe(true);
  });

  it('アンマウントでタイマーが残らない(電源投入が走らない)', async () => {
    initPower();
    const { unmount } = lever();
    unmount();
    await flush(2000);
    expect(isPowered()).toBe(false);
  });

  it('WIP 公開条件を満たさないと出ない', () => {
    vi.stubEnv('DEV', false);
    useAuthStore.setState({ isAdmin: false } as never);
    const { queryByRole } = lever();
    expect(queryByRole('switch')).toBeNull();
  });
});
