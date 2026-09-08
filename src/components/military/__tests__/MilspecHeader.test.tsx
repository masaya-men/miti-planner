// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecHeader } from '../MilspecHeader';
import { useThemeStore } from '../../../store/useThemeStore';
import { TransitionOverlayProvider } from '../../ui/TransitionOverlay';

beforeEach(() => { useThemeStore.setState({ theme: 'dark', themeStyle: 'military' }); localStorage.setItem('milspec-preview', '1'); });
const props = { theme: 'dark' as const, onToggleTheme: vi.fn(), isHeaderCollapsed: false, setIsHeaderCollapsed: vi.fn() };
// LanguageSwitcher / MilspecStyleToggle は useTransitionOverlay() に依存(本番は App 直下の
// TransitionOverlayProvider が既に包んでいる)。MilspecStyleToggle.test.tsx と同じくテストでも provider が必要。
const r = () => render(
  <MemoryRouter><TransitionOverlayProvider><MilspecHeader {...props} /></TransitionOverlayProvider></MemoryRouter>
);

describe('MilspecHeader', () => {
  it('ロゴプレート・遭遇名域・ツールバーを描画', () => {
    const { container } = r();
    expect(container.querySelector('.milspec-hp')).not.toBeNull();
    expect(container.textContent).toMatch(/Combat Analysis System/);
  });
  it('Theme ボタンで onToggleTheme が呼ばれる', () => {
    const { getAllByRole } = r();
    // 注: MilspecStyleToggle(MIL-SPEC⇄標準の切替)の aria-label も「テーマ」を含むため
    // 同一正規表現に一致する。DOM順で先に来る明るさ切替(hud-btn)を [0] で明示的に選ぶ。
    fireEvent.click(getAllByRole('button', { name: /theme|テーマ/i })[0]);
    expect(props.onToggleTheme).toHaveBeenCalled();
  });
  it('折りたたみボタンで setIsHeaderCollapsed が呼ばれる', () => {
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: /collapse|折りたた/i }));
    expect(props.setIsHeaderCollapsed).toHaveBeenCalled();
  });
  it('preview ゲート ON で StyleToggle が出る', () => {
    const { container } = r();
    expect(container.querySelector('[data-milspec-style-toggle], button[aria-label*="MIL-SPEC"], button[aria-label*="標準"]')).not.toBeNull();
  });
  it('タービンスイッチはローカル state（ストアを触らない）', () => {
    const spy = vi.spyOn(useThemeStore.getState(), 'setThemeStyle');
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: /タービン|turbine|TRB/i }));
    expect(spy).not.toHaveBeenCalled();
  });
});
