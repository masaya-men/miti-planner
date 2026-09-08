// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecLayout } from '../MilspecLayout';
import { useThemeStore } from '../../../store/useThemeStore';
import { TransitionOverlayProvider } from '../../ui/TransitionOverlay';

const baseProps = {
  isSidebarOpen: true, onToggleSidebar: vi.fn(), onCloseSidebar: vi.fn(),
  isHeaderCollapsed: false, setIsHeaderCollapsed: vi.fn(),
  theme: 'dark' as const, onToggleTheme: vi.fn(),
  partySortOrder: 'light_party' as const, setPartySortOrder: vi.fn(),
  onAutoPlan: vi.fn(), onImportLogs: vi.fn(),
  statusOpen: false, setStatusOpen: vi.fn(),
  localImportProps: { isOpen: false, plans: [], onImport: vi.fn(), onClose: vi.fn() },
};

// Task 4: MilspecHeader が LanguageSwitcher / MilspecStyleToggle 経由で useTransitionOverlay() に
// 依存するようになった(本番は App.tsx 直下の TransitionOverlayProvider が既に包んでいる)。
const renderIt = () => render(
  <MemoryRouter><TransitionOverlayProvider><MilspecLayout {...baseProps}><div data-testid="child">TIMELINE</div></MilspecLayout></TransitionOverlayProvider></MemoryRouter>
);

describe('MilspecLayout', () => {
  beforeEach(() => { useThemeStore.setState({ theme: 'dark', themeStyle: 'military' }); window.innerWidth = 1489; });

  it('data-app-shell ルートと 6 ゾーン + chrome を描画する', () => {
    const { container } = renderIt();
    expect(container.querySelector('[data-app-shell]')).not.toBeNull();
    for (const z of ['header', 'sidebar', 'seam', 'toolbar', 'workspace', 'footer']) {
      expect(container.querySelector(`[data-ms-zone="${z}"]`)).not.toBeNull();
    }
    expect(container.querySelector('.milspec-console-frame')).not.toBeNull(); // MilspecChrome
  });

  it('children をワークスペースゾーンの中に埋め込む', () => {
    const { container } = renderIt();
    const ws = container.querySelector('[data-ms-zone="workspace"]')!;
    expect(ws.querySelector('[data-testid="child"]')).not.toBeNull();
  });

  it('ルートに grid + container-max 尊重のスタイルフックが付く', () => {
    const { container } = renderIt();
    const root = container.querySelector('[data-app-shell]') as HTMLElement;
    expect(root.className).toMatch(/milspec-app/); // グリッドは .milspec-app クラス経由（military.css）
  });
});
