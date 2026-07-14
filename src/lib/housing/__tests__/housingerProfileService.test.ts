import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../firebase', () => ({
  db: {},
  auth: { currentUser: null as { uid: string } | null },
}));

const mockDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (...a: unknown[]) => mockDoc(...a),
  getDoc: (...a: unknown[]) => mockGetDoc(...a),
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
}));

vi.mock('../../housingAuthHeaders', () => ({
  buildHousingHeaders: vi.fn(async () => ({
    'Content-Type': 'application/json',
    'X-Firebase-AppCheck': 'app-check-token',
    Authorization: 'Bearer mock-token',
  })),
}));

import {
  getHousingerProfile,
  invalidateHousingerProfileCache,
  getHousingerListings,
  upsertHousingerProfile,
  syncHousingerProfileBestEffort,
} from '../housingerProfileService';
import { auth } from '../../firebase';
import type { HousingerProfile } from '../../../types/housing';

const baseProfile: HousingerProfile = {
  displayName: 'たかし',
  avatarUrl: null,
  bio: null,
  snsUrl: null,
  isPublished: true,
  isModerationHidden: false,
  reportCount: 0,
  createdAt: 1,
  updatedAt: 1,
};

beforeEach(() => {
  mockDoc.mockReset();
  mockGetDoc.mockReset();
  mockCollection.mockReset();
  mockQuery.mockReset();
  mockWhere.mockReset();
  mockOrderBy.mockReset();
  mockLimit.mockReset();
  mockGetDocs.mockReset();
  global.fetch = vi.fn();
  // @ts-expect-error テスト用に currentUser (readonly) を上書きする
  auth.currentUser = null;
});

describe('getHousingerProfile', () => {
  it('公開中プロフィールを返す', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => baseProfile });
    const p = await getHousingerProfile('u-published');
    expect(p).toEqual(baseProfile);
  });

  it('isPublished=false なら null', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...baseProfile, isPublished: false }),
    });
    const p = await getHousingerProfile('u-unpublished');
    expect(p).toBeNull();
  });

  it('isModerationHidden=true なら null (運営強制非表示)', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...baseProfile, isModerationHidden: true }),
    });
    const p = await getHousingerProfile('u-hidden');
    expect(p).toBeNull();
  });

  it('ドキュメント不存在なら null', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const p = await getHousingerProfile('u-notfound');
    expect(p).toBeNull();
  });

  it('rules 拒否等の例外も null に丸める (呼び出し側に例外を漏らさない)', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('permission-denied'));
    const p = await getHousingerProfile('u-denied');
    expect(p).toBeNull();
  });

  it('2回目は Firestore を叩かない (セッションキャッシュ)', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => baseProfile });
    const p1 = await getHousingerProfile('u-cache');
    const p2 = await getHousingerProfile('u-cache');
    expect(p1).toEqual(baseProfile);
    expect(p2).toEqual(baseProfile);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  it('null 結果もキャッシュする (非公開判定の再取得を防ぐ)', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const p1 = await getHousingerProfile('u-nullcache');
    const p2 = await getHousingerProfile('u-nullcache');
    expect(p1).toBeNull();
    expect(p2).toBeNull();
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateHousingerProfileCache', () => {
  it('invalidate 後は再度 Firestore を叩く', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => baseProfile });
    await getHousingerProfile('u-invalidate');
    expect(mockGetDoc).toHaveBeenCalledTimes(1);

    invalidateHousingerProfileCache('u-invalidate');

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...baseProfile, bio: '更新後' }),
    });
    const p = await getHousingerProfile('u-invalidate');
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
    expect(p?.bio).toBe('更新後');
  });
});

describe('getHousingerListings', () => {
  it('公開キャッシュ窓口 (fetch) から uid 指定で listings を取得する', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ version: 5 }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ listings: [{ id: 'a', ownerUid: 'u-listing' }] }),
      });
    const r = await getHousingerListings('u-listing');
    expect(r.map((x) => x.id)).toEqual(['a']);
    const secondCallUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(secondCallUrl).toContain('action=housinger');
    expect(secondCallUrl).toContain('uid=u-listing');
  });

  it('0 件なら空配列', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ version: 1 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ listings: [] }) });
    const r = await getHousingerListings('u-listing-empty');
    expect(r).toEqual([]);
  });
});

describe('upsertHousingerProfile', () => {
  it('成功時 ok:true + profile を返し、自分 (ログイン中 uid) のキャッシュを invalidate する', async () => {
    // @ts-expect-error テスト用に currentUser (readonly) を上書きする
    auth.currentUser = { uid: 'me' } as { uid: string };

    // 先にキャッシュを作っておく
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => baseProfile });
    await getHousingerProfile('me');
    expect(mockGetDoc).toHaveBeenCalledTimes(1);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, profile: { ...baseProfile, bio: 'hi' } }),
    });
    const res = await upsertHousingerProfile({ bio: 'hi' });
    expect(res).toEqual({ ok: true, profile: { ...baseProfile, bio: 'hi' } });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/housing?action=upsert-housinger-profile',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ bio: 'hi' }) }),
    );

    // invalidate されているはずなので、再度 getHousingerProfile('me') は Firestore を叩く
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ...baseProfile, bio: 'hi' }),
    });
    await getHousingerProfile('me');
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });

  it('失敗時 (400 invalid_bio 等) は ok:false + error を返す', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_bio' }),
    });
    const res = await upsertHousingerProfile({ bio: 'x'.repeat(200) });
    expect(res).toEqual({ ok: false, error: 'invalid_bio' });
  });

  it('未ログイン (buildHousingHeaders が例外) でも ok:false を返す (例外を投げない)', async () => {
    const { buildHousingHeaders } = await import('../../housingAuthHeaders');
    (buildHousingHeaders as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('not_authenticated'),
    );
    const res = await upsertHousingerProfile({});
    expect(res).toEqual({ ok: false, error: 'not_authenticated' });
  });
});

describe('syncHousingerProfileBestEffort', () => {
  it('未ログイン時は何もしない (fetch を呼ばない)', () => {
    // @ts-expect-error テスト用に currentUser (readonly) を上書きする
    auth.currentUser = null;
    syncHousingerProfileBestEffort();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ログイン中は空 body で upsert-housinger-profile を叩く (名前/アイコン変更後の追従)', async () => {
    // @ts-expect-error テスト用に currentUser (readonly) を上書きする
    auth.currentUser = { uid: 'me' } as { uid: string };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, profile: baseProfile }),
    });
    syncHousingerProfileBestEffort();
    // fire-and-forget なので内部の Promise チェーンが流れきるまで 1 tick 待つ
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/housing?action=upsert-housinger-profile',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({}) }),
    );
  });

  it('失敗しても例外を投げず console.warn するだけ', async () => {
    // @ts-expect-error テスト用に currentUser (readonly) を上書きする
    auth.currentUser = { uid: 'me' } as { uid: string };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server_error' }),
    });
    expect(() => syncHousingerProfileBestEffort()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
