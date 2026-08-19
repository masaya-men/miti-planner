import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseAllmarksShareUrl,
  isValidAllmarksShareId,
  fetchAllmarksShareUrls,
  resolveHousingAddressFromUrl,
} from '../allmarksImport';

describe('parseAllmarksShareUrl (2026-08-19 Allmarksまとめてインポート)', () => {
  it('https://allmarks.app/s/<6桁> から共有IDを取り出す', () => {
    expect(parseAllmarksShareUrl('https://allmarks.app/s/Ab3xY9')).toBe('Ab3xY9');
  });
  it('www. 付き・末尾にクエリ/フラグメントがあっても取り出す', () => {
    expect(parseAllmarksShareUrl('https://www.allmarks.app/s/Ab3xY9?foo=bar')).toBe('Ab3xY9');
    expect(parseAllmarksShareUrl('https://allmarks.app/s/Ab3xY9#frag')).toBe('Ab3xY9');
    expect(parseAllmarksShareUrl('https://allmarks.app/s/Ab3xY9/')).toBe('Ab3xY9');
  });
  it('Allmarks以外・6桁でないIDは null', () => {
    expect(parseAllmarksShareUrl('https://allmarks.app/s/short')).toBeNull();
    expect(parseAllmarksShareUrl('https://x.com/foo/status/123')).toBeNull();
    expect(parseAllmarksShareUrl('not a url')).toBeNull();
    expect(parseAllmarksShareUrl('')).toBeNull();
  });
});

describe('isValidAllmarksShareId', () => {
  it('英数字6桁のみ true', () => {
    expect(isValidAllmarksShareId('Ab3xY9')).toBe(true);
    expect(isValidAllmarksShareId('abcdef')).toBe(true);
    expect(isValidAllmarksShareId('12345')).toBe(false);
    expect(isValidAllmarksShareId('1234567')).toBe(false);
    expect(isValidAllmarksShareId('ab-xY9')).toBe(false);
  });
});

describe('fetchAllmarksShareUrls', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('成功時: urls 配列を返す', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ urls: ['https://x.com/a/status/1', 'https://x.com/b/status/2'] }),
    });
    const urls = await fetchAllmarksShareUrls('Ab3xY9');
    expect(urls).toEqual(['https://x.com/a/status/1', 'https://x.com/b/status/2']);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/housing?action=fetch-allmarks-share&shareId=Ab3xY9',
    );
  });

  it('不正なshareIdはfetchせず空配列', async () => {
    const urls = await fetchAllmarksShareUrls('short');
    expect(urls).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('レスポンス失敗 (404等) は空配列', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    const urls = await fetchAllmarksShareUrls('Ab3xY9');
    expect(urls).toEqual([]);
  });

  it('ネットワーク例外も空配列 (呼び出し側に漏らさない)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));
    const urls = await fetchAllmarksShareUrls('Ab3xY9');
    expect(urls).toEqual([]);
  });

  it('urls以外の型が混ざっていても文字列だけに絞る', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ urls: ['https://x.com/a/status/1', 123, null] }),
    });
    const urls = await fetchAllmarksShareUrls('Ab3xY9');
    expect(urls).toEqual(['https://x.com/a/status/1']);
  });
});

describe('resolveHousingAddressFromUrl', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('youtube URL: /api/youtube-meta を叩き概要欄を解釈する', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ description: 'ミスト 5区 12番地 S ハウス Elemental/Carbuncle' }),
    });
    const resolved = await resolveHousingAddressFromUrl('https://youtu.be/abc12345678');
    expect(resolved).not.toBeNull();
    expect(resolved?.result.area).toBe('Mist');
    expect(resolved?.result.ward).toBe(5);
    expect(resolved?.source?.postUrl).toBe('https://youtu.be/abc12345678');
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(call).toContain('/api/youtube-meta?videoId=');
  });

  it('tweet URL: /api/tweet-meta を叩き本文を解釈し画像をsourceへ積む', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        text: 'ラベンダーベッド 3区 20番地 M ハウス Elemental/Carbuncle',
        author: { name: 'a', screen_name: 'a' },
        photos: ['https://pbs.twimg.com/1.jpg'],
        video: null,
      }),
    });
    const resolved = await resolveHousingAddressFromUrl('https://x.com/someone/status/1234567890');
    expect(resolved).not.toBeNull();
    expect(resolved?.result.area).toBe('LavenderBeds');
    expect(resolved?.source?.ogImageUrl).toBe('https://pbs.twimg.com/1.jpg');
    expect(resolved?.source?.sourceImageUrls).toEqual(['https://pbs.twimg.com/1.jpg']);
  });

  it('OGP allowlist URL: /api/og-fetch を叩きページテキストを解釈する', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        image: 'https://housingsnap.com/img.jpg',
        images: [],
        title: 'ゴブレット 8区 40番地 L',
        description: null,
        siteName: 'housingsnap',
        text: null,
      }),
    });
    const resolved = await resolveHousingAddressFromUrl('https://housingsnap.com/listing/1');
    expect(resolved).not.toBeNull();
    expect(resolved?.result.area).toBe('Goblet');
    expect(resolved?.source?.ogImageUrl).toBe('https://housingsnap.com/img.jpg');
  });

  it('allowlist外・種別不明のURLは fetch せず null', async () => {
    const resolved = await resolveHousingAddressFromUrl('https://example.com/random-page');
    expect(resolved).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('空文字は null', async () => {
    const resolved = await resolveHousingAddressFromUrl('');
    expect(resolved).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetch失敗 (non-ok) は null (例外を投げない)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    const resolved = await resolveHousingAddressFromUrl('https://x.com/someone/status/1234567890');
    expect(resolved).toBeNull();
  });

  it('ネットワーク例外も null', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));
    const resolved = await resolveHousingAddressFromUrl('https://x.com/someone/status/1234567890');
    expect(resolved).toBeNull();
  });
});
