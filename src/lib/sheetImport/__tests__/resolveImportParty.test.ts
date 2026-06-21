import { describe, it, expect } from 'vitest';
import { resolveImportParty } from '../resolveImportParty';
import type { Job } from '../../../types';

const J = (id: string, role: 'tank' | 'healer' | 'dps'): Job =>
  ({ id, name: { ja: id, en: id }, role, icon: '' } as Job);
const JOBS: Job[] = [
  J('pld', 'tank'), J('war', 'tank'), J('whm', 'healer'), J('sch', 'healer'),
  J('mnk', 'dps'), J('drg', 'dps'), J('brd', 'dps'), J('blm', 'dps'),
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
  it('検出順で枠に詰める（部分編成）', () => {
    const out = resolveImportParty(['whm', 'pld', 'mnk'], JOBS);
    expect(out).toEqual([
      { slot: 'H1', jobId: 'whm' }, { slot: 'MT', jobId: 'pld' }, { slot: 'D1', jobId: 'mnk' },
    ]);
  });
  it('未知 jobId は無視', () => {
    expect(resolveImportParty(['xyz', 'pld'], JOBS)).toEqual([{ slot: 'MT', jobId: 'pld' }]);
  });
  it('ロール枠超過分は捨てる（タンク3人目以降）', () => {
    const out = resolveImportParty(['pld', 'war', 'drk'], [...JOBS, J('drk', 'tank')]);
    expect(out).toEqual([{ slot: 'MT', jobId: 'pld' }, { slot: 'ST', jobId: 'war' }]);
  });
});
