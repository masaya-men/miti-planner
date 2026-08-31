import { describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
import { computeCoverThumbHash } from '../_coverThumbHash.js';
import { resizeToWebp } from '../_imageFormatConvert.js';

async function makePng(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: 120, g: 80, b: 200 } },
  }).png().toBuffer();
}

describe('computeCoverThumbHash', () => {
  it('画像から base64 の ThumbHash を返す', async () => {
    const png = await makePng(800, 450);
    const hash = await computeCoverThumbHash(png);
    expect(typeof hash).toBe('string');
    expect(hash!.length).toBeGreaterThan(20);
    expect(hash!.length).toBeLessThan(80);
    // base64 として往復できる
    expect(Buffer.from(hash!, 'base64').length).toBeGreaterThan(0);
  });

  it('壊れた Buffer では null(非致命)', async () => {
    // 実装の catch 節は console.error でノイズを出す(意図的)。テスト出力を汚さないよう抑制。
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const hash = await computeCoverThumbHash(Buffer.from('not an image'));
      expect(hash).toBeNull();
    } finally {
      errSpy.mockRestore();
    }
  });
});

describe('resizeToWebp', () => {
  it('指定幅以下の webp を返す', async () => {
    const png = await makePng(2000, 1125);
    const out = await resizeToWebp(png, 480);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(480);
  });

  it('元より大きい幅を指定しても拡大しない', async () => {
    const png = await makePng(300, 200);
    const out = await resizeToWebp(png, 960);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(300);
  });
});
