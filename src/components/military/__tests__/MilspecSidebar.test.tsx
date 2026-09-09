// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecSidebar } from '../MilspecSidebar';
import { usePlanStore } from '../../../store/usePlanStore';
import { useThemeStore } from '../../../store/useThemeStore';

const mkData = () => ({
  currentLevel: 100, timelineEvents: [], timelineMitigations: [], phases: [], labels: [],
  partyMembers: [], aaSettings: { damage: 0, type: 'physical', target: 'MT' }, schAetherflowPatterns: {},
});

beforeEach(() => {
  useThemeStore.setState({ themeStyle: 'military' });
  usePlanStore.setState({ plans: [
    { id: 'p1', title: 'A', contentId: 'dmu', data: mkData(), ownerId: 'local' },
  ] as never, currentPlanId: 'p1' });
});
afterEach(() => { vi.restoreAllMocks(); });

const props = { isSidebarOpen: true, onToggleSidebar: vi.fn(), onCloseSidebar: vi.fn() };
const r = () => render(<MemoryRouter><MilspecSidebar {...props} /></MemoryRouter>);

describe('MilspecSidebar', () => {
  it('CONTENT パネル(見出し+タブ) / コンテンツツリー / DOCK / DEPLOYMENT を描画', () => {
    const { container } = r();
    expect(container.textContent).toMatch(/コンテンツ|Content/);
    expect(container.textContent).toMatch(/バックアップ|Backup/);
    // タブ(零式/絶/その他/アーカイブ)は CONTENT パネル内
    const tabs = container.querySelectorAll('.milspec-scenario .milspec-tree-tab');
    expect(tabs.length).toBe(4);
    // フェーズ表示パネルは撤去済み
    expect(container.querySelector('.milspec-phase')).toBeNull();
  });

  it('折りたたみハンドルで onToggleSidebar', () => {
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: /collapse|折りたた|‹/i }));
    expect(props.onToggleSidebar).toHaveBeenCalled();
  });

  it('SCENARIO の NEW ボタンが milspec:new-plan を dispatch する', () => {
    const listener = vi.fn();
    window.addEventListener('milspec:new-plan', listener);
    const { getAllByText } = r();
    // en/jp 両方あるので最初の "New"/"新規作成" を押す
    fireEvent.click(getAllByText(/^New$|新規作成/)[0]);
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('milspec:new-plan', listener);
  });
});
