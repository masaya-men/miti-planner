import { cu, via, silk, smd, qfp } from '../armor/pcb';
import { railLayout } from './railGeometry';

/** 左レールの基板 SVG の中身(見本 buildRail js:401-413)。幅 14・高さ L。
 *  A の経路 rail:a{k} の続きが rail:b{k}(光が a から b へ繋がる) */
export function railSVG(H: number): string {
  const r = railLayout(H);
  let o = `<rect x="0" y="0" width="14" height="${r.L}" class="brd" rx="1.5"/>`;
  r.busA.forEach((pts, k) => { o += cu(pts, `rail:a${k}`).replace('/>', ` data-trace-next="rail:b${k}"/>`); });
  r.busB.forEach((pts, k) => { o += cu(pts, `rail:b${k}`); });
  o += qfp(r.ic.x, r.ic.y, r.ic.w, r.ic.h, r.ic.pins, 'tb', r.ic.mark);
  r.vias.forEach(([x, y]) => { o += via(x, y, 0.42); });
  r.fence.forEach(([x, y]) => { o += via(x, y, 0.36); });
  r.smd.forEach((s) => { o += smd(s.x, s.y, s.w, s.h, true); });
  r.labels.forEach((l) => { o += silk(l.x, l.y, l.t, 'middle', undefined, undefined, 90); });
  return o;
}
