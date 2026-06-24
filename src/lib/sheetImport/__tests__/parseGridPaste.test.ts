import { describe, it, expect } from 'vitest';
import { parseGridPaste, isMatrixSheetFormat } from '../parseGridPaste';
import type { Job } from '../../../types';

const JOBS: Job[] = [
  { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' } as Job,
];

describe('isMatrixSheetFormat', () => {
  it('Skill 行があれば行列形式', () => {
    expect(isMatrixSheetFormat('a\tb\nSkill\tリプライザル\n')).toBe(true);
  });
  it('無ければ false', () => {
    expect(isMatrixSheetFormat('時間\t敵の攻撃\n0:16\tばりばりルインガ\n')).toBe(false);
  });
});

describe('parseGridPaste', () => {
  it('見出し行で field を判定し rows を分離(位置非依存)', () => {
    const tsv = '敵の攻撃\t時間\tナイト\t最大HP\n波動砲\t0:43\tセンチネル\t128000\n';
    const t = parseGridPaste(tsv, JOBS);
    expect(t.columns.map((c) => c.field)).toEqual(['action', 'time', 'member', 'unknown']);
    expect(t.columns[2].jobId).toBe('pld');
    expect(t.rows).toEqual([['波動砲', '0:43', 'センチネル', '128000']]);
  });
  it('空入力は空テーブル', () => {
    expect(parseGridPaste('', JOBS)).toEqual({ columns: [], rows: [] });
  });
});
