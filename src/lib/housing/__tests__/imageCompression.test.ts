import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCompress = vi.fn();
const mockGetDataUrlFromFile = vi.fn(async (file: File) => `data:${file.type};base64,ZmFrZQ==`);

vi.mock('browser-image-compression', () => ({
  default: Object.assign(mockCompress, { getDataUrlFromFile: mockGetDataUrlFromFile }),
}));

/** 指定バイト数・MIME の File を作る (実際の画像デコードはしない、圧縮結果を模すダミー)。 */
function fakeFile(sizeBytes: number, type: string, name = 'x'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

/** document.createElement('canvas').toDataURL の戻りを差し替えて WebP 対応/非対応を模す。 */
function stubCanvasWebpSupport(supported: boolean) {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`unexpected tag: ${tag}`);
      return {
        width: 0,
        height: 0,
        toDataURL: (type: string) =>
          supported && type === 'image/webp' ? 'data:image/webp;base64,AA==' : 'data:image/png;base64,AA==',
      };
    },
  };
}

describe('compressHousingImage', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCompress.mockReset();
    mockGetDataUrlFromFile.mockClear();
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('WebP 対応ブラウザでは fileType=image/webp + alwaysKeepResolution:true で圧縮する', async () => {
    stubCanvasWebpSupport(true);
    mockCompress.mockResolvedValueOnce(fakeFile(150 * 1024, 'image/webp'));

    const { compressHousingImage } = await import('../imageCompression');
    const input = fakeFile(5 * 1024 * 1024, 'image/jpeg', 'photo.jpg');
    const result = await compressHousingImage(input);

    expect(mockCompress).toHaveBeenCalledTimes(1);
    const [, options] = mockCompress.mock.calls[0];
    expect(options.fileType).toBe('image/webp');
    expect(options.alwaysKeepResolution).toBe(true);
    expect(result.mimeType).toBe('image/webp');
    expect(result.compressedBytes).toBe(150 * 1024);
  });

  it('WebP 非対応ブラウザ (古い Safari 等) では PNG ではなく image/jpeg にフォールバックする', async () => {
    stubCanvasWebpSupport(false);
    mockCompress.mockResolvedValueOnce(fakeFile(200 * 1024, 'image/jpeg'));

    const { compressHousingImage } = await import('../imageCompression');
    await compressHousingImage(fakeFile(5 * 1024 * 1024, 'image/png', 'photo.png'));

    const [, options] = mockCompress.mock.calls[0];
    expect(options.fileType).toBe('image/jpeg');
  });

  it('document が使えない環境 (SSR/テスト実行環境) では例外を投げず jpeg にフォールバックする', async () => {
    // document を一切定義しない = supportsWebpEncoding() 内で ReferenceError → catch → false
    mockCompress.mockResolvedValueOnce(fakeFile(200 * 1024, 'image/jpeg'));

    const { compressHousingImage } = await import('../imageCompression');
    await expect(compressHousingImage(fakeFile(1024, 'image/jpeg'))).resolves.toBeTruthy();

    const [, options] = mockCompress.mock.calls[0];
    expect(options.fileType).toBe('image/jpeg');
  });

  it('1回目が1MB超なら2回目 (quality 0.4・解像度維持) を試す', async () => {
    stubCanvasWebpSupport(true);
    mockCompress
      .mockResolvedValueOnce(fakeFile(1.5 * 1024 * 1024, 'image/webp')) // 1回目: 超過
      .mockResolvedValueOnce(fakeFile(300 * 1024, 'image/webp')); // 2回目: OK

    const { compressHousingImage } = await import('../imageCompression');
    const result = await compressHousingImage(fakeFile(8 * 1024 * 1024, 'image/jpeg'));

    expect(mockCompress).toHaveBeenCalledTimes(2);
    const secondOptions = mockCompress.mock.calls[1][1];
    expect(secondOptions.initialQuality).toBe(0.4);
    expect(secondOptions.alwaysKeepResolution).toBe(true);
    expect(result.compressedBytes).toBe(300 * 1024);
  });

  it('2回目も1MB超なら最終手段として解像度縮小を許可する3回目を試す (413消失防止)', async () => {
    stubCanvasWebpSupport(true);
    mockCompress
      .mockResolvedValueOnce(fakeFile(1.5 * 1024 * 1024, 'image/webp')) // 1回目: 超過
      .mockResolvedValueOnce(fakeFile(1.2 * 1024 * 1024, 'image/webp')) // 2回目: まだ超過
      .mockResolvedValueOnce(fakeFile(400 * 1024, 'image/webp')); // 3回目: OK

    const { compressHousingImage } = await import('../imageCompression');
    const result = await compressHousingImage(fakeFile(10 * 1024 * 1024, 'image/jpeg'));

    expect(mockCompress).toHaveBeenCalledTimes(3);
    const thirdOptions = mockCompress.mock.calls[2][1];
    expect(thirdOptions.initialQuality).toBe(0.2);
    expect(thirdOptions.alwaysKeepResolution).toBe(false);
    expect(result.compressedBytes).toBe(400 * 1024);
  });
});
