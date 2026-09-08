// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecSidebar } from '../MilspecSidebar';
import { usePlanStore } from '../../../store/usePlanStore';
import { useThemeStore } from '../../../store/useThemeStore';
import { useMitigationStore } from '../../../store/useMitigationStore';

beforeEach(() => {
  useThemeStore.setState({ themeStyle: 'military' });
  usePlanStore.setState({ plans: [
    { id: 'p1', title: 'A', contentId: null, data: {}, ownerId: 'local' },
    { id: 'p2', title: 'B', contentId: null, data: {}, ownerId: 'local' },
  ] as never, currentPlanId: 'p1' });
});
const props = { isSidebarOpen: true, onToggleSidebar: vi.fn(), onCloseSidebar: vi.fn() };
// MilspecSidebar は NEW ボタンで useNavigate() を使うため MemoryRouter が要る
// (MilspecHeader.test.tsx と同じ理由で追加。brief 記載のテストコードに対する必要な補正)。
const r = () => render(<MemoryRouter><MilspecSidebar {...props} /></MemoryRouter>);

describe('MilspecSidebar', () => {
  it('SCENARIO / PHASES / DOCK / DEPLOYMENT パネルを描画', () => {
    const { container } = r();
    expect(container.textContent).toMatch(/シナリオ|Scenario/);
    expect(container.textContent).toMatch(/バックアップ|Backup/);
  });
  it('プラン行クリックで setCurrentPlanId', () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'setCurrentPlanId');
    const { getByText } = r();
    fireEvent.click(getByText('B'));
    expect(spy).toHaveBeenCalledWith('p2');
  });
  it('折りたたみハンドルで onToggleSidebar', () => {
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: /collapse|折りたた|‹/i }));
    expect(props.onToggleSidebar).toHaveBeenCalled();
  });
  it('プラン行の複製アイコンで duplicatePlan が呼ばれる', () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'duplicatePlan').mockResolvedValue(null);
    const { container } = r();
    // 先頭行 = p1(A・currentPlanId)。行内アクションは [rename, duplicate] の順。
    const firstRow = container.querySelector('.milspec-pi');
    const actionButtons = firstRow!.querySelectorAll('.ac button');
    expect(actionButtons.length).toBe(2);
    fireEvent.click(actionButtons[1]);
    expect(spy).toHaveBeenCalledWith('p1');
  });
  it('PHASES パネルは表示専用(useMitigationStore の phases を描画するだけ)', () => {
    useMitigationStore.setState({ phases: [
      { id: 'ph1', name: { ja: '第1フェーズ', en: 'Phase 1' }, startTime: 0, endTime: 100 },
    ] as never });
    const { container } = r();
    expect(container.querySelector('.milspec-phase')).not.toBeNull();
    expect(container.textContent).toMatch(/第1フェーズ|Phase 1/);
  });
});
