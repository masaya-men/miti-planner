import { describe, it, expect } from 'vitest';
import type { PlanData, PlanMemo } from '../index';
import { MEMO_LIMITS } from '../firebase';

describe('PlanMemo 後方互換', () => {
  it('memos === undefined の既存 PlanData をそのまま受け取れる', () => {
    const legacy: PlanData = {
      currentLevel: 100,
      timelineEvents: [],
      timelineMitigations: [],
      phases: [],
      partyMembers: [],
      aaSettings: { damage: 0, type: 'magical', target: 'MT' },
      schAetherflowPatterns: {},
    };
    expect(legacy.memos).toBeUndefined();
  });

  it('PlanMemo の必須フィールドが揃っている', () => {
    const memo: PlanMemo = {
      id: 'memo_1',
      text: 'テスト',
      timeSec: 12.5,
      xRatio: 0.4,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    };
    expect(memo.id).toBe('memo_1');
    expect(memo.text).toBe('テスト');
    expect(memo.timeSec).toBe(12.5);
    expect(memo.xRatio).toBe(0.4);
  });

  it('MEMO_LIMITS が公開されている', () => {
    expect(MEMO_LIMITS.MAX_MEMOS_PER_PLAN).toBe(100);
    expect(MEMO_LIMITS.MAX_TEXT_LENGTH).toBe(100);
  });
});
