import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { convertToPngIfNeeded } from '../_imageFormatConvert.js';

describe('convertToPngIfNeeded', () => {
  it('WebPをPNGに変換する', async () => {
    const webpBuf = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .webp()
      .toBuffer();

    const result = await convertToPngIfNeeded(webpBuf, 'image/webp');
    expect(result).not.toBeNull();
    // PNGマジックナンバー
    expect(result![0]).toBe(0x89);
    expect(result![1]).toBe(0x50);
    expect(result![2]).toBe(0x4e);
    expect(result![3]).toBe(0x47);
  });

  it('AVIFをPNGに変換する', async () => {
    const avifBuf = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .avif()
      .toBuffer();

    const result = await convertToPngIfNeeded(avifBuf, 'image/avif');
    expect(result).not.toBeNull();
    expect(result![0]).toBe(0x89);
  });

  it('PNG/JPEGは変換せずnullを返す', async () => {
    const buf = Buffer.from('dummy');
    expect(await convertToPngIfNeeded(buf, 'image/png')).toBeNull();
    expect(await convertToPngIfNeeded(buf, 'image/jpeg')).toBeNull();
  });

  it('壊れたバイト列は例外を投げずnullを返す', async () => {
    const garbage = Buffer.from([1, 2, 3, 4, 5]);
    expect(await convertToPngIfNeeded(garbage, 'image/webp')).toBeNull();
  });

  it('maxDimension指定時は長辺をその範囲まで縮小する', async () => {
    const webpBuf = await sharp({
      create: { width: 1000, height: 500, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .webp()
      .toBuffer();

    const result = await convertToPngIfNeeded(webpBuf, 'image/webp', { maxDimension: 200 });
    expect(result).not.toBeNull();
    const meta = await sharp(result!).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
  });

  it('maxDimensionより元画像が小さい場合は拡大しない', async () => {
    const webpBuf = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .webp()
      .toBuffer();

    const result = await convertToPngIfNeeded(webpBuf, 'image/webp', { maxDimension: 480 });
    const meta = await sharp(result!).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
  });
});
