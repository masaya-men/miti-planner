import { describe, it, expect } from 'vitest';
import {
  parseYoutubeUrl,
  buildYoutubeThumbnailUrl,
  buildYoutubeThumbnailUrlFallback,
  buildYoutubeThumbnailUrlByQuality,
  parseYoutubeThumbnailUrl,
  nextYoutubeThumbnailFallback,
  buildYoutubeWatchUrl,
} from '../youtubeUrl';

describe('parseYoutubeUrl', () => {
  it('watch?v= 形式から videoId を抽出する', () => {
    expect(parseYoutubeUrl('https://www.youtube.com/watch?v=Ypg8w7Dmq9o')).toBe('Ypg8w7Dmq9o');
  });

  it('watch?v= + &t= 等の追加クエリも許容', () => {
    expect(parseYoutubeUrl('https://www.youtube.com/watch?v=Ypg8w7Dmq9o&t=42s')).toBe(
      'Ypg8w7Dmq9o',
    );
  });

  it('youtu.be 短縮形式から videoId を抽出する', () => {
    expect(parseYoutubeUrl('https://youtu.be/Ypg8w7Dmq9o')).toBe('Ypg8w7Dmq9o');
  });

  it('embed 形式から videoId を抽出する', () => {
    expect(parseYoutubeUrl('https://www.youtube.com/embed/Ypg8w7Dmq9o')).toBe('Ypg8w7Dmq9o');
  });

  it('shorts 形式から videoId を抽出する', () => {
    expect(parseYoutubeUrl('https://www.youtube.com/shorts/Ypg8w7Dmq9o')).toBe('Ypg8w7Dmq9o');
  });

  it('mobile (m.youtube.com) 形式から videoId を抽出する', () => {
    expect(parseYoutubeUrl('https://m.youtube.com/watch?v=Ypg8w7Dmq9o')).toBe('Ypg8w7Dmq9o');
  });

  it('Twitter URL 内の "youtube" 文字列に誤マッチしない', () => {
    expect(parseYoutubeUrl('https://twitter.com/user/status/123?text=youtube')).toBeNull();
  });

  it('videoId の桁数が違うものは null', () => {
    expect(parseYoutubeUrl('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseYoutubeUrl('https://www.youtube.com/watch?v=Ypg8w7Dmq9oTOOLONG')).toBeNull();
  });

  it('非 string 入力は null', () => {
    expect(parseYoutubeUrl(null as unknown as string)).toBeNull();
    expect(parseYoutubeUrl(undefined as unknown as string)).toBeNull();
  });
});

describe('buildYoutubeThumbnailUrl', () => {
  it('maxresdefault を返す', () => {
    expect(buildYoutubeThumbnailUrl('Ypg8w7Dmq9o')).toBe(
      'https://img.youtube.com/vi/Ypg8w7Dmq9o/maxresdefault.jpg',
    );
  });
});

describe('buildYoutubeThumbnailUrlFallback', () => {
  it('hqdefault を返す', () => {
    expect(buildYoutubeThumbnailUrlFallback('Ypg8w7Dmq9o')).toBe(
      'https://img.youtube.com/vi/Ypg8w7Dmq9o/hqdefault.jpg',
    );
  });
});

describe('buildYoutubeThumbnailUrlByQuality', () => {
  it.each([
    ['maxresdefault', 'https://img.youtube.com/vi/Ypg8w7Dmq9o/maxresdefault.jpg'],
    ['hqdefault', 'https://img.youtube.com/vi/Ypg8w7Dmq9o/hqdefault.jpg'],
    ['mqdefault', 'https://img.youtube.com/vi/Ypg8w7Dmq9o/mqdefault.jpg'],
    ['default', 'https://img.youtube.com/vi/Ypg8w7Dmq9o/default.jpg'],
  ] as const)('quality=%s で正しい URL を組み立てる', (quality, expected) => {
    expect(buildYoutubeThumbnailUrlByQuality('Ypg8w7Dmq9o', quality)).toBe(expected);
  });
});

describe('parseYoutubeThumbnailUrl', () => {
  it('img.youtube.com の maxresdefault を解析できる', () => {
    expect(
      parseYoutubeThumbnailUrl('https://img.youtube.com/vi/Ypg8w7Dmq9o/maxresdefault.jpg'),
    ).toEqual({ videoId: 'Ypg8w7Dmq9o', quality: 'maxresdefault' });
  });

  it('hqdefault / mqdefault / default も解析できる', () => {
    expect(
      parseYoutubeThumbnailUrl('https://img.youtube.com/vi/Ypg8w7Dmq9o/hqdefault.jpg'),
    ).toEqual({ videoId: 'Ypg8w7Dmq9o', quality: 'hqdefault' });
    expect(
      parseYoutubeThumbnailUrl('https://img.youtube.com/vi/Ypg8w7Dmq9o/mqdefault.jpg'),
    ).toEqual({ videoId: 'Ypg8w7Dmq9o', quality: 'mqdefault' });
    expect(
      parseYoutubeThumbnailUrl('https://img.youtube.com/vi/Ypg8w7Dmq9o/default.jpg'),
    ).toEqual({ videoId: 'Ypg8w7Dmq9o', quality: 'default' });
  });

  it('i.ytimg.com / vi_webp も解析できる', () => {
    expect(
      parseYoutubeThumbnailUrl('https://i.ytimg.com/vi/Ypg8w7Dmq9o/hqdefault.jpg'),
    ).toEqual({ videoId: 'Ypg8w7Dmq9o', quality: 'hqdefault' });
    expect(
      parseYoutubeThumbnailUrl('https://i.ytimg.com/vi_webp/Ypg8w7Dmq9o/maxresdefault.webp'),
    ).toEqual({ videoId: 'Ypg8w7Dmq9o', quality: 'maxresdefault' });
  });

  it('YouTube サムネ以外の URL は null', () => {
    expect(parseYoutubeThumbnailUrl('https://example.com/image.jpg')).toBeNull();
    expect(parseYoutubeThumbnailUrl('https://img.youtube.com/vi/abc/foo.jpg')).toBeNull();
  });

  it('videoId 桁数違いは null', () => {
    expect(
      parseYoutubeThumbnailUrl('https://img.youtube.com/vi/short/maxresdefault.jpg'),
    ).toBeNull();
  });

  it('非 string は null', () => {
    expect(parseYoutubeThumbnailUrl(null as unknown as string)).toBeNull();
  });
});

describe('nextYoutubeThumbnailFallback', () => {
  it('maxresdefault → hqdefault', () => {
    expect(
      nextYoutubeThumbnailFallback('https://img.youtube.com/vi/Ypg8w7Dmq9o/maxresdefault.jpg'),
    ).toBe('https://img.youtube.com/vi/Ypg8w7Dmq9o/hqdefault.jpg');
  });

  it('hqdefault → mqdefault', () => {
    expect(
      nextYoutubeThumbnailFallback('https://img.youtube.com/vi/Ypg8w7Dmq9o/hqdefault.jpg'),
    ).toBe('https://img.youtube.com/vi/Ypg8w7Dmq9o/mqdefault.jpg');
  });

  it('mqdefault → default', () => {
    expect(
      nextYoutubeThumbnailFallback('https://img.youtube.com/vi/Ypg8w7Dmq9o/mqdefault.jpg'),
    ).toBe('https://img.youtube.com/vi/Ypg8w7Dmq9o/default.jpg');
  });

  it('default はもう次が無い (null)', () => {
    expect(
      nextYoutubeThumbnailFallback('https://img.youtube.com/vi/Ypg8w7Dmq9o/default.jpg'),
    ).toBeNull();
  });

  it('YouTube サムネ以外なら null (関与しない)', () => {
    expect(nextYoutubeThumbnailFallback('https://example.com/image.jpg')).toBeNull();
    expect(nextYoutubeThumbnailFallback('')).toBeNull();
  });
});

describe('buildYoutubeWatchUrl', () => {
  it('canonical watch URL を組み立てる', () => {
    expect(buildYoutubeWatchUrl('Ypg8w7Dmq9o')).toBe(
      'https://www.youtube.com/watch?v=Ypg8w7Dmq9o',
    );
  });
});
