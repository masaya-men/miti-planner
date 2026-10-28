// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  setColumnValues,
  sortResultPartyBySlots,
} from '../gridImport/gridImportModel';
import type { GridTable } from '../../lib/sheetImport/gridTypes';
import type { SheetImportResult } from '../../lib/sheetImport/buildPlanFromSheets';

// ---- sortResultPartyBySlots 純粋関数のユニットテスト ----
describe('sortResultPartyBySlots', () => {
  it('party を MT,ST,H1,H2,D1..D4 順に整列する(検出順をならべ替え)', () => {
    const result = {
      timelineEvents: [], timelineMitigations: [], phases: [], labels: [], skipped: [],
      party: [
        { slot: 'D1', jobId: 'nin' },
        { slot: 'H1', jobId: 'whm' },
        { slot: 'MT', jobId: 'pld' },
      ],
    } as unknown as SheetImportResult;
    const sorted = sortResultPartyBySlots(result);
    expect(sorted.party.map((p) => p.slot)).toEqual(['MT', 'H1', 'D1']);
  });

  it('元の result は変更しない(party 配列は新規)', () => {
    const result = {
      timelineEvents: [], timelineMitigations: [], phases: [], labels: [], skipped: [],
      party: [{ slot: 'D1', jobId: 'nin' }, { slot: 'MT', jobId: 'pld' }],
    } as unknown as SheetImportResult;
    const sorted = sortResultPartyBySlots(result);
    expect(result.party[0].slot).toBe('D1'); // 元は不変
    expect(sorted.party).not.toBe(result.party);
  });
});

// ---- setColumnValues 純粋関数のユニットテスト ----
describe('setColumnValues', () => {
  it('指定列に値が書き込まれ、他列は保持される', () => {
    const table: GridTable = {
      columns: [
        { field: 'phase', header: 'フェーズ' },
        { field: 'time', header: '時間' },
        { field: 'action', header: '敵の攻撃' },
      ],
      rows: [
        ['P1', '0:10', 'Attack1'],
        ['P2', '0:20', 'Attack2'],
      ],
    };
    const result = setColumnValues(table, 1, ['1:00', '2:00']);
    expect(result.rows[0][1]).toBe('1:00');
    expect(result.rows[1][1]).toBe('2:00');
    expect(result.rows[0][0]).toBe('P1');
    expect(result.rows[0][2]).toBe('Attack1');
    expect(result.rows[1][0]).toBe('P2');
    expect(result.rows[1][2]).toBe('Attack2');
  });

  it('values が既存行より多い場合、行が追加され他列は空文字で埋まる', () => {
    const table: GridTable = {
      columns: [
        { field: 'phase', header: 'フェーズ' },
        { field: 'time', header: '時間' },
      ],
      rows: [['P1', '0:10']],
    };
    const result = setColumnValues(table, 0, ['P1', 'P2', 'P3']);
    expect(result.rows.length).toBe(3);
    expect(result.rows[0][0]).toBe('P1');
    expect(result.rows[1][0]).toBe('P2');
    expect(result.rows[2][0]).toBe('P3');
    expect(result.rows[0][1]).toBe('0:10');
    expect(result.rows[1][1]).toBe('');
    expect(result.rows[2][1]).toBe('');
  });

  it('values が既存行より少ない場合、不足分は空文字になる', () => {
    const table: GridTable = {
      columns: [{ field: 'phase', header: 'フェーズ' }],
      rows: [['P1'], ['P2'], ['P3']],
    };
    const result = setColumnValues(table, 0, ['X']);
    expect(result.rows.length).toBe(3);
    expect(result.rows[0][0]).toBe('X');
    expect(result.rows[1][0]).toBe('');
    expect(result.rows[2][0]).toBe('');
  });

  it('元の table は変更されない(pure function)', () => {
    const table: GridTable = {
      columns: [{ field: 'phase', header: 'フェーズ' }],
      rows: [['P1']],
    };
    const result = setColumnValues(table, 0, ['NEW']);
    expect(table.rows[0][0]).toBe('P1');
    expect(result.rows[0][0]).toBe('NEW');
  });
});
