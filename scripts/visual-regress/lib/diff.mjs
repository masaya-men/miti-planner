// @ts-check
/**
 * 画像の差の数え方(sticky-scroll/shots.mjs から移した共通部品)。
 * 画素ごとではなく 8x8 ブロックの平均差で数え、MIL-SPEC の粒状ノイズを均す。
 */
import sharp from 'sharp';

export const BLOCK = 8; // 差を数えるブロックの一辺(画素)
export const BLOCK_MEAN = 6; // ブロック内の平均の色差(各画素の RGB 最大差)がこれを超えたら「違うブロック」
const FLOOR_RATIO = 0.0005; // 許容の下限 = 全体の 0.05%
const MIN_BLOCKS = 10; // 小さい切り出しでは 0.05% が数ブロックになり厳しすぎるので、ブロック数の下限も置く
const MARGIN = 1.5; // 同じ画面を撮り直した差の最大値 × 1.5

/**
 * 2 枚の PNG の違うブロック数。大きさが違えば全部違い(ratio=1)とする。
 * mask は違うブロックを 1 にした bw×bh の配列(報告の色塗りと切り出し用)。
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {Promise<{ blocks: number, total: number, ratio: number, sizeMismatch?: string, mask: Uint8Array, bw: number, bh: number }>}
 */
export async function diffPng(a, b) {
  const [ra, rb] = await Promise.all([a, b].map((x) => sharp(x).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) {
    const bwA = Math.ceil(ra.info.width / BLOCK), bhA = Math.ceil(ra.info.height / BLOCK);
    const total = Math.max(bwA * bhA, Math.ceil(rb.info.width / BLOCK) * Math.ceil(rb.info.height / BLOCK));
    return {
      blocks: total, total, ratio: 1,
      sizeMismatch: `${ra.info.width}x${ra.info.height} vs ${rb.info.width}x${rb.info.height}`,
      mask: new Uint8Array(bwA * bhA).fill(1), bw: bwA, bh: bhA,
    };
  }
  const A = ra.data, B = rb.data, W = ra.info.width, H = ra.info.height;
  const bw = Math.ceil(W / BLOCK), bh = Math.ceil(H / BLOCK);
  const mask = new Uint8Array(bw * bh);
  let n = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let sum = 0, cnt = 0;
    for (let y = by * BLOCK; y < Math.min(H, (by + 1) * BLOCK); y++) for (let x = bx * BLOCK; x < Math.min(W, (bx + 1) * BLOCK); x++) {
      const i = (y * W + x) * 4;
      sum += Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); cnt++;
    }
    if (sum / cnt > BLOCK_MEAN) { n++; mask[by * bw + bx] = 1; }
  }
  return { blocks: n, total: bw * bh, ratio: n / (bw * bh), mask, bw, bh };
}

/**
 * 許容の割合: 撮り直しの差の最大 × 1.5 と、下限 max(0.05%, 10 ブロック分) の大きい方。
 * @param {number[]} ratios
 * @param {number} total ブロックの総数
 */
export function toleranceFrom(ratios, total) {
  return Math.max(Math.max(0, ...ratios) * MARGIN, FLOOR_RATIO, MIN_BLOCKS / total);
}
