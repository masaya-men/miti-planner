/** 画面内クランプ用の座標・サイズ型。 */
export interface XY { x: number; y: number; }
export interface Size { w: number; h: number; }

/**
 * desired 位置を、size の要素が viewport 内に収まるよう margin つきでクランプする純関数。
 * - 要素が収まる軸: [margin, viewport - size - margin] にクランプ(要素の端が画面外に出ない)。
 * - 要素が viewport より大きい軸: margin(先頭)に固定(上端/左端を見せる)。
 *
 * モーダルの配置でハードコードした「概算高さ」を使うと、低い画面(高ズーム等)で
 * クランプが効きすぎて画面外に張り付くため、実測サイズを渡してここで一元的に収める。
 */
export function clampToViewport(desired: XY, size: Size, viewport: Size, margin = 8): XY {
  const clamp1 = (d: number, s: number, v: number) => {
    const max = v - s - margin;
    if (max <= margin) return margin; // 要素が画面より大きい → 先頭(margin)に固定
    return Math.min(Math.max(d, margin), max);
  };
  return {
    x: clamp1(desired.x, size.w, viewport.w),
    y: clamp1(desired.y, size.h, viewport.h),
  };
}
