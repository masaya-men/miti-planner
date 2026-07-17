// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { MockListing } from '../../data/housing/mockListings';
import { HousingPlaybackProvider } from '../../lib/housing/HousingPlaybackContext';
import { TourLivingMedia } from '../../components/housing/tour/TourLivingMedia';
import { __resetTweetVideoFramesForTests } from '../../lib/housing/useTweetVideoFrames';

// 実ネットワーク抽出 (video decode) を回避。 poster/id ごとに解決する Promise を保持し、
// テスト側で resolve タイミングを制御する (HousingShellPlayback.test.tsx と同様の shim 方針)。
const resolvers = new Map<string, (frames: readonly string[]) => void>();
vi.mock('../../lib/housing/extractVideoFrames', () => ({
  extractVideoFrames: vi.fn(
    ({ src }: { src: string }) =>
      new Promise<readonly string[]>((resolve) => {
        resolvers.set(src, resolve);
      }),
  ),
}));

beforeAll(() => {
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
      } as unknown as MediaQueryList);
  }
});

beforeEach(() => {
  resolvers.clear();
  __resetTweetVideoFramesForTests();
});

function makeListing(overrides: Partial<MockListing> & Pick<MockListing, 'id'>): MockListing {
  return {
    ownerUid: 'owner-1',
    imageMode: 'thumbnail',
    thumbnailPath: '/housing/mock-thumbs/1.svg',
    tags: [],
    createdAt: 0,
    lastConfirmedAt: 0,
    ...overrides,
  };
}

// 実機再現 (2026-07-17): 動画持ちの家 → 動画なしの家へツアーが進んだとき、
// 左パネルの ambient slideshow (画像) だけが前の家のフレームのまま固定される。
describe('TourLivingMedia — ツアーで listing が差し替わったときの ambient 画像', () => {
  it('動画持ちの家の後に動画なしの家へ進むと、前の家の抽出フレームが残らない', async () => {
    const videoListing = makeListing({
      id: 'video-house',
      videoUrl: 'https://video.twimg.com/video-house.mp4',
      videoPosterUrl: '/poster-video-house.jpg',
    });
    const plainListing = makeListing({
      id: 'plain-house',
      imageMode: 'thumbnail',
      thumbnailPath: '/housing/mock-thumbs/2.svg',
    });

    const { rerender, container } = render(
      <HousingPlaybackProvider>
        <TourLivingMedia listing={videoListing} />
      </HousingPlaybackProvider>,
    );

    // 動画抽出が完了し、 ambient slideshow に抽出フレームが乗るまで待つ。
    await waitFor(() => expect(resolvers.size).toBeGreaterThan(0));
    const resolve = [...resolvers.values()][0];
    resolve(['/frame-a.jpg', '/frame-b.jpg', '/frame-c.jpg']);
    await waitFor(() => {
      const overlayImgs = container.querySelectorAll('.housing-card-ambient-slideshow img');
      expect(overlayImgs.length).toBeGreaterThan(0);
    });

    // ツアーが次の家 (動画なし) へ進む — 同一コンポーネントインスタンスのまま listing prop だけ差し替わる
    rerender(
      <HousingPlaybackProvider>
        <TourLivingMedia listing={plainListing} />
      </HousingPlaybackProvider>,
    );

    await waitFor(() => {
      const overlaySrcs = [...container.querySelectorAll('.housing-card-ambient-slideshow img')].map(
        (img) => (img as HTMLImageElement).getAttribute('src'),
      );
      // 前の家 (video-house) の抽出フレームが混入してはいけない
      expect(overlaySrcs).not.toContain('/frame-a.jpg');
      expect(overlaySrcs).not.toContain('/frame-b.jpg');
      expect(overlaySrcs).not.toContain('/frame-c.jpg');
    });

    // 基底 <img> は常に現在の listing 自身の代表画像を指す
    const baseImg = container.querySelector('.housing-tour-living-media-img') as HTMLImageElement;
    expect(baseImg.getAttribute('src')).toBe('/housing/mock-thumbs/2.svg');
  });
});
