export interface SnakeCell {
  id: string;
  row: number;
  col: number;
}

/**
 * ツアー計画画面の蛇行グリッド(PC)の位置計算。
 * 列を上から下まで埋めたら、隣の列は下から上へ、その隣はまた上から下へ…と
 * ジャンプせず連続してつながる形(ボウストロフェドン/畑を耕す牛の折返し)で配置する。
 * この順序どおりに接続線を引けば、途切れず蛇行する一本道になる。
 */
export function computeSnakeGridPositions(ids: string[], rowsPerColumn: number): SnakeCell[] {
  const safeRows = Math.max(1, Math.floor(rowsPerColumn) || 1);
  return ids.map((id, i) => {
    const col = Math.floor(i / safeRows);
    const posInCol = i % safeRows;
    const goingDown = col % 2 === 0;
    const row = goingDown ? posInCol : safeRows - 1 - posInCol;
    return { id, row, col };
  });
}

/** セル中心を順につないだ SVG <path> の d 属性文字列を組み立てる。 */
export function buildSnakePathD(cells: SnakeCell[], colWidth: number, rowHeight: number): string {
  if (cells.length === 0) return '';
  return cells
    .map((c, i) => {
      const x = c.col * colWidth + colWidth / 2;
      const y = c.row * rowHeight + rowHeight / 2;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}
