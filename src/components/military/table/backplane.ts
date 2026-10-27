import { busPaths, offsetPoly, P } from '../armor/geom';
import { cu, qfp, silk, smd, via } from '../armor/pcb';
import type { Pt } from '../armor/types';

// ジョブの差込口の土台の基板(見本 v11 js:376-395 の meander と js:431-466 の buildBackplane)。
// 純関数: 列の中心 x(基板 SVG の左端を 0 とした値)から SVG の中身の文字列を作る。

/** 基板の高さ(見本 js:433 の pcb 高さ) */
export const BACKPLANE_H = 32;
/** 差込口の左右の張り出し(見本 17.6 = 差込口の半幅 17 + 余白) */
const HALF = 17.6;

/** 0〜1 の決まった乱数(同じ引数なら必ず同じ値)。配線の形の揺らぎに使う */
function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(c + 1, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 蛇行(長さ合わせの配線)の中心線: x0 → x1 を横に進み、真ん中で n 回、下へ振れる(見本 js:388-395) */
export function meander(x0: number, x1: number, y: number, amp: number, n: number, pitch: number, c = 0.5): Pt[] {
  const m = (x0 + x1) / 2, span = n * pitch * 2, s = m - span / 2;
  const pts: Pt[] = [[x0, y]];
  for (let i = 0; i < n; i++) {
    const a = s + i * pitch * 2, b = a + pitch;
    pts.push([a - c, y], [a, y + c], [a, y + amp - c], [a + c, y + amp], [b - c, y + amp], [b, y + amp - c], [b, y + c], [b + c, y]);
  }
  pts.push([x1, y]);
  return pts;
}

export interface BackplaneOpts {
  /** 各列の中心 x(基板 SVG の左端が 0。表の列の並び順) */
  centers: number[];
  /** 基板 SVG の幅(見本 pw = bw - 9) */
  pw: number;
  /** ライトパーティの境目(j 番目と j+1 番目の間)。null = 置かない(ロール別順など) */
  lpGap: number | null;
}

/** 基板の床の輪郭(副装甲の窪みを 1.8 広げたもの。見本 js:434) */
function backplaneBoard(pw: number): string {
  const bw = pw + 9;
  const pocket: Pt[] = [[14, 4], [bw - 5, 4], [bw - 5, 36], [4, 36], [4, 14]];
  return `<polygon points="${P(offsetPoly(pocket, 1.8).map(([x, y]): Pt => [x - 4, y - 4]))}" class="brd"/>`;
}

/**
 * 4 本のバス(bp:b0..3)/ 差込口の脇から扇形(bp:f{j}{r|l}{0..5})/ 間に蛇行ペア(bp:m{j}{0..1})と部品 /
 * ライトパーティの境目に分配 IC。返すのは <svg> の中身。
 */
export function backplaneSVG(o: BackplaneOpts): string {
  const { centers: lc, pw, lpGap } = o;
  let out = backplaneBoard(pw);
  busPaths([[6, 9], [6, 24.3], [9.8, 28.1], [pw - 2, 28.1]], 4, 1.1).forEach((pts, k) => { out += cu(pts, 'bp:b' + k); });
  // 扇 1 本ずつの形を差込口・側・本数で決まった乱数で変える(毎回同じ形 = 再描画でチラつかない)。
  // 形 = 横に出て 45° で下りる(面取りの長さ 0.8〜2.0)/ 横に出たまま止まる。面取り ≤2 なら下の線と交差しない
  const fan = (x0: number, dir: 1 | -1, j: number, side: 'r' | 'l') => {
    for (let k = 0; k < 6; k++) {
      const r = hash01(j, side === 'r' ? 1 : 2, k);
      const y0 = 8.2 + k * 1.2, xt = x0 + dir * (2 + (5 - k) * 1.15 + (hash01(j, 3, k) - 0.5) * 0.2);
      const name = `bp:f${j}${side}${k}`;
      if (k > 0 && r < 0.22) {                          // 曲がらずに横で止まる(一番外側の線は止めない)
        const xe = xt - dir * (0.4 + hash01(j, 4, k) * 0.6);
        out += cu([[x0, y0], [xe, y0]], name) + via(xe + dir * 0.5, y0, 0.42);
        continue;
      }
      const ch = r < 0.55 ? 0.8 : r < 0.8 ? 1.4 : 2.0;   // 面取りの長さ = 曲がり方の違い
      const yv = 19.8 + hash01(j, 5, k) * 3.2;
      out += cu([[x0, y0], [xt - dir * ch, y0], [xt, y0 + ch], [xt, yv]], name);
      out += via(xt, yv + 0.5, 0.42);
    }
  };
  lc.forEach((x, j) => {
    if (j < lc.length - 1) fan(x + HALF, 1, j, 'r');
    if (j > 0) fan(x - HALF, -1, j, 'l');
    out += silk(x - 17, 31.2, 'J' + (j + 1));
  });
  for (let j = 0; j < lc.length - 1; j++) {
    const a = lc[j] + HALF + 9.5, b = lc[j + 1] - HALF - 9.5, m = (a + b) / 2;
    if (b - a < 8) continue;
    if (j === lpGap) {                                   // ライトパーティの境目
      out += qfp(m - 4.2, 9, 8.4, 9, [10.6, 12.2, 13.8, 15.4, 17], 'lr', 'U2');
      out += silk(m, 23.4, 'LP1 | LP2', 'middle');
      continue;
    }
    busPaths(meander(a, b, 3.1, 2.4, Math.max(1, Math.floor((b - a - 4) / 5)), 1.25), 2, 0.8).forEach((pts, k) => { out += cu(pts, `bp:m${j}${k}`); });
    out += smd(m - 1.1, 11.4, 2.2, 1) + smd(m - 1.1, 15, 2.2, 1) + via(m - 2.3, 13.7, 0.4) + via(m + 2.3, 13.7, 0.4);
  }
  out += silk(2.5, 6.5, 'BUS');
  return out;
}
