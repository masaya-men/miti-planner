import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `_warmListingCard.ts` の単体テスト。
 * ラッパーは warmListingOgCard / listingRepresentativeImages / resolveSiteOrigin を
 * REAL のまま使う (どれも純関数 or firebase-admin 非依存)。差し替えるのは global.fetch と
 * 注入する fake adminDb のみ。
 */

import { warmListingCard, warmListingCardByRef } from '../_warmListingCard.js';

const ogMetaSet = vi.fn(async (_col?: string, _meta?: unknown) => {});
const fetchMock = vi.fn(async (_url?: unknown, _init?: unknown) => ({ ok: true }) as Response);

function makeDb() {
  return {
    collection: vi.fn((name: string) => ({
      doc: vi.fn(() => ({ set: (meta: unknown) => ogMetaSet(name, meta) })),
    })),
  };
}

beforeEach(() => {
  ogMetaSet.mockClear();
  ogMetaSet.mockImplementation(() => Promise.resolve());
  fetchMock.mockClear();
  fetchMock.mockImplementation(async () => ({ ok: true }) as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('warmListingCard (OGカード事前生成ラッパー)', () => {
  it('代表画像がある listing で og_image_meta.set + /og/<hash>.png fetch が走る', async () => {
    await warmListingCard(makeDb(), 'lopoly.app', {
      visibility: 'public',
      imageMode: 'sns',
      ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg',
    });

    expect(ogMetaSet).toHaveBeenCalledTimes(1);
    expect(ogMetaSet.mock.calls[0][0]).toBe('og_image_meta');
    const ogFetch = fetchMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('/og/'),
    );
    expect(ogFetch?.[0]).toMatch(/^https:\/\/lopoly\.app\/og\/[a-f0-9]{16}\.png$/);
  });

  it('代表画像が無ければ何もしない', async () => {
    await warmListingCard(makeDb(), 'lopoly.app', { visibility: 'public', imageMode: 'sns' });

    expect(ogMetaSet).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('visibility=private では何もしない (シェア用途が無い)', async () => {
    await warmListingCard(makeDb(), 'lopoly.app', {
      visibility: 'private',
      imageMode: 'sns',
      ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg',
    });

    expect(ogMetaSet).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('listing が null / undefined でも投げない', async () => {
    await expect(warmListingCard(makeDb(), 'lopoly.app', null)).resolves.toBeUndefined();
    await expect(warmListingCard(makeDb(), 'lopoly.app', undefined)).resolves.toBeUndefined();
    expect(ogMetaSet).not.toHaveBeenCalled();
  });

  it('setMeta が投げても rethrow しない (全体 try/catch で握りつぶす)', async () => {
    ogMetaSet.mockRejectedValueOnce(new Error('firestore down'));
    await expect(
      warmListingCard(makeDb(), 'lopoly.app', {
        visibility: 'public',
        imageMode: 'sns',
        ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('warmListingCardByRef (listingRef 読み直し版)', () => {
  it('doc を読み直して代表画像があれば warm する', async () => {
    const listingRef = {
      get: vi.fn(async () => ({
        data: () => ({ visibility: 'public', imageMode: 'sns', ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg' }),
      })),
    };
    await warmListingCardByRef(makeDb(), 'lopoly.app', listingRef);

    expect(listingRef.get).toHaveBeenCalledTimes(1);
    expect(ogMetaSet).toHaveBeenCalledTimes(1);
  });

  it('listingRef.get() が reject しても throw しない (commit 済み後に 500 を返さない)', async () => {
    const listingRef = { get: vi.fn(async () => { throw new Error('firestore read failed'); }) };
    await expect(
      warmListingCardByRef(makeDb(), 'lopoly.app', listingRef),
    ).resolves.toBeUndefined();
    expect(ogMetaSet).not.toHaveBeenCalled();
  });
});
