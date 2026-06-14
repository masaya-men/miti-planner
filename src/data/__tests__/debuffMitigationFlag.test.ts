import { describe, it, expect } from 'vitest';
import { MITIGATIONS } from '../mockData';

// appliesAsDebuff が付いてよいのは、ボスデバフ系の4スキルのみ。
// 付け忘れ(新スキル追加時の漏れ)と、付けすぎ(バフに誤付与)の両方を防ぐ。
// 識別はゲーム公式英語名でなく id ベース(rename に強い・mockData の一次キー)。
const DEBUFF_BASE_IDS = ['reprisal', 'feint', 'addle', 'dismantle'];
const isDebuffSkill = (id: string) => DEBUFF_BASE_IDS.some(b => id === b || id.startsWith(b + '_'));

describe('appliesAsDebuff フラグの整合性', () => {
  it('appliesAsDebuff=true のスキルは全てデバフ4系のいずれかである', () => {
    const flagged = MITIGATIONS.filter(m => m.appliesAsDebuff);
    expect(flagged.length).toBeGreaterThan(0);
    for (const m of flagged) {
      expect(isDebuffSkill(m.id)).toBe(true);
    }
  });

  it('デバフ4系のスキルは全て appliesAsDebuff=true を持つ', () => {
    const debuffs = MITIGATIONS.filter(m => isDebuffSkill(m.id));
    expect(debuffs.length).toBeGreaterThan(0);
    for (const m of debuffs) {
      expect(m.appliesAsDebuff).toBe(true);
    }
  });
});
