import { describe, it, expect } from 'vitest';
import { parseTweetUrl } from '../../lib/housing/tweetUrlParse';

describe('parseTweetUrl', () => {
  it('extracts tweet id from x.com URL', () => {
    expect(parseTweetUrl('https://x.com/user/status/1842217368673759498')).toBe('1842217368673759498');
  });

  it('extracts tweet id from twitter.com URL', () => {
    expect(parseTweetUrl('https://twitter.com/user/status/1842217368673759498')).toBe('1842217368673759498');
  });

  it('handles query parameters (?s=20)', () => {
    expect(parseTweetUrl('https://x.com/user/status/1842217368673759498?s=20')).toBe('1842217368673759498');
  });

  it('handles long ref_url chains', () => {
    expect(
      parseTweetUrl(
        'https://x.com/men_masaya/status/1842217368673759498?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed&ref_url=https%3A%2F%2Fff14eden.work%2F',
      ),
    ).toBe('1842217368673759498');
  });

  it('returns null for non-tweet URL', () => {
    expect(parseTweetUrl('https://x.com/men_masaya')).toBeNull();
    expect(parseTweetUrl('https://example.com/status/123')).toBeNull();
    expect(parseTweetUrl('not a url')).toBeNull();
    expect(parseTweetUrl('')).toBeNull();
  });

  it('rejects malformed tweet id (non-numeric)', () => {
    expect(parseTweetUrl('https://x.com/user/status/abc')).toBeNull();
  });

  it('rejects tweet id longer than 20 digits', () => {
    expect(parseTweetUrl('https://x.com/user/status/123456789012345678901')).toBeNull();
  });
});
