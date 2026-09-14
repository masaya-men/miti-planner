// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecLayout } from '../MilspecLayout';
import { useThemeStore } from '../../../store/useThemeStore';

const baseProps = {
  isSidebarOpen: true, onToggleSidebar: vi.fn(), onCloseSidebar: vi.fn(),
  isHeaderCollapsed: false, setIsHeaderCollapsed: vi.fn(),
  theme: 'dark' as const, onToggleTheme: vi.fn(),
  partySortOrder: 'light_party' as const, setPartySortOrder: vi.fn(),
  onAutoPlan: vi.fn(), onImportLogs: vi.fn(),
  statusOpen: false, setStatusOpen: vi.fn(),
  localImportProps: { isOpen: false, plans: [], onImport: vi.fn(), onClose: vi.fn() },
  isNewUser: false, showAuthRedirecting: false,
};

const renderIt = () => render(
  <MemoryRouter><MilspecLayout {...baseProps}><div data-testid="child">TIMELINE</div></MilspecLayout></MemoryRouter>
);

describe('MilspecLayout', () => {
  beforeEach(() => { useThemeStore.setState({ theme: 'dark', themeStyle: 'military' }); window.innerWidth = 1489; });

  it('data-app-shell ルートと 5 ゾーン + chrome を描画する', () => {
    // 2026-09-14 masaya 確定: toolbar(パーティ編成等)専用ゾーンは無く、header ゾーンの中に
    // MilspecHeader(上段)/ MilspecToolbar(下段)を縦積みする(ゾーンの高さは header 側のまま)。
    const { container } = renderIt();
    expect(container.querySelector('[data-app-shell]')).not.toBeNull();
    for (const z of ['header', 'sidebar', 'seam', 'workspace', 'footer']) {
      expect(container.querySelector(`[data-ms-zone="${z}"]`)).not.toBeNull();
    }
    expect(container.querySelector('[data-ms-zone="toolbar"]')).toBeNull();
    expect(container.querySelector('[data-ms-zone="header"] .milspec-tb')).not.toBeNull();
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

  // Task 8: 折りたたみ挙動 + MilspecSeam 配線
  it('サイドバー畳み時: sidebar ゾーンから data-open が外れる', () => {
    const { container } = render(
      <MemoryRouter><MilspecLayout {...baseProps} isSidebarOpen={false}><div /></MilspecLayout></MemoryRouter>
    );
    const sb = container.querySelector('[data-ms-zone="sidebar"]')!;
    expect(sb.hasAttribute('data-open')).toBe(false);
  });

  it('ヘッダー畳み時: header ゾーンの子孫 .milspec-hdr に data-collapsed が付く', () => {
    // controller 訂正: data-collapsed は [data-ms-zone="header"] 自身ではなく、
    // その子孫の MilspecHeader.tsx ルート要素(.milspec-hdr)に付与される(実装確認済み)。
    const { container } = render(
      <MemoryRouter><MilspecLayout {...baseProps} isHeaderCollapsed><div /></MilspecLayout></MemoryRouter>
    );
    expect(container.querySelector('[data-ms-zone="header"] .milspec-hdr[data-collapsed]')).not.toBeNull();
  });

  it('seam ゾーンに MilspecSeam が入る', () => {
    const { container } = renderIt();
    expect(container.querySelector('[data-ms-zone="seam"] .milspec-seam')).not.toBeNull();
  });
});
