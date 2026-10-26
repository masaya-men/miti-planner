import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
// @ts-expect-error mjs の共通部品(型定義なし)
import { diffPng, toleranceFrom } from '../lib/diff.mjs';

/** w×h の単色 PNG。patch を渡すとその矩形だけ別の灰色にする。 */
async function solid(w: number, h: number, gray: number, patch?: { x: number; y: number; size: number; gray: number }): Promise<Buffer> {
  const data = Buffer.alloc(w * h * 3, gray);
  if (patch) {
    for (let y = patch.y; y < patch.y + patch.size; y++) for (let x = patch.x; x < patch.x + patch.size; x++) {
      const i = (y * w + x) * 3;
      data[i] = data[i + 1] = data[i + 2] = patch.gray;
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

describe('diffPng', () => {
  it('同じ画像は blocks=0', async () => {
    const a = await solid(64, 64, 100);
    const d = await diffPng(a, a);
    expect(d.blocks).toBe(0);
    expect(d.total).toBe(64);
    expect(d.ratio).toBe(0);
  });

  it('1 ブロック(8×8)だけ色差 7 にすると blocks=1・mask の該当位置だけ 1', async () => {
    const a = await solid(64, 64, 100);
    const b = await solid(64, 64, 100, { x: 16, y: 24, size: 8, gray: 107 });
    const d = await diffPng(a, b);
    expect(d.blocks).toBe(1);
    expect(d.bw).toBe(8);
    expect(d.bh).toBe(8);
    const ones = [...d.mask as Uint8Array].map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    expect(ones).toEqual([3 * 8 + 2]); // by=3, bx=2
  });

  it('色差 6 ちょうどは数えない', async () => {
    const a = await solid(64, 64, 100);
    const b = await solid(64, 64, 100, { x: 16, y: 24, size: 8, gray: 106 });
    const d = await diffPng(a, b);
    expect(d.blocks).toBe(0);
  });

  it('大きさが違うと ratio=1 と sizeMismatch', async () => {
    const d = await diffPng(await solid(64, 64, 100), await solid(64, 72, 100));
    expect(d.ratio).toBe(1);
    expect(d.sizeMismatch).toBe('base 64x64 / head 64x72');
  });
});

describe('toleranceFrom', () => {
  it('下限 10/total が勝つ場合', () => {
    expect(toleranceFrom([0.001, 0.002, 0.0015], 1000)).toBeCloseTo(0.01, 10);
  });
  it('最大 × 1.5 が勝つ場合', () => {
    expect(toleranceFrom([0.02], 100000)).toBeCloseTo(0.03, 10);
  });
});
