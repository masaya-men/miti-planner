import { describe, it, expect } from 'vitest';
import { MITIGATIONS, getMitigationPriority } from '../../../data/mockData';
import type { PartyMember } from '../../../types';
import { buildSheetColumns, sheetColumnIndex, sheetColumnAt, buildSheetColumnMap } from '../sheet/sheetColumns';

describe('sheetColumns', () => {
  it('pld Lv100: hidden を除き、表示順は getMitigationPriority 昇順', () => {
    const cols = buildSheetColumns('pld', MITIGATIONS, 100);
    expect(cols.length).toBeGreaterThanOrEqual(9);
    expect(cols.every(c => !c.def.hidden)).toBe(true);
    const pri = cols.map(c => getMitigationPriority(c.mitigationId));
    expect(pri).toEqual([...pri].sort((a, b) => a - b));
    // ランパートは版違いが 2 本並ばない(Lv100 では rampart_v2_pld だけ)
    expect(cols.filter(c => c.def.icon === '/icons/Rampart.png')).toHaveLength(1);
  });
  it('sch Lv100: requires 技の列はあるが hidden(manifestation/accession)の列は無い', () => {
    const ids = buildSheetColumns('sch', MITIGATIONS, 100).map(c => c.mitigationId);
    expect(ids).not.toContain('manifestation');
    expect(ids).toContain('adloquium');
  });
  it('jobId が null なら []', () => {
    expect(buildSheetColumns(null, MITIGATIONS, 100)).toEqual([]);
  });
  it('sheetColumnIndex: 直接一致 / セラフィズム差し替え / 版違い / 無ければ -1', () => {
    const sch = buildSheetColumns('sch', MITIGATIONS, 100);
    expect(sheetColumnIndex(sch, 'adloquium', MITIGATIONS)).toBe(sch.findIndex(c => c.mitigationId === 'adloquium'));
    expect(sheetColumnIndex(sch, 'manifestation', MITIGATIONS)).toBe(sch.findIndex(c => c.mitigationId === 'adloquium'));
    expect(sheetColumnIndex(sch, 'accession', MITIGATIONS)).toBe(sch.findIndex(c => c.mitigationId === 'concitation'));
    const pld90 = buildSheetColumns('pld', MITIGATIONS, 90);
    const v2 = MITIGATIONS.find(m => m.id === 'rampart_v2_pld')!;
    const idx = sheetColumnIndex(pld90, v2.id, MITIGATIONS);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBe(pld90.findIndex(c => c.def.icon === v2.icon));
    expect(sheetColumnIndex(pld90, 'no_such_skill', MITIGATIONS)).toBe(-1);
  });
  it('sheetColumnAt: 28px 刻み', () => {
    expect(sheetColumnAt(100 + 57, 100)).toBe(2);
    expect(sheetColumnAt(100, 100)).toBe(0);
  });
  it('buildSheetColumnMap: jobId 無しは []', () => {
    expect(buildSheetColumnMap([{ id: 'D1', role: 'melee', jobId: null } as unknown as PartyMember], MITIGATIONS, 100).get('D1')).toEqual([]);
  });
});
