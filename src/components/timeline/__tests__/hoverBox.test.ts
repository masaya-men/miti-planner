import { describe, it, expect } from 'vitest';
import { computeRowLayout, ROW_UNIT_PX } from '../rowLayout';
import { hoverBox } from '../sheet/hoverBox';
import type { SheetColumn } from '../sheet/sheetColumns';

const layout = computeRowLayout({
  times: Array.from({ length: 11 }, (_, i) => i), eventCountAt: () => 0, hasMitigationStartAt: () => false,
  hideEmptyRows: false, maxPopulatedTime: 100, unitPx: ROW_UNIT_PX.pc,
});
const bands = [{ id: 'MT', left: 100, width: 70 }, { id: 'H1', left: 170, width: 28 }];
const cols = new Map<string, SheetColumn[]>([['MT', [{} as SheetColumn, {} as SheetColumn]], ['H1', [{} as SheetColumn]]]);

describe('hoverBox', () => {
  it('レーン表示: カーソルのあるジョブの列全体(縦の帯)', () => {
    expect(hoverBox('lanes', 120, 60, bands, null, layout)).toEqual({ left: 100, top: 0, width: 70, height: layout.totalHeight });
    expect(hoverBox('lanes', 175, 60, bands, null, layout)?.left).toBe(170);
  });
  it('スプシ表示: 行 × 技の列のセル 1 つ', () => {
    const b = hoverBox('sheet', 130, 60, bands, cols, layout)!;
    expect(b).toEqual({ left: 128, top: layout.topOf(2), width: 28, height: ROW_UNIT_PX.pc });
  });
  it('帯の外・列の外・表の下は null', () => {
    expect(hoverBox('lanes', 50, 60, bands, null, layout)).toBeNull();
    expect(hoverBox('sheet', 165, 60, bands, cols, layout)).toBeNull(); // MT は 2 列(56px)だけ・右の余白
    expect(hoverBox('sheet', 130, layout.totalHeight + 5, bands, cols, layout)).toBeNull();
  });
});
