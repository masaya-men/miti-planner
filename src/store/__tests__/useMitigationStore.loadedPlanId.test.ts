import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import type { PlanData } from '../../types';

/**
 * 根治の土台: 作業ストアが「今どの表の内容を載せているか(_loadedPlanId)」を追跡する。
 * これがあれば、保存は UI の現在選択ではなく「データの持ち主」に対して行える。
 */
function snapshot(): PlanData {
  return {
    currentLevel: 100,
    timelineEvents: [],
    timelineMitigations: [],
    phases: [],
    labels: [],
    partyMembers: [],
    aaSettings: { damage: 0, type: 'physical', target: 'MT' },
    schAetherflowPatterns: {},
  } as PlanData;
}

describe('useMitigationStore._loadedPlanId (作業ストアの持ち主追跡)', () => {
  beforeEach(() => {
    useMitigationStore.setState({ _collabActive: false, _loadedPlanId: null });
  });

  it('loadSnapshot(data, planId) で _loadedPlanId が planId になる', () => {
    useMitigationStore.getState().loadSnapshot(snapshot(), 'plan-A');
    expect(useMitigationStore.getState()._loadedPlanId).toBe('plan-A');
  });

  it('共同編集中(_collabActive)は loadSnapshot が no-op なので _loadedPlanId も変えない', () => {
    useMitigationStore.setState({ _loadedPlanId: 'plan-A', _collabActive: true });
    useMitigationStore.getState().loadSnapshot(snapshot(), 'plan-B');
    expect(useMitigationStore.getState()._loadedPlanId).toBe('plan-A');
  });

  it('setLoadedPlanId で明示セットできる(新規作成 / collab 接続時用)', () => {
    useMitigationStore.getState().setLoadedPlanId('plan-C');
    expect(useMitigationStore.getState()._loadedPlanId).toBe('plan-C');
  });
});
