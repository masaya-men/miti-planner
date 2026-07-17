import { describe, it, expect } from 'vitest';
import { canonicalPostUrl } from '../canonicalPostUrl';

describe('canonicalPostUrl', () => {
  it('x.com の投稿 URL からクエリ/ハッシュを剥がす', () => {
    expect(canonicalPostUrl('https://x.com/someone/status/123?s=20&t=xxx')).toBe(
      'https://x.com/someone/status/123',
    );
  });

  it('twitter.com / www. 付きも同様に正規化する', () => {
    expect(canonicalPostUrl('https://twitter.com/someone/status/123?s=20')).toBe(
      'https://twitter.com/someone/status/123',
    );
    expect(canonicalPostUrl('https://www.twitter.com/someone/status/123?s=20')).toBe(
      'https://www.twitter.com/someone/status/123',
    );
    expect(canonicalPostUrl('https://mobile.twitter.com/someone/status/123#foo')).toBe(
      'https://mobile.twitter.com/someone/status/123',
    );
  });

  it('末尾スラッシュはそのまま維持する', () => {
    expect(canonicalPostUrl('https://x.com/someone/status/123/?s=20')).toBe(
      'https://x.com/someone/status/123/',
    );
  });

  it('X 以外のホストは変更しない', () => {
    const url = 'https://housingsnap.com/listing/1?ref=share';
    expect(canonicalPostUrl(url)).toBe(url);
  });

  it('不正な URL 文字列はそのまま返す', () => {
    expect(canonicalPostUrl('not a url')).toBe('not a url');
    expect(canonicalPostUrl('')).toBe('');
  });
});
