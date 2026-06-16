import { describe, it, expect, beforeEach } from 'vitest';
import { loadPlanDataIntoStore } from '../planLoad';
import { useMitigationStore } from '../../store/useMitigationStore';
import type { SavedPlan, PlanData } from '../../types';

/**
 * 根治の本丸: プラン切替(loadPlanDataIntoStore)は、読み込んだ表の ID を
 * 作業ストアの持ち主(_loadedPlanId)として記録しなければならない。
 * これにより以後の保存は「その表」へ向き、切替先の別表を汚さない。
 */
function planData(): PlanData {
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

describe('loadPlanDataIntoStore: 読み込んだ表を _loadedPlanId に記録', () => {
  beforeEach(() => {
    useMitigationStore.setState({ _collabActive: false, _loadedPlanId: null });
  });

  it('plan を読み込むと _loadedPlanId = plan.id になる', async () => {
    await loadPlanDataIntoStore({ id: 'P9', data: planData() } as SavedPlan);
    expect(useMitigationStore.getState()._loadedPlanId).toBe('P9');
  });
});
