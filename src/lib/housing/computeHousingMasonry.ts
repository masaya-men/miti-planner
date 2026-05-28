/** masonry レイアウトのカード定義 */
export interface MasonryCard {
  readonly id: string;
  /** カバーの縦横比 (w/h)。resolveCoverAspectRatio で必ず正の数になっている前提。 */
  readonly aspectRatio: number;
}

/** `computeHousingMasonry` への入力 */
export interface MasonryInput {
  readonly cards: ReadonlyArray<MasonryCard>;
  /** コンテナの CSS 幅 (px) */
  readonly containerWidth: number;
  /** カード間のギャップ (px) */
  readonly gap: number;
  /** 1 列の目安幅 (px)。列数算出の基準値 */
  readonly targetColumnUnit: number;
  /** 列数の上限。指定時、コンテナ幅から算出した列数をこの値で頭打ちにする (旧仕様の最大4列を踏襲)。 */
  readonly maxColumnCount?: number;
}

/** 各カードの絶対座標と寸法 */
export interface MasonryPosition {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** `computeHousingMasonry` の戻り値 */
export interface MasonryResult {
  readonly positions: Readonly<Record<string, MasonryPosition>>;
  readonly totalHeight: number;
  readonly columnCount: number;
  readonly columnWidth: number;
}

/**
 * カード配列を「最短列に置く」 masonry で配置し、各カードの絶対座標 (x,y,w,h) と
 * 全体高さを返す純関数。高さは列幅 ÷ 縦横比で計算（DOM 実測なし）。
 *
 * @param input - コンテナ幅・ギャップ・目安列幅・カード一覧
 * @returns 各カードの絶対座標マップ、全体高さ、列数、列幅
 */
export function computeHousingMasonry(input: MasonryInput): MasonryResult {
  const { cards, containerWidth, gap, targetColumnUnit, maxColumnCount } = input;

  // 列数: (コンテナ幅 + gap) ÷ (目安列幅 + gap) を floor、最低 1
  const fitColumns = Math.max(1, Math.floor((containerWidth + gap) / (targetColumnUnit + gap)));
  const columnCount = maxColumnCount && maxColumnCount > 0
    ? Math.min(fitColumns, maxColumnCount)
    : fitColumns;
  // 列幅: gap を差し引いて均等配分
  const columnWidth = (containerWidth - (columnCount - 1) * gap) / columnCount;

  if (cards.length === 0) {
    return { positions: {}, totalHeight: 0, columnCount, columnWidth };
  }

  // 各列の現在の最下端 y 座標を追跡
  const columnBottoms: number[] = Array.from({ length: columnCount }, () => 0);
  const positions: Record<string, MasonryPosition> = {};

  for (const card of cards) {
    // 最短列を選ぶ
    let bestCol = 0;
    let bestBottom = columnBottoms[0];
    for (let c = 1; c < columnCount; c++) {
      if (columnBottoms[c] < bestBottom) {
        bestBottom = columnBottoms[c];
        bestCol = c;
      }
    }

    // 縦横比が 0 以下の場合は 1 にフォールバック
    const aspect = card.aspectRatio > 0 ? card.aspectRatio : 1;
    const h = columnWidth / aspect;
    const x = bestCol * (columnWidth + gap);
    const y = bestBottom;

    positions[card.id] = { x, y, w: columnWidth, h };
    // この列の最下端を更新 (次カードの y + gap 分を先行加算)
    columnBottoms[bestCol] = y + h + gap;
  }

  // 全列の最下端の最大値から末尾 gap を引いたものが全体高さ
  const maxBottom = columnBottoms.reduce((m, b) => (b > m ? b : m), 0);
  const totalHeight = Math.max(0, maxBottom - gap);

  return { positions, totalHeight, columnCount, columnWidth };
}
