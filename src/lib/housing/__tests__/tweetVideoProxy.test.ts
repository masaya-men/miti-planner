// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { buildTweetVideoProxyUrl } from '../tweetVideoProxy';

describe('buildTweetVideoProxyUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('既定では同一 origin の Vercel プロキシ path を返す', () => {
    // 開発機の .env.local (VITE_MEDIA_PROXY_BASE_URL) に左右されないよう「未設定」を固定
    vi.stubEnv('VITE_MEDIA_PROXY_BASE_URL', '');
    const url = buildTweetVideoProxyUrl('https://video.twimg.com/x.mp4');
    expect(url).toBe(
      '/api/tweet-video?url=' + encodeURIComponent('https://video.twimg.com/x.mp4'),
    );
  });

  it('VITE_MEDIA_PROXY_BASE_URL がセットされていればそれを base に使う (Worker 切替)', () => {
    vi.stubEnv('VITE_MEDIA_PROXY_BASE_URL', 'https://media.lopoly.app');
    const url = buildTweetVideoProxyUrl('https://video.twimg.com/x.mp4');
    expect(url).toBe(
      'https://media.lopoly.app?url=' + encodeURIComponent('https://video.twimg.com/x.mp4'),
    );
  });

  it('空文字の env は無視して既定にフォールバックする', () => {
    vi.stubEnv('VITE_MEDIA_PROXY_BASE_URL', '');
    const url = buildTweetVideoProxyUrl('https://video.twimg.com/x.mp4');
    expect(url).toBe(
      '/api/tweet-video?url=' + encodeURIComponent('https://video.twimg.com/x.mp4'),
    );
  });
});
