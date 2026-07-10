// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { HousingCardVideoOverlay } from '../../components/housing/workspace/HousingCardVideoOverlay';

describe('HousingCardVideoOverlay', () => {
  beforeEach(() => {
    // 開発機の .env.local (VITE_MEDIA_PROXY_BASE_URL) に左右されないよう「未設定」を固定
    vi.stubEnv('VITE_MEDIA_PROXY_BASE_URL', '');
  });
  it('renders <video> with proxy src for Twitter listing', () => {
    const { container } = render(
      <HousingCardVideoOverlay
        kind="twitter"
        videoUrl="https://video.twimg.com/x.mp4"
        posterUrl="https://pbs.twimg.com/poster.jpg"
      />,
    );
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toContain(
      '/api/tweet-video?url=' + encodeURIComponent('https://video.twimg.com/x.mp4'),
    );
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
  });

  it('renders <iframe> with youtube-nocookie src for YouTube listing', () => {
    const { container } = render(
      <HousingCardVideoOverlay kind="youtube" youtubeVideoId="abcdefghijk" />,
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toContain(
      'https://www.youtube-nocookie.com/embed/abcdefghijk',
    );
    expect(iframe?.getAttribute('src')).toContain('autoplay=1');
    expect(iframe?.getAttribute('src')).toContain('mute=1');
    expect(iframe?.getAttribute('src')).toContain('controls=0');
  });
});
