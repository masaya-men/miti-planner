// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
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

  it('背景動画レイヤーをルート直下の先頭に描画する', () => {
    const { container } = renderIt();
    const root = container.querySelector('[data-app-shell]')!;
    expect(root.firstElementChild?.hasAttribute('data-ms-backdrop')).toBe(true);
  });

  it('data-app-shell ルートと 5 ゾーン(rail 含む)を描画する', () => {
    // 2026-09-14 masaya 確定: toolbar(パーティ編成等)専用ゾーンは無く、header ゾーンの中に
    // MilspecHeader(上段)/ MilspecToolbar(下段)を縦積みする(ゾーンの高さは header 側のまま)。
    const { container } = renderIt();
    expect(container.querySelector('[data-app-shell]')).not.toBeNull();
    for (const z of ['header', 'sidebar', 'rail', 'workspace', 'footer']) {
      expect(container.querySelector(`[data-ms-zone="${z}"]`)).not.toBeNull();
    }
    expect(container.querySelector('[data-ms-zone="toolbar"]')).toBeNull();
    expect(container.querySelector('[data-ms-zone="header"] .milspec-tb')).not.toBeNull();
    expect(container.querySelector('[data-ms-zone="seam"]')).toBeNull();
    expect(container.querySelector('.milspec-console-frame')).toBeNull();
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

  // Task 8: 折りたたみ挙動 + rail 配線
  it('サイドバー畳み時: sidebar ゾーンから data-open が外れる', () => {
    const { container } = render(
      <MemoryRouter><MilspecLayout {...baseProps} isSidebarOpen={false}><div /></MilspecLayout></MemoryRouter>
    );
    const sb = container.querySelector('[data-ms-zone="sidebar"]')!;
    expect(sb.hasAttribute('data-open')).toBe(false);
  });

  it('ヘッダー畳み時: header ゾーン自身に data-collapsed が付く', () => {
    const { container } = render(
      <MemoryRouter><MilspecLayout {...baseProps} isHeaderCollapsed><div /></MilspecLayout></MemoryRouter>
    );
    expect(container.querySelector('[data-ms-zone="header"][data-collapsed]')).not.toBeNull();
    const open = renderIt().container;
    expect(open.querySelector('[data-ms-zone="header"][data-collapsed]')).toBeNull();
  });

  it('通気口の取っ手を引くと(260ms 後)ヘッダーの開閉 setter が呼ばれる・閉じていても取っ手はある', () => {
    vi.useFakeTimers();
    try {
      const set = vi.fn();
      const { container } = render(
        <MemoryRouter><MilspecLayout {...baseProps} setIsHeaderCollapsed={set}><div /></MilspecLayout></MemoryRouter>
      );
      const pull = container.querySelector('[data-ms-zone="vent"] button.milspec-pull') as HTMLElement;
      expect(pull).not.toBeNull();
      fireEvent.click(pull);
      act(() => { vi.advanceTimersByTime(300); });
      expect(set).toHaveBeenCalledWith(true);
      const closed = render(
        <MemoryRouter><MilspecLayout {...baseProps} isHeaderCollapsed><div /></MilspecLayout></MemoryRouter>
      ).container;
      expect(closed.querySelector('[data-ms-zone="vent"] button.milspec-pull')).not.toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it('通気口の区画(vent)があり、ヘッダーと通気口の中身は縮小用の内箱に入る', () => {
    const { container } = renderIt();
    expect(container.querySelector('[data-ms-zone="vent"].milspec-zone-vent')).not.toBeNull();
    expect(container.querySelector('[data-ms-zone="header"] > .milspec-hs-box')).not.toBeNull();
    expect(container.querySelector('[data-ms-zone="vent"] > .milspec-hs-box')).not.toBeNull();
  });

  describe('--ms-hs(縮小率)', () => {
    let fire: (w: number) => void;
    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', class {
        constructor(cb: (e: unknown[]) => void) { fire = (w) => cb([{ contentRect: { width: w } }]); }
        observe() {} unobserve() {} disconnect() {}
      });
    });
    const hs = (c: HTMLElement) => (c.querySelector('[data-app-shell]') as HTMLElement).style.getPropertyValue('--ms-hs');

    it('幅 980 で 0.824 前後', () => {
      const { container } = renderIt();
      act(() => fire(980));
      expect(Number(hs(container))).toBeCloseTo(0.824, 2);
    });
    it('幅 1189 以上で 1', () => {
      const { container } = renderIt();
      act(() => fire(1465));
      expect(Number(hs(container))).toBe(1);
    });
  });

  it('rail ゾーンにサイドバー開閉の取っ手が入る', () => {
    const { container } = renderIt();
    expect(container.querySelector('[data-ms-zone="rail"] button[aria-expanded="true"]')).not.toBeNull();
  });
});
