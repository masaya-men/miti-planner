import { describe, it, expect } from 'vitest';
import { MITIGATIONS } from '../mockData';

// appliesAsDebuff が付いてよいのは、ボスデバフ系の4ファミリーのみ。
// 付け忘れ(新スキル追加時の漏れ)と、付けすぎ(バフに誤付与)の両方を防ぐ。
const DEBUFF_NAMES_EN = new Set(['Reprisal', 'Feint', 'Addle', 'Dismantle']);

describe('appliesAsDebuff フラグの整合性', () => {
  it('appliesAsDebuff=true のスキルは全てデバフ4系のいずれかである', () => {
    const flagged = MITIGATIONS.filter(m => m.appliesAsDebuff);
    expect(flagged.length).toBeGreaterThan(0);
    for (const m of flagged) {
      expect(DEBUFF_NAMES_EN.has(m.name.en as string)).toBe(true);
    }
  });

  it('デバフ4系のスキルは全て appliesAsDebuff=true を持つ', () => {
    const debuffs = MITIGATIONS.filter(m => DEBUFF_NAMES_EN.has(m.name.en as string));
    expect(debuffs.length).toBeGreaterThan(0);
    for (const m of debuffs) {
      expect(m.appliesAsDebuff).toBe(true);
    }
  });
});
