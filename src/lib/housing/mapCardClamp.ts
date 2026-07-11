// 探す地図の拡大カード (MapSpotCard) が `.housing-bmap-wrap` (overflow:hidden、
// housing.css) の外へはみ出さないようにする「クランプ」計算 (code review 指摘: BrowseWardMap.tsx の
// flip (FLIP_MARGIN_X/Y) だけでは「どちらの向きに開いてもコンテナに収まらない」ケースを救えず、
// 上端寄りスポットで拡大カード下端の「ツアーに追加」CTA が枠外へクリップされ操作不能になっていた)。
//
// flip が展開方向の大枠を決めた後、実際に描画される矩形をここで再現し、コンテナ内に完全に収まる
// (収まりきらない極端なケースはフッター側を優先する) ための追加の平行移動量 (dx, dy) を求める。
// 入力はすべて呼び出し側で事前に確定させた数値 (ResizeObserver キャッシュ済みのコンテナ実寸 /
// マウント時に一度だけ測定したカード実寸 / パン・ズーム込みで算出済みのマーカー座標) のみで、
// pointermove 中の layout 読み取りは行わない (呼び出し側 MapSpotCard.tsx も同様)。

/** 拡大カードとマーカーの吹き出し先端の間の余白(px)。housing.css の
 *  `.housing-bmap-card` transform (`calc(-100% - 14px)` / `14px`) と一致させること
 *  (CSS 側の値を変えたらここも合わせて変える)。 */
export const EXPANDED_CARD_GAP = 14;

/** クランプ後もコンテナの縁にぴったり張り付かないための余白(px)。 */
export const CLAMP_EDGE_PADDING = 8;

export interface ClampExpandedCardInput {
  /** マーカーの画面座標 (`.housing-bmap-wrap` 基準、パン/ズーム込みで算出済み)。 */
  markerX: number;
  markerY: number;
  /** コンテナ (`.housing-bmap-wrap`) の実寸。ResizeObserver でキャッシュ済みの値。 */
  wrapW: number;
  wrapH: number;
  /** 拡大カードの実寸 (マウント時に一度だけ測定した値)。 */
  cardW: number;
  cardH: number;
  /** flip 判定 (BrowseWardMap.tsx が算出): 展開方向。 */
  flipX: boolean;
  flipY: boolean;
}

export interface ClampExpandedCardOffset {
  dx: number;
  dy: number;
}

/**
 * 1軸ぶんのクランプ量。終端(下端/右端)のはみ出しを優先して直す
 * (review finding の主眼 = フッターの「ツアーに追加」CTA を優先して画面内に収める)。
 * 終端が既にコンテナ内に収まっている場合に限り、始端(上端/左端)のはみ出しを直す
 * (カード自体がコンテナより大きい極端なケースでは両方を同時に満たせないため、
 * 終端側の補正を上書きしない = CTA を犠牲にしない)。
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

/**
 * flip が決めた展開方向のまま、実際の矩形がコンテナ内に収まるための追加オフセット (dx, dy) を返す。
 * 矩形の算出式は housing.css の `.housing-bmap-card` transform (`translate(-50%|-100%, ...)`) と
 * 対応させている (CSS 側を変えたらここも合わせて変えること)。
 */
export function clampExpandedCardOffset(input: ClampExpandedCardInput): ClampExpandedCardOffset {
  const { markerX, markerY, wrapW, wrapH, cardW, cardH, flipX, flipY } = input;

  const left = flipX ? markerX - cardW : markerX - cardW / 2;
  const right = left + cardW;
  const top = flipY ? markerY + EXPANDED_CARD_GAP : markerY - EXPANDED_CARD_GAP - cardH;
  const bottom = top + cardH;

  return {
    dx: clampAxis(left, right, wrapW),
    dy: clampAxis(top, bottom, wrapH),
  };
}
