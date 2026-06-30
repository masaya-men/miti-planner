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

// getDefaultTankStats / getDefaultHealerStats の store 依存を排除。
// level がそのまま hp に出る合成値にして「レベルが stats に反映されるか」を検証可能にする。
vi.mock('../../../store/useMitigationStore', () => ({
  getDefaultTankStats:   (level: number) => ({ hp: level, mainStat: 1, det: 1, wd: 1, crt: 1, ten: 1, ss: 1 }),
  getDefaultHealerStats: (level: number) => ({ hp: level + 1000, mainStat: 2, det: 2, wd: 2, crt: 2, ten: 2, ss: 2 }),
}));

// DEFAULT_NEW_MODE の mitigationResolver 依存を排除
vi.mock('../../../utils/mitigationResolver', () => ({
  DEFAULT_NEW_MODE: 'reborn',
}));

beforeEach(() => vi.clearAllMocks());

describe('buildImportedPartyMembers', () => {
  it('常に 8 枠を返す', () => {
    const result = buildImportedPartyMembers([], 100);
    expect(result).toHaveLength(8);
  });

  it('party の枠に jobId と role が入る', () => {
    const result = buildImportedPartyMembers([
      { slot: 'MT', jobId: 'pld' },
      { slot: 'H1', jobId: 'whm' },
    ], 100);
    const mt = result.find((m) => m.id === 'MT')!;
    expect(mt.jobId).toBe('pld');
    expect(mt.role).toBe('tank');

    const h1 = result.find((m) => m.id === 'H1')!;
    expect(h1.jobId).toBe('whm');
    expect(h1.role).toBe('healer');
  });

  it('party にない枠は jobId:null でデフォルト role', () => {
    const result = buildImportedPartyMembers([], 100);
    const st = result.find((m) => m.id === 'ST')!;
    expect(st.jobId).toBeNull();
    expect(st.role).toBe('tank');

    const d1 = result.find((m) => m.id === 'D1')!;
    expect(d1.jobId).toBeNull();
    expect(d1.role).toBe('dps');
  });

  it('全枠に mode: DEFAULT_NEW_MODE が設定される', () => {
    const result = buildImportedPartyMembers([
      { slot: 'MT', jobId: 'pld' },
    ], 100);
    for (const member of result) {
      expect(member.mode).toBe('reborn');
    }
  });

  // ユーザー報告(2026-06-30): 絶アレキ(Lv80)取込でステータスが Lv100 のままだった。
  // level を必須引数にし、tank=getDefaultTankStats(level) / それ以外=getDefaultHealerStats(level) を通す。
  it('★level に応じた既定ステータスが入る (tank/healer/dps)', () => {
    const r80 = buildImportedPartyMembers([{ slot: 'MT', jobId: 'pld' }], 80);
    expect(r80.find((m) => m.id === 'MT')!.stats.hp).toBe(80);     // tank → getDefaultTankStats(80)
    expect(r80.find((m) => m.id === 'H1')!.stats.hp).toBe(1080);   // healer → getDefaultHealerStats(80)
    expect(r80.find((m) => m.id === 'D1')!.stats.hp).toBe(1080);   // dps も healer 既定値

    const r100 = buildImportedPartyMembers([], 100);
    expect(r100.find((m) => m.id === 'MT')!.stats.hp).toBe(100);
  });
});
