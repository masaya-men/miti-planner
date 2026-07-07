/** DEV 経路エディタのパン/ズーム状態。tx/ty はラップ px、scale は倍率。 */
export interface MapView { scale: number; tx: number; ty: number }

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const STEP = 1.1;

/**
 * ホイールでカーソル位置(mx,my=ラップ内 px)を固定したままズームした新しい MapView を返す純関数。
 * scale は [1,8] にクランプ。クランプで scale が変わらない時は同一参照を返す(無駄な再描画回避)。
 */
export function applyWheelZoom(v: MapView, mx: number, my: number, deltaY: number): MapView {
  const factor = deltaY < 0 ? STEP : 1 / STEP;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  if (newScale === v.scale) return v;
  const k = newScale / v.scale;
  return { scale: newScale, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
}
