/** 軌跡を写す枠(見本の polyline の範囲: x 110〜306・y 30(下)〜4(上)) */
const X0 = 110, X1 = 306, Y_BOTTOM = 30, Y_TOP = 4;

/** 記録点(x,y とも 0〜100)を viewBox 座標へ。1 点だけなら左下の起点から線を引く */
export function toCrtVertices(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const v = points.map((p) => ({
    x: +(X0 + (p.x / 100) * (X1 - X0)).toFixed(2),
    y: +(Y_BOTTOM - (p.y / 100) * (Y_BOTTOM - Y_TOP)).toFixed(2),
  }));
  return v.length === 1 ? [{ x: X0, y: Y_BOTTOM }, v[0]] : v;
}
