import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syndicationUrl, checkTweetStatus } from '../../lib/housing/tweetSyndication';

const mockFetch = vi.spyOn(globalThis, 'fetch');

describe('syndicationUrl', () => {
  it('id と token を含む cdn.syndication URL を生成する', () => {
    const url = syndicationUrl('1842217368673759498');
    expect(url).toContain('https://cdn.syndication.twimg.com/tweet-result?id=1842217368673759498');
    expect(url).toContain('&token=');
  });
});

describe('checkTweetStatus', () => {
  beforeEach(() => mockFetch.mockReset());

  it('200 → alive', async () => {
    mockFetch.mockImplementation(async () => new Response('{}', { status: 200 }));
    expect(await checkTweetStatus('1234567890')).toBe('alive');
  });

  it('404 → gone', async () => {
    mockFetch.mockImplementation(async () => new Response('', { status: 404 }));
    expect(await checkTweetStatus('1234567890')).toBe('gone');
  });

  it('500 → error（消さない側に倒す）', async () => {
    mockFetch.mockImplementation(async () => new Response('', { status: 500 }));
    expect(await checkTweetStatus('1234567890')).toBe('error');
  });

  it('fetch 失敗 (壊れた応答) → error', async () => {
    // fetch が想定外の値 (undefined) を返すと res.status 参照で throw → catch で 'error'。
    // mock を reject させると vitest が unhandledRejection として拾うため、この形で catch 分岐を検証する。
    mockFetch.mockImplementation(async () => undefined as unknown as Response);
    expect(await checkTweetStatus('1234567890')).toBe('error');
  });
});
