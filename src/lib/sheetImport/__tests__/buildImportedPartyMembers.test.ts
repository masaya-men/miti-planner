import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildImportedPartyMembers } from '../buildImportedPartyMembers';

// getJobsFromStore を合成モックに差し替え
vi.mock('../../../hooks/useSkillsData', () => ({
  getJobsFromStore: () => [
    { id: 'pld', role: 'tank', name: { ja: 'pld', en: 'pld' }, icon: '' },
    { id: 'war', role: 'tank', name: { ja: 'war', en: 'war' }, icon: '' },
    { id: 'whm', role: 'healer', name: { ja: 'whm', en: 'whm' }, icon: '' },
    { id: 'mnk', role: 'dps',  name: { ja: 'mnk', en: 'mnk' }, icon: '' },
  ],
}));

// DEFAULT_TANK_STATS / DEFAULT_HEALER_STATS の store 依存を排除
vi.mock('../../../store/useMitigationStore', () => ({
  DEFAULT_TANK_STATS:   { hp: 1, mainStat: 1, det: 1, wd: 1, crt: 1, ten: 1, ss: 1 },
  DEFAULT_HEALER_STATS: { hp: 2, mainStat: 2, det: 2, wd: 2, crt: 2, ten: 2, ss: 2 },
}));

beforeEach(() => vi.clearAllMocks());

describe('buildImportedPartyMembers', () => {
  it('常に 8 枠を返す', () => {
    const result = buildImportedPartyMembers([]);
    expect(result).toHaveLength(8);
  });

  it('party の枠に jobId と role が入る', () => {
    const result = buildImportedPartyMembers([
      { slot: 'MT', jobId: 'pld' },
      { slot: 'H1', jobId: 'whm' },
    ]);
    const mt = result.find((m) => m.id === 'MT')!;
    expect(mt.jobId).toBe('pld');
    expect(mt.role).toBe('tank');

    const h1 = result.find((m) => m.id === 'H1')!;
    expect(h1.jobId).toBe('whm');
    expect(h1.role).toBe('healer');
  });

  it('party にない枠は jobId:null でデフォルト role', () => {
    const result = buildImportedPartyMembers([]);
    const st = result.find((m) => m.id === 'ST')!;
    expect(st.jobId).toBeNull();
    expect(st.role).toBe('tank');

    const d1 = result.find((m) => m.id === 'D1')!;
    expect(d1.jobId).toBeNull();
    expect(d1.role).toBe('dps');
  });
});
