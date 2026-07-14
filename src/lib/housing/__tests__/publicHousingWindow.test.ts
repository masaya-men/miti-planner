import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchPublicGallery,
  fetchPublicHousinger,
  fetchPublicListingPeers,
} from '../publicHousingWindow';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonOnce(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

describe('fetchPublicGallery', () => {
  it('version → gallery?v=N の順で叩き listings を返す', async () => {
    jsonOnce({ version: 7 });               // action=version
    jsonOnce({ listings: [{ id: 'a' }] });  // action=gallery&v=7
    const r = await fetchPublicGallery();
    expect(r).toEqual([{ id: 'a' }]);
    expect(fetchMock.mock.calls[0][0]).toContain('action=version');
    expect(fetchMock.mock.calls[1][0]).toContain('action=gallery');
    expect(fetchMock.mock.calls[1][0]).toContain('v=7');
  });

  it('version fetch 失敗でも v=0 で gallery を叩く (縮退)', async () => {
    jsonOnce({}, false, 500);               // version 失敗
    jsonOnce({ listings: [] });             // gallery&v=0
    const r = await fetchPublicGallery();
    expect(r).toEqual([]);
    expect(fetchMock.mock.calls[1][0]).toContain('v=0');
  });
});

describe('fetchPublicHousinger', () => {
  it('uid を渡して listings を返す', async () => {
    jsonOnce({ version: 3 });
    jsonOnce({ listings: [{ id: 'h' }] });
    const r = await fetchPublicHousinger('uid-1');
    expect(r).toEqual([{ id: 'h' }]);
    expect(fetchMock.mock.calls[1][0]).toContain('action=housinger');
    expect(fetchMock.mock.calls[1][0]).toContain('uid=uid-1');
  });
});

describe('fetchPublicListingPeers', () => {
  it('listing 窓口の peers を返す', async () => {
    jsonOnce({ version: 1 });
    jsonOnce({ listing: { id: 'x' }, peers: [{ id: 'p1' }] });
    const r = await fetchPublicListingPeers('x');
    expect(r).toEqual([{ id: 'p1' }]);
    expect(fetchMock.mock.calls[1][0]).toContain('action=listing');
    expect(fetchMock.mock.calls[1][0]).toContain('id=x');
  });

  it('404 / エラーは空配列に丸める (peers はあくまで補助)', async () => {
    jsonOnce({ version: 1 });
    jsonOnce({ error: 'not_found' }, false, 404);
    const r = await fetchPublicListingPeers('gone');
    expect(r).toEqual([]);
  });
});
