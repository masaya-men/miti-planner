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
