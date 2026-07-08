/** DEV 経路エディタ / 本番ツアー地図のパン/ズーム状態。tx/ty はラップ px、scale は倍率。 */
export interface MapView { scale: number; tx: number; ty: number }

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
/** 既定表示(経路フィット)の寄りすぎ上限。手動ズームは MAX_SCALE まで可能だが、
 *  ステップ着地時の既定は「地図1枚全体=1倍」基準で最大 MAX_DEFAULT_SCALE 倍までに抑える
 *  (短い経路でも寄りすぎない=適度なズーム。2026-07-08 ユーザー選定 scale 2)。 */
export const MAX_DEFAULT_SCALE = 2;
const STEP = 1.1;

/** カーソル/ピンチ中心 (mx,my=ラップ内 px) を固定したまま目標倍率へズームした新しい MapView を返す純関数。scale は [1,8] クランプ。変化なしなら同一参照。 */
export function zoomAt(v: MapView, mx: number, my: number, nextScaleRaw: number): MapView {
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScaleRaw));
  if (newScale === v.scale) return v;
  const k = newScale / v.scale;
  return { scale: newScale, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
}

/** ホイールでカーソル位置 (mx,my) を固定したままズーム。deltaY<0 で拡大。 */
export function applyWheelZoom(v: MapView, mx: number, my: number, deltaY: number): MapView {
  return zoomAt(v, mx, my, v.scale * (deltaY < 0 ? STEP : 1 / STEP));
}
