import { describe, it, expect, vi, afterEach } from 'vitest';
import { sniffSupportedImageMime, fetchAsDataUri } from '../_fetchOgImage.js';

function bytes(...b: number[]): ArrayBuffer {
  return new Uint8Array(b).buffer;
}

describe('sniffSupportedImageMime', () => {
  it('PNG マジックナンバーを png と判定', () => {
    expect(sniffSupportedImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0))).toBe('image/png');
  });
  it('JPEG マジックナンバーを jpeg と判定', () => {
    expect(sniffSupportedImageMime(bytes(0xff, 0xd8, 0xff, 0))).toBe('image/jpeg');
  });
  it('WebP (RIFF....WEBP) は null(satori 非対応)', () => {
    expect(sniffSupportedImageMime(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBeNull();
  });
});

describe('fetchAsDataUri', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('PNG を data URI 化して返す', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => png.buffer })));
    const result = await fetchAsDataUri('https://x.test/a.png');
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it('非 2xx は null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await fetchAsDataUri('https://x.test/404.png')).toBeNull();
  });

  it('WebP は null(satori 非対応)', async () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => webp.buffer })));
    expect(await fetchAsDataUri('https://x.test/a.webp')).toBeNull();
  });

  it('fetch が投げたら null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    expect(await fetchAsDataUri('https://x.test/a.png')).toBeNull();
  });
});
