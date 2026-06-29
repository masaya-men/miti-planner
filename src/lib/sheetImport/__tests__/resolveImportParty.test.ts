import { describe, it, expect } from 'vitest';
import { resolveImportParty } from '../resolveImportParty';
import type { Job } from '../../../types';

const J = (id: string, role: 'tank' | 'healer' | 'dps'): Job =>
  ({ id, name: { ja: id, en: id }, role, icon: '' } as Job);
const JOBS: Job[] = [
  J('pld', 'tank'), J('war', 'tank'), J('whm', 'healer'), J('sch', 'healer'),
  J('mnk', 'dps'), J('drg', 'dps'), J('brd', 'dps'), J('blm', 'dps'),
  J('nin', 'dps'), J('smn', 'dps'),
];

describe('resolveImportParty', () => {
  it('ロール別に枠を割り当てる', () => {
    const out = resolveImportParty(['pld', 'war', 'whm', 'sch', 'mnk', 'drg', 'brd', 'blm'], JOBS);
    expect(out).toEqual([
      { slot: 'MT', jobId: 'pld' }, { slot: 'ST', jobId: 'war' },
      { slot: 'H1', jobId: 'whm' }, { slot: 'H2', jobId: 'sch' },
      { slot: 'D1', jobId: 'mnk' }, { slot: 'D2', jobId: 'drg' },
      { slot: 'D3', jobId: 'brd' }, { slot: 'D4', jobId: 'blm' },
    ]);
  });
  it('検出順で枠に詰める（部分編成・タンク/ヒラは検出順のまま）', () => {
    const out = resolveImportParty(['whm', 'pld', 'mnk'], JOBS);
    expect(out).toEqual([
      { slot: 'H1', jobId: 'whm' }, { slot: 'MT', jobId: 'pld' }, { slot: 'D1', jobId: 'mnk' },
    ]);
  });
  it('DPS は近接→遠隔物理→キャスター順で D1〜D4 に割り当てる（検出順は無視）', () => {
    // 検出順 [blm(キャスター), mnk(近接), brd(遠隔物理), drg(近接)] →
    // D1=mnk, D2=drg（近接2人を検出順で）, D3=brd（遠隔物理）, D4=blm（キャスター）。
    // slot→jobId のマッピングを検証(配列順は検出順を保つため map で確認)。
    const out = resolveImportParty(['blm', 'mnk', 'brd', 'drg'], JOBS);
    const slotByJob = Object.fromEntries(out.map((p) => [p.jobId, p.slot]));
    expect(slotByJob).toEqual({ mnk: 'D1', drg: 'D2', brd: 'D3', blm: 'D4' });
  });
  it('タンクは canonical 順で MT/ST を決める（検出順は無視）', () => {
    // 検出順 war→pld でも canonical(pld<war) で MT=pld, ST=war。
    const out = resolveImportParty(['war', 'smn', 'pld', 'nin'], JOBS);
    const slotByJob = Object.fromEntries(out.map((p) => [p.jobId, p.slot]));
    expect(slotByJob).toEqual({ pld: 'MT', war: 'ST', nin: 'D1', smn: 'D2' });
  });
  it('ヒラは PH(白/占)→H1・BH(学/賢)→H2 で割り当てる（検出順は無視）', () => {
    // 検出順 sch(BH)→ast(PH) でも PH 優先で H1=ast, H2=sch。
    const out = resolveImportParty(['sch', 'ast'], [...JOBS, J('ast', 'healer')]);
    const slotByJob = Object.fromEntries(out.map((p) => [p.jobId, p.slot]));
    expect(slotByJob).toEqual({ ast: 'H1', sch: 'H2' });
  });
  it('未知 jobId は無視', () => {
    expect(resolveImportParty(['xyz', 'pld'], JOBS)).toEqual([{ slot: 'MT', jobId: 'pld' }]);
  });
  it('ロール枠超過分は捨てる（タンク3人目以降）', () => {
    const out = resolveImportParty(['pld', 'war', 'drk'], [...JOBS, J('drk', 'tank')]);
    expect(out).toEqual([{ slot: 'MT', jobId: 'pld' }, { slot: 'ST', jobId: 'war' }]);
  });
});
