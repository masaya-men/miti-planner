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

/**
 * セル中心を順につないだ SVG <path> の d 属性文字列を組み立てる。
 * 2026-08-11 実機指摘(4回目): 列ごとに弧を描く前回案は「最悪」と却下。人が手描きで単純に
 * 点をつないだような、シンプルな見た目にしてほしいとの要望を反映し、方式を全面的にやり直した。
 *
 * 採用方式:「角を丸めた折れ線」。直線で点をつなぎ、曲がる箇所(列をまたぐ折返し)だけ手前で
 * 折れ線から離れて二次ベジェで丸く回り込む、という単純な手法(角丸ポリライン)。
 * 同じ列内の3点は数学的に一直線上にあるため、この丸め処理をかけても結果はまっすぐな直線のまま
 * になる (丸めの効果は実際に方向が変わる箇所にしか出ない)。ジグザグやうねりなどの装飾は加えない。
 */
export function buildSnakePathD(cells: SnakeCell[], colWidth: number, rowHeight: number): string {
  if (cells.length === 0) return '';
  const pts = cells.map((c) => ({
    x: c.col * colWidth + colWidth / 2,
    y: c.row * rowHeight + rowHeight / 2,
  }));
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

  const radius = Math.min(rowHeight, colWidth) * 0.35; // 曲がり角を丸める半径 (控えめ・素朴な丸み)
  const pullBack = (from: { x: number; y: number }, to: { x: number; y: number }, dist: number) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const d = Math.min(dist, len / 2);
    return { x: from.x + (dx / len) * d, y: from.y + (dy / len) * d };
  };

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];
    const a = pullBack(curr, prev, radius);
    const b = pullBack(curr, next, radius);
    d += ` L ${a.x} ${a.y} Q ${curr.x} ${curr.y}, ${b.x} ${b.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
