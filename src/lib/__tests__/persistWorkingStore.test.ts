import { describe, it, expect } from 'vitest';
import { persistWorkingStore } from '../persistWorkingStore';
import type { PlanData } from '../../types';

/**
 * 根治テスト: 作業ストアの保存先は「データの持ち主(loadedPlanId)」であり、
 * 「今 UI が見ている表(currentPlanId)」ではない。
 *
 * これにより、表を素早く切り替えた一瞬に UI 選択とデータがズレても、
 * データは自分の表以外には絶対に書き込まれない(=他表の軽減を空で潰さない)。
 */
function partialEmpty(): PlanData {
  // 「同コンテンツの空表」= イベントはあるが軽減ゼロ(=丸ごと空ガードをすり抜ける形)
  return {
    currentLevel: 100,
    timelineEvents: [{ id: 'e1' } as any],
    timelineMitigations: [],
    phases: [],
    partyMembers: [],
    aaSettings: { damage: 0, type: 'physical', target: 'MT' },
    schAetherflowPatterns: {},
  } as PlanData;
}

describe('persistWorkingStore: 保存先は loadedPlanId(データの持ち主)', () => {
  it('UI選択(currentPlanId=A)と違っても、持ち主(loadedPlanId=B)に保存する', () => {
    const updates: Array<{ id: string; data: PlanData }> = [];
    persistWorkingStore({
      loadedPlanId: 'B',                 // 手元データの持ち主は B
      getSnapshot: () => partialEmpty(),
      updatePlan: (id, patch) => updates.push({ id, data: patch.data }),
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('B');     // ← 切替先 A ではなく B に書く = A を汚さない
  });

  it('loadedPlanId が null のときは何も保存しない(切替の谷間で誤保存しない)', () => {
    const updates: Array<{ id: string }> = [];
    persistWorkingStore({
      loadedPlanId: null,
      getSnapshot: () => partialEmpty(),
      updatePlan: (id) => updates.push({ id }),
    });
    expect(updates).toHaveLength(0);
  });
});
