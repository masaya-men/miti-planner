// @vitest-environment happy-dom
// 標準の攻略の軌跡(ProgressTrackingHUD)の DOM 不変ガード。
// useProgressJourney への切り出し前に採ったスナップショットと、切り出し後の出力が一致することを保証する。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../../../hooks/useSkillsData', async (orig) => ({ ...(await orig<object>()), useMitigations: () => [] }));
vi.mock('../ProgressRecordPanel', () => ({ ProgressRecordPanel: () => <i data-testid="panel" /> }));
vi.mock('../ProgressRecordToast', () => ({ ProgressRecordToast: () => <i data-testid="toast" /> }));
vi.mock('../ProgressCelebration', () => ({ ProgressCelebration: () => <i data-testid="celebration" /> }));

import { ProgressTrackingHUD } from '../ProgressTrackingHUD';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { usePlanStore } from '../../../store/usePlanStore';
import { useProgressRecording } from '../useProgressRecording';

const ev = (time: number) => ({ id: `e${time}`, time, name: '', damage: 0, type: 'physical', target: 'MT' } as any);
const pt = (reachedPos: number) => ({ id: `p${reachedPos}`, reachedPos, ts: 0 } as any);

describe('ProgressTrackingHUD DOM 不変', () => {
  beforeEach(() => {
    usePlanStore.setState({ currentPlanId: 'plan-hud-test' } as any);
    useProgressRecording.setState({ panelOpen: false } as any);
    useMitigationStore.setState({ timelineEvents: [ev(200)], partyMembers: [] } as any);
  });

  it('空状態', () => {
    useMitigationStore.setState({ progress: { points: [], cleared: false } } as any);
    expect(render(<ProgressTrackingHUD />).container.innerHTML).toMatchSnapshot();
  });
  it('軌跡あり + 活動日数・時間', () => {
    useMitigationStore.setState({ progress: { points: [pt(50), pt(150)], cleared: false, activeDays: 5, activeHours: 12 } } as any);
    expect(render(<ProgressTrackingHUD />).container.innerHTML).toMatchSnapshot();
  });
  it('軌跡あり・活動日数なし', () => {
    useMitigationStore.setState({ progress: { points: [pt(100)], cleared: false } } as any);
    expect(render(<ProgressTrackingHUD />).container.innerHTML).toMatchSnapshot();
  });
  it('クリア済み', () => {
    useMitigationStore.setState({ progress: { points: [pt(100)], cleared: true, activeDays: 1 } } as any);
    expect(render(<ProgressTrackingHUD />).container.innerHTML).toMatchSnapshot();
  });
  it('クリックで記録パネルを開く', () => {
    useMitigationStore.setState({ progress: { points: [], cleared: false } } as any);
    const { container } = render(<ProgressTrackingHUD />);
    fireEvent.click(container.querySelector('[data-progress-hud-band]')!);
    expect(useProgressRecording.getState().panelOpen).toBe(true);
  });
});
