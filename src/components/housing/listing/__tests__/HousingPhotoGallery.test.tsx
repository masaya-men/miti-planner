// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { HousingPhotoGallery } from '../HousingPhotoGallery';
import type { HousingListing } from '../../../../types/housing';

// i18n はキー/デフォルト値をそのまま返す薄いモック
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k,
  }),
}));

function makeListing(over: Partial<HousingListing> = {}): HousingListing {
  return {
    id: 'l1',
    imageMode: 'sns',
    sourceImageUrls: [
      'https://x/a.jpg',
      'https://x/b.jpg',
      'https://x/c.jpg',
    ],
    ...over,
  } as unknown as HousingListing;
}

it('複数画像: すべてサムネイルに並び、 サムネクリックでメイン画像が入れ替わる', () => {
  const { container } = render(<HousingPhotoGallery listing={makeListing()} />);
  const mainSrc = () =>
    (container.querySelector('.housing-gallery-main') as HTMLImageElement | null)?.getAttribute('src');
  expect(mainSrc()).toContain('a.jpg');
  const tabs = screen.getAllByRole('tab');
  expect(tabs).toHaveLength(3);
  fireEvent.click(tabs[1]);
  expect(mainSrc()).toContain('b.jpg');
});

it('画像1枚: サムネイル列は出さない (rail なし)', () => {
  const { container } = render(
    <HousingPhotoGallery listing={makeListing({ sourceImageUrls: ['https://x/only.jpg'] })} />,
  );
  expect(
    (container.querySelector('.housing-gallery-main') as HTMLImageElement | null)?.getAttribute('src'),
  ).toContain('only.jpg');
  expect(container.querySelector('.housing-detail-thumbrail')).toBeNull();
});

it('画像なし: 空プレースホルダを出す', () => {
  const { container } = render(
    <HousingPhotoGallery listing={makeListing({ imageMode: 'none', sourceImageUrls: [] })} />,
  );
  expect(container.querySelector('.housing-gallery-empty')).not.toBeNull();
});

it('YouTube動画: loop/playlistを付けて再生終了後の関連動画オーバーレイで隠れないようにする', () => {
  const { container } = render(
    <HousingPhotoGallery listing={makeListing({ imageMode: 'none', sourceImageUrls: [], youtubeVideoId: 'abcdefghijk' })} />,
  );
  const src = container.querySelector('iframe')?.getAttribute('src') ?? '';
  expect(src).toContain('loop=1');
  expect(src).toContain('playlist=abcdefghijk');
});

it('メインステージ画像は 960/1440/原本1920 の srcSet + decoding=async', () => {
  const listing = makeListing({
    imageMode: 'thumbnail',
    thumbnailPaths: [
      'https://lopoly.app/housing-media/L1/a.webp',
      'https://lopoly.app/housing-media/L1/b.webp',
    ],
  });
  const { container } = render(<HousingPhotoGallery listing={listing} />);
  const main = container.querySelector('.housing-gallery-main') as HTMLImageElement;
  expect(main.getAttribute('srcset')).toContain('a-960.webp 960w');
  expect(main.getAttribute('srcset')).toContain('a-1440.webp 1440w');
  expect(main.getAttribute('srcset')).toContain('a.webp 1920w');
  expect(main.getAttribute('decoding')).toBe('async');
});

it('サムネ列の画像は 480w 実体 URL', () => {
  const listing = makeListing({
    imageMode: 'thumbnail',
    thumbnailPaths: [
      'https://lopoly.app/housing-media/L1/a.webp',
      'https://lopoly.app/housing-media/L1/b.webp',
    ],
  });
  const { container } = render(<HousingPhotoGallery listing={listing} />);
  const thumbs = Array.from(container.querySelectorAll('.housing-detail-thumb img')) as HTMLImageElement[];
  expect(thumbs[0].getAttribute('src')).toBe('https://lopoly.app/housing-media/L1/a-480.webp');
});

it('X 画像のメインステージは原本(?name= なし)、サムネは ?name=small', () => {
  const listing = makeListing({
    imageMode: 'sns',
    sourceImageUrls: ['https://pbs.twimg.com/media/A.jpg', 'https://pbs.twimg.com/media/B.jpg'],
  });
  const { container } = render(<HousingPhotoGallery listing={listing} />);
  const main = container.querySelector('.housing-gallery-main') as HTMLImageElement;
  expect(main.getAttribute('src')).toBe('https://pbs.twimg.com/media/A.jpg');
  const thumb = container.querySelector('.housing-detail-thumb img') as HTMLImageElement;
  expect(thumb.getAttribute('src')).toBe('https://pbs.twimg.com/media/A.jpg?name=small');
});
