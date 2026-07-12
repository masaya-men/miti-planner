// 探す地図の拡大カード (MapSpotCard) が `.housing-bmap-wrap` (overflow:hidden) の外へはみ出さない
// ための「クランプ」計算。2026-07-12 案B: popped は区画中央にアンカーする (しっぽ無し) ため、
// マーカー中心に置いた矩形をコンテナ内に収める計算に単純化した (flip 廃止)。
// 入力はすべて呼び出し側で確定済みの数値 (ResizeObserver キャッシュのコンテナ実寸 / マウント時に
// 一度測定したカード実寸 / パン・ズーム込みで算出済みのマーカー画面座標)。pointermove 中の layout
// 読み取りはしない。返す dx/dy は画面 px (呼び出し側で ÷actualScale して card-plane px に変換する)。

/** クランプ後もコンテナの縁に張り付かないための余白(px)。 */
export const CLAMP_EDGE_PADDING = 8;

export interface ClampExpandedCardInput {
  /** マーカーの画面座標 (`.housing-bmap-wrap` 基準、パン/ズーム込み)。 */
  markerX: number;
  markerY: number;
  /** コンテナ実寸 (ResizeObserver キャッシュ)。 */
  wrapW: number;
  wrapH: number;
  /** 拡大時 (画面固定サイズ) のカード実寸 (マウント時に測定した layout 実寸)。 */
  cardW: number;
  cardH: number;
}

export interface ClampExpandedCardOffset {
  dx: number;
  dy: number;
}

/**
 * 1軸ぶんのクランプ量。終端(下端/右端)のはみ出しを優先して直す(フッターの CTA を優先)。
 * 終端が収まっている場合に限り始端(上端/左端)を直す(カードがコンテナより大きい極端ケースでは
 * 両立不能なので終端側を上書きしない = CTA を犠牲にしない)。
 */
function clampAxis(minEdge: number, maxEdge: number, containerSize: number): number {
  if (maxEdge > containerSize - CLAMP_EDGE_PADDING) {
    return containerSize - CLAMP_EDGE_PADDING - maxEdge;
  }
  if (minEdge < CLAMP_EDGE_PADDING) {
    return CLAMP_EDGE_PADDING - minEdge;
  }
  return 0;
}

/** マーカー中心にアンカーした矩形がコンテナ内に収まるための追加オフセット (dx, dy・画面 px) を返す。 */
export function clampExpandedCardOffset(input: ClampExpandedCardInput): ClampExpandedCardOffset {
  const { markerX, markerY, wrapW, wrapH, cardW, cardH } = input;
  const left = markerX - cardW / 2;
  const right = markerX + cardW / 2;
  const top = markerY - cardH / 2;
  const bottom = markerY + cardH / 2;
  return {
    dx: clampAxis(left, right, wrapW),
    dy: clampAxis(top, bottom, wrapH),
  };
}
