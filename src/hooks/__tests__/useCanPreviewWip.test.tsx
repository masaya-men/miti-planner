// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecHeader } from '../../components/military/MilspecHeader';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore, applyThemeClasses, useEffectiveThemeStyle } from '../../store/useThemeStore';

const props = { theme: 'dark' as const, onToggleTheme: vi.fn(), isHeaderCollapsed: false, setIsHeaderCollapsed: vi.fn() };
const TOGGLE = 'button[aria-pressed]';
const renderHeader = () => render(<MemoryRouter><MilspecHeader {...props} /></MemoryRouter>);

/** App.tsx / Layout.tsx と同じ「実際に使うスタイル」の使い方を再現する最小プローブ。 */
const Probe: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);
  const style = useEffectiveThemeStyle();
  React.useEffect(() => { applyThemeClasses(theme, style); }, [theme, style]);
  return <div data-testid="layout">{style === 'military' ? 'MILSPEC' : 'STANDARD'}</div>;
};

beforeEach(() => {
  document.documentElement.className = '';
  useThemeStore.setState({ theme: 'dark', themeStyle: 'military' });
  useAuthStore.setState({ isAdmin: false });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('WIP プレビューのゲート(DEV か管理者)', () => {
  it('(a) DEV でなく非管理者ならスタイル切替ボタンが出ない', () => {
    vi.stubEnv('DEV', false);
    expect(renderHeader().container.querySelector(TOGGLE)).toBeNull();
  });

  it('(b) 管理者なら DEV でなくても切替ボタンが出る', () => {
    vi.stubEnv('DEV', false);
    useAuthStore.setState({ isAdmin: true });
    expect(renderHeader().container.querySelector(TOGGLE)).not.toBeNull();
  });

  it('(c) 保存が military でも非管理者は標準レイアウトで <html> に theme-military が付かない(保存値は残る)', () => {
    vi.stubEnv('DEV', false);
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('layout').textContent).toBe('STANDARD');
    expect(document.documentElement.classList.contains('theme-military')).toBe(false);
    // 非管理者が明るさを切り替えても軍事クラスは付かない
    act(() => { useThemeStore.getState().setTheme('light'); });
    expect(document.documentElement.classList.contains('theme-military')).toBe(false);
    expect(useThemeStore.getState().themeStyle).toBe('military');
  });

  it('(d) 管理者になると軍事に切り替わり、外れると標準へ戻る', () => {
    vi.stubEnv('DEV', false);
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('layout').textContent).toBe('STANDARD');
    act(() => { useAuthStore.setState({ isAdmin: true }); });
    expect(getByTestId('layout').textContent).toBe('MILSPEC');
    expect(document.documentElement.classList.contains('theme-military')).toBe(true);
    act(() => { useAuthStore.setState({ isAdmin: false }); });
    expect(getByTestId('layout').textContent).toBe('STANDARD');
    expect(document.documentElement.classList.contains('theme-military')).toBe(false);
  });
});
