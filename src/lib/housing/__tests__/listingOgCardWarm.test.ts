import { describe, it, expect, vi } from 'vitest';
import { computeListingOgCardHash, warmListingOgCard } from '../listingOgCardWarm';

describe('computeListingOgCardHash', () => {
  it('16 hex を返す・同じ URL は同じ hash', () => {
    const h = computeListingOgCardHash('https://pbs.twimg.com/media/x.jpg');
    expect(h).toMatch(/^[a-f0-9]{16}$/);
    expect(computeListingOgCardHash('https://pbs.twimg.com/media/x.jpg')).toBe(h);
  });
});

describe('warmListingOgCard', () => {
  it('meta を書き warm-up fetch して hash を返す', async () => {
    const setMeta = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => ({ ok: true }) as Response);
    const hash = await warmListingOgCard({
      origin: 'https://lopoly.app',
      photoUrl: 'https://x.test/a.jpg',
      setMeta,
      fetchImpl,
    });

    expect(hash).toBe(computeListingOgCardHash('https://x.test/a.jpg'));
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
    expect(setMeta).toHaveBeenCalledTimes(1);
    expect(setMeta).toHaveBeenCalledWith(
      hash,
      expect.objectContaining({
        type: 'listing',
        imageUrl: 'https://x.test/a.jpg',
        createdAt: expect.any(Number),
        lastAccessedAt: expect.any(Number),
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(`https://lopoly.app/og/${hash}.png`, expect.anything());
  });

  it('photoUrl 空なら null・setMeta を呼ばない', async () => {
    const setMeta = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => ({ ok: true }) as Response);
    const hash = await warmListingOgCard({
      origin: 'https://lopoly.app',
      photoUrl: '',
      setMeta,
      fetchImpl,
    });

    expect(hash).toBeNull();
    expect(setMeta).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fetch が投げても hash は返す(warm 失敗は非致命)・setMeta は呼ばれる', async () => {
    const setMeta = vi.fn(async () => {});
    const fetchImpl = vi.fn(async () => {
      throw new Error('net');
    });
    const hash = await warmListingOgCard({
      origin: 'https://lopoly.app',
      photoUrl: 'https://x.test/a.jpg',
      setMeta,
      fetchImpl,
    });

    expect(hash).toMatch(/^[a-f0-9]{16}$/);
    expect(setMeta).toHaveBeenCalledTimes(1);
  });
});
