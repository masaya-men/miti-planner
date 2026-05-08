// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock はホイストされるため、factory 内で vi.fn() を直接定義する
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('../../lib/firebase', () => ({
  db: {},
  auth: {},
  appCheck: Promise.resolve({}),
}));

import * as firestore from 'firebase/firestore';
import { isHousingActivated, markHousingActivated } from '../../lib/housingFeatureSession';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isHousingActivated', () => {
  it('ドキュメントが存在しない場合は false を返す', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
    } as ReturnType<typeof firestore.getDoc> extends Promise<infer T> ? T : never);

    const result = await isHousingActivated('uid-123');
    expect(result).toBe(false);
    expect(firestore.doc).toHaveBeenCalledWith({}, 'users', 'uid-123', 'featureSessions', 'housing');
  });

  it('activated=true のとき true を返す', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ activated: true }),
    } as ReturnType<typeof firestore.getDoc> extends Promise<infer T> ? T : never);

    const result = await isHousingActivated('uid-123');
    expect(result).toBe(true);
  });

  it('activated=false のとき false を返す', async () => {
    vi.mocked(firestore.getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ activated: false }),
    } as ReturnType<typeof firestore.getDoc> extends Promise<infer T> ? T : never);

    const result = await isHousingActivated('uid-123');
    expect(result).toBe(false);
  });
});

describe('markHousingActivated', () => {
  it('正しいパスと引数で setDoc を呼ぶ', async () => {
    vi.mocked(firestore.setDoc).mockResolvedValueOnce(undefined);
    await markHousingActivated('uid-456');

    expect(firestore.doc).toHaveBeenCalledWith({}, 'users', 'uid-456', 'featureSessions', 'housing');
    expect(firestore.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/uid-456/featureSessions/housing' }),
      expect.objectContaining({ activated: true })
    );
  });

  it('setDoc が reject したら throw する', async () => {
    vi.mocked(firestore.setDoc).mockRejectedValueOnce(new Error('permission-denied'));
    await expect(markHousingActivated('uid-789')).rejects.toThrow('permission-denied');
  });
});
