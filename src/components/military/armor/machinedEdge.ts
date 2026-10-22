const f2 = (n: number): string => n.toFixed(2);

/** 窓の縁の切り口(上の板の切れ目の側面の削り跡)。L = 左の板の右端、R = 右の板の左端 */
export function machinedEdge(side: 'L' | 'R', cut: number, band: { y0: number; y1: number }): string {
  if (band.y1 - band.y0 < 8) return '';
  const L = side === 'L', x = L ? cut - 1.6 : cut, bx = L ? cut - 4 : cut + 0.6, y0 = band.y0 + 1, y1 = band.y1 - 1;
  let s = `<rect x="${x}" y="${y0}" width="1.6" height="${y1 - y0}" fill="#0c0e10"/>`;
  for (let y = y0 + 1; y < y1; y += 1.6) s += `<line x1="${bx}" y1="${y}" x2="${bx + 3.4}" y2="${f2(y + 0.3)}" stroke="${L ? '#000' : '#fff'}" stroke-opacity="${L ? 0.25 : 0.14}" stroke-width="0.35"/>`;
  s += `<line x1="${L ? cut - 4.1 : cut + 4.1}" y1="${y0}" x2="${L ? cut - 4.1 : cut + 4.1}" y2="${y1}" stroke="#fff" stroke-opacity="${L ? 0.18 : 0.34}" stroke-width="0.55"/><line x1="${L ? cut - 0.3 : cut + 1.9}" y1="${y0}" x2="${L ? cut - 0.3 : cut + 1.9}" y2="${y1}" stroke="#fff" stroke-opacity="0.22" stroke-width="0.45"/>`;
  return s;
}
