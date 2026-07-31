// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadBytesMock = vi.fn().mockResolvedValue(undefined);
const getDownloadURLMock = vi.fn()
  .mockResolvedValueOnce('https://storage.example.com/avatar.webp')
  .mockResolvedValueOnce('https://storage.example.com/avatar.png');
const updateDocMock = vi.fn().mockResolvedValue(undefined);
const getDocMock = vi.fn().mockResolvedValue({ exists: () => true });

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytes: (...args: unknown[]) => uploadBytesMock(...args),
  getDownloadURL: (...args: unknown[]) => getDownloadURLMock(...args),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
}));
vi.mock('../../lib/firebase', () => ({ storage: {}, db: {} }));

// createImageBitmap / canvas は jsdom に無いため最小限のグローバルモックを用意する。
beforeEach(() => {
  uploadBytesMock.mockClear();
  updateDocMock.mockClear();
  // getDownloadURLMock は once キューが 2 回分で使い切りのため、
  // テストをまたいで queue が空になるのを防ぐためテストごとに再設定する。
  getDownloadURLMock.mockReset();
  getDownloadURLMock
    .mockResolvedValueOnce('https://storage.example.com/avatar.webp')
    .mockResolvedValueOnce('https://storage.example.com/avatar.png');
  (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({ width: 128, height: 128 });
  (globalThis as any).HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() });
  (globalThis as any).HTMLCanvasElement.prototype.toBlob = vi.fn((cb: (b: Blob | null) => void) => {
    cb(new Blob(['png-bytes'], { type: 'image/png' }));
  });
});

describe('uploadAvatar', () => {
  it('WebP本体に加えPNG派生版もアップロードし、両方のURLをFirestoreに保存する', async () => {
    const { uploadAvatar } = await import('../avatarUpload');
    const webpBlob = new Blob(['webp-bytes'], { type: 'image/webp' });
    const url = await uploadAvatar('user-1', webpBlob);

    expect(url).toBe('https://storage.example.com/avatar.webp');
    expect(uploadBytesMock).toHaveBeenCalledTimes(2);
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        avatarUrl: 'https://storage.example.com/avatar.webp',
        avatarPngUrl: 'https://storage.example.com/avatar.png',
      }),
    );
  });

  it('PNG変換に失敗してもWebP本体のアップロードは成功として返す(致命的にしない)', async () => {
    (globalThis as any).createImageBitmap = vi.fn().mockRejectedValue(new Error('decode failed'));
    const { uploadAvatar } = await import('../avatarUpload');
    const webpBlob = new Blob(['webp-bytes'], { type: 'image/webp' });
    const url = await uploadAvatar('user-2', webpBlob);
    expect(url).toBe('https://storage.example.com/avatar.webp');
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ avatarPngUrl: null }),
    );
  });
});
