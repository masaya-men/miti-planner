import { describe, it, expect } from 'vitest';
import { validateGridColumn } from '../validateGridColumn';
import type { Job, Mitigation } from '../../../types';
import type { GridColumn } from '../gridTypes';

const JOBS: Job[] = [{ id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' } as Job];
const MITS: Mitigation[] = [{ id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart' }, recast: 0, duration: 0, type: 'all', value: 0 } as Mitigation];
const deps = { mitigations: MITS, jobs: JOBS };

describe('validateGridColumn', () => {
  it('time: 全て M:SS なら ok・一部不正で partial・空で empty', () => {
    expect(validateGridColumn({ field: 'time', header: '時間' }, ['0:10', '0:20'], deps)).toBe('ok');
    expect(validateGridColumn({ field: 'time', header: '時間' }, ['0:10', 'あ'], deps)).toBe('partial');
    expect(validateGridColumn({ field: 'time', header: '時間' }, ['', ''], deps)).toBe('empty');
  });
  it('phase/label/action/damage: 任意。空=empty・値あり=ok', () => {
    expect(validateGridColumn({ field: 'phase', header: 'フェーズ' }, ['', ''], deps)).toBe('empty');
    expect(validateGridColumn({ field: 'phase', header: 'フェーズ' }, ['P1', ''], deps)).toBe('ok');
  });
  it('member: 解決可=ok・一部未解決=partial・空=empty', () => {
    const col: GridColumn = { field: 'member', header: 'ナイト', jobId: 'pld', slot: 'MT' };
    expect(validateGridColumn(col, ['ランパート', ''], deps)).toBe('ok');
    expect(validateGridColumn(col, ['ランパート', '無い技'], deps)).toBe('partial');
    expect(validateGridColumn(col, ['', ''], deps)).toBe('empty');
  });
  it('unknown/ignore は empty 扱い(チップは別表示)', () => {
    expect(validateGridColumn({ field: 'unknown', header: '最大HP' }, ['1'], deps)).toBe('empty');
  });
});
