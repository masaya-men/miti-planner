import { describe, it, expect } from 'vitest';
import { fieldsNeedingReseed, RESEED_FIELDS, type FieldCounts } from '../collabReseed';

const counts = (over: Partial<FieldCounts> = {}): FieldCounts => ({
  timelineMitigations: 0, timelineEvents: 0, phases: 0, partyMembers: 0, ...over,
});

describe('fieldsNeedingReseed (client 側 空上書き防御)', () => {
  it('doc 空 & 手元 非空 → そのフィールドを再シード対象に', () => {
    const need = fieldsNeedingReseed(
      counts({ timelineMitigations: 0, timelineEvents: 504 }),
      counts({ timelineMitigations: 199, timelineEvents: 504 }),
    );
    expect(need.has('timelineMitigations')).toBe(true); // 軽減だけ空=今回の真因パターン
    expect(need.has('timelineEvents')).toBe(false);     // doc にイベントは在る→対象外
  });

  it('doc 非空 → 再シードしない(正常な部屋の状態を尊重)', () => {
    const need = fieldsNeedingReseed(
      counts({ timelineMitigations: 50 }),
      counts({ timelineMitigations: 199 }),
    );
    expect(need.has('timelineMitigations')).toBe(false);
  });

  it('手元も空 → 再シード不要(復元元が無い)', () => {
    const need = fieldsNeedingReseed(counts(), counts());
    expect(need.size).toBe(0);
  });

  it('全構造フィールドが空(seed 完全失敗) → 全て対象', () => {
    const need = fieldsNeedingReseed(
      counts(),
      counts({ timelineMitigations: 10, timelineEvents: 20, phases: 3, partyMembers: 8 }),
    );
    expect(need.size).toBe(RESEED_FIELDS.length);
  });

  it('labels/memos は対象外(RESEED_FIELDS に含めない)', () => {
    expect([...RESEED_FIELDS]).toEqual(['timelineMitigations', 'timelineEvents', 'phases', 'partyMembers']);
  });
});
