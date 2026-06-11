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

  // Task 6: collab-ON プランを開いたらオーナーは自動接続
  it('未接続で collab-ON のプランを開いた(オーナー) → connect', () => {
    expect(decideCollabAction({ sessionActive: false, collabPlanId: null, newPlanId: 'B', newPlanRoomToken: 'tok', isOwner: true }))
      .toEqual({ type: 'connect', roomToken: 'tok', planId: 'B' });
  });
  it('collab-ON でもオーナーでなければ自動接続しない', () => {
    expect(decideCollabAction({ sessionActive: false, collabPlanId: null, newPlanId: 'B', newPlanRoomToken: 'tok', isOwner: false }))
      .toEqual({ type: 'none' });
  });
  it('未接続でも collab-OFF(token なし)なら自動接続しない', () => {
    expect(decideCollabAction({ sessionActive: false, collabPlanId: null, newPlanId: 'B', isOwner: true }))
      .toEqual({ type: 'none' });
  });
  it('接続中に別の collab-ON プランへ移動 → 一旦切断 (次サイクルで connect)', () => {
    expect(decideCollabAction({ sessionActive: true, collabPlanId: 'A', newPlanId: 'B', newPlanRoomToken: 'tok2', isOwner: true }))
      .toEqual({ type: 'disconnect-and-reload' });
  });
});
