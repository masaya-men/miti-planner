import { describe, it, expect } from 'vitest';
import { MITIGATIONS } from '../../../data/mockData';
import type { Mitigation } from '../../../types';
import { buildSheetColumns, sheetColumnFromX, SHEET_COL_W } from '../sheet/sheetColumns';

const defs = MITIGATIONS as Mitigation[];
const pld = buildSheetColumns('pld', defs, 100);
const whm = buildSheetColumns('whm', defs, 100);
const map = new Map([['MT', pld], ['H1', whm]]);
// 容器の左端が画面の 300px。MT の列帯は容器内 100px から、H1 はその右隣
const bands = [
  { id: 'MT', left: 100, width: pld.length * SHEET_COL_W },
  { id: 'H1', left: 100 + pld.length * SHEET_COL_W, width: whm.length * SHEET_COL_W },
];

describe('sheetColumnFromX(本体のマウス → 列の技。クリック判定と同じ sheetColumnAt を使う)', () => {
  it('メンバーの帯の中は、その列の技を返す', () => {
    const hit = sheetColumnFromX(300 + 100 + SHEET_COL_W * 2 + 3, 300, bands, map)!;
    expect(hit.memberId).toBe('MT');
    expect(hit.colIndex).toBe(2);
    expect(hit.column.mitigationId).toBe(pld[2].mitigationId);
  });
  it('列の境目: 左端ちょうどは次の列、右端の 1px 手前は前の列', () => {
    expect(sheetColumnFromX(300 + 100 + SHEET_COL_W, 300, bands, map)!.colIndex).toBe(1);
    expect(sheetColumnFromX(300 + 100 + SHEET_COL_W - 1, 300, bands, map)!.colIndex).toBe(0);
  });
  it('次のメンバーの帯に入ると、そのメンバーの 0 列目', () => {
    const hit = sheetColumnFromX(300 + bands[1].left + 1, 300, bands, map)!;
    expect(hit.memberId).toBe('H1');
    expect(hit.colIndex).toBe(0);
    expect(hit.column.mitigationId).toBe(whm[0].mitigationId);
  });
  it('帯の外(左の情報列・最後の列より右)は null', () => {
    expect(sheetColumnFromX(300 + 50, 300, bands, map)).toBeNull();
    expect(sheetColumnFromX(300 + bands[1].left + bands[1].width + 5, 300, bands, map)).toBeNull();
  });
});
