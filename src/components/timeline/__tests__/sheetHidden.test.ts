import { describe, it, expect, beforeEach } from 'vitest';
import { MITIGATIONS } from '../../../data/mockData';
import type { Mitigation, PartyMember } from '../../../types';
import { buildSheetColumnMap, buildHiddenSheetColumnMap, buildSheetColumns } from '../sheet/sheetColumns';
import { useSheetHiddenSkillsStore } from '../../../store/useSheetHiddenSkillsStore';

const defs = MITIGATIONS as Mitigation[];
const members = [{ id: 'MT', jobId: 'pld', role: 'tank' }, { id: 'H1', jobId: 'whm', role: 'healer' }] as unknown as PartyMember[];

beforeEach(() => {
  useSheetHiddenSkillsStore.setState({ hiddenIds: [] });
});

describe('スプシの技の列を隠す(全体で 1 つ・技 ID)', () => {
  it('隠した技は列から外れ、隠した列の一覧(+ の小窓)に出る。隠してないメンバーは一覧に含まれない', () => {
    const all = buildSheetColumns('pld', defs, 100);
    const target = all[0].mitigationId;
    const hidden = new Set([target]);
    const map = buildSheetColumnMap(members, defs, 100, hidden);
    expect(map.get('MT')!.length).toBe(all.length - 1);
    expect(map.get('MT')!.some(c => c.mitigationId === target)).toBe(false);
    expect(map.get('H1')!.length).toBe(buildSheetColumns('whm', defs, 100).length);
    const hc = buildHiddenSheetColumnMap(members, defs, 100, hidden);
    expect(hc.get('MT')!.map(c => c.mitigationId)).toEqual([target]);
    expect(hc.has('H1')).toBe(false);
  });

  it('隠していなければ従来どおり(hidden 省略・空)', () => {
    const a = buildSheetColumnMap(members, defs, 100);
    const b = buildSheetColumnMap(members, defs, 100, new Set());
    expect(b.get('MT')!.length).toBe(a.get('MT')!.length);
    expect(buildHiddenSheetColumnMap(members, defs, 100, new Set()).size).toBe(0);
  });

  it('ストア: hide / show / showMany は技 ID 単位で、重複しない', () => {
    const s = useSheetHiddenSkillsStore.getState();
    s.hide('a'); s.hide('a'); s.hide('b'); s.hide('c');
    expect(useSheetHiddenSkillsStore.getState().hiddenIds).toEqual(['a', 'b', 'c']);
    useSheetHiddenSkillsStore.getState().show('b');
    expect(useSheetHiddenSkillsStore.getState().hiddenIds).toEqual(['a', 'c']);
    useSheetHiddenSkillsStore.getState().showMany(['a', 'c', 'zzz']);
    expect(useSheetHiddenSkillsStore.getState().hiddenIds).toEqual([]);
  });
});
