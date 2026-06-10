import { describe, it, expect } from 'vitest';
import { decideCollabAction } from '../collabReconcile';

describe('decideCollabAction', () => {
  it('未接続 → 何もしない', () => {
    expect(decideCollabAction({ sessionActive: false, collabPlanId: null, newPlanId: 'B' }))
      .toEqual({ type: 'none' });
  });
  it('接続中で別プランへ移動 → 切断+再ロード', () => {
    expect(decideCollabAction({ sessionActive: true, collabPlanId: 'A', newPlanId: 'B' }))
      .toEqual({ type: 'disconnect-and-reload' });
  });
  it('接続中で同じプランのまま → 何もしない', () => {
    expect(decideCollabAction({ sessionActive: true, collabPlanId: 'A', newPlanId: 'A' }))
      .toEqual({ type: 'none' });
  });
  it('接続中でプラン未選択(null)へ → 切断+再ロード', () => {
    expect(decideCollabAction({ sessionActive: true, collabPlanId: 'A', newPlanId: null }))
      .toEqual({ type: 'disconnect-and-reload' });
  });
});
