import type { RowLayout } from '../rowLayout';
import { SHEET_COL_W, sheetColumnAt, type SheetColumn } from './sheetColumns';

/** ホバーの強調 1 個の箱(表の容器の左上基準 px) */
export interface HoverBox { left: number; top: number; width: number; height: number }

interface Band { id: string; left: number; width: number }

/**
 * カーソルの位置から、強調する箱を 1 つ決める(純粋関数)。
 * - レーン表示('lanes'): カーソルがあるジョブの列全体(縦の帯・表の高さいっぱい)
 * - スプシ表示('sheet'): カーソルがある行 × 技の列のセル 1 つ(罫線の有無に関係なく)
 * x / y は表の容器の左上基準。行の外・列の外は null。
 */
export function hoverBox(
    mode: 'lanes' | 'sheet',
    x: number,
    y: number,
    bands: readonly Band[],
    columnMap: ReadonlyMap<string, SheetColumn[]> | null,
    layout: RowLayout,
): HoverBox | null {
    if (y < 0 || y >= layout.totalHeight) return null;
    const band = bands.find(b => x >= b.left && x < b.left + b.width);
    if (!band) return null;
    if (mode === 'lanes') return { left: band.left, top: 0, width: band.width, height: layout.totalHeight };

    const cols = columnMap?.get(band.id);
    if (!cols) return null;
    const colIndex = sheetColumnAt(x, band.left);
    if (colIndex < 0 || colIndex >= cols.length) return null;
    const time = layout.timeAtY(y);
    const top = layout.topOf(time);
    const height = layout.bottomOf(time) - top;
    if (height <= 0) return null;
    return { left: band.left + colIndex * SHEET_COL_W, top, width: SHEET_COL_W, height };
}
