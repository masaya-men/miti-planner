// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

vi.mock('../../../../lib/housingApiClient', () => ({
  deleteListingThumbnail: vi.fn(),
  reorderListingThumbnails: vi.fn(),
  uploadListingThumbnail: vi.fn(),
  deleteListingSourceImage: vi.fn(),
  reorderListingSourceImages: vi.fn(),
}));
const tweetState: any = { status: 'idle', data: null, errorCode: null, fetchTweet: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
vi.mock('../../../../lib/housing/useTweetFetch', () => ({ useTweetFetch: () => tweetState }));
const ogpState: any = { status: 'idle', data: null, errorCode: null, fetchOgp: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
vi.mock('../../../../lib/housing/useOgpFetch', () => ({ useOgpFetch: () => ogpState }));

import { HousingEditMediaSection } from '../HousingEditMediaSection';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderSection(overrides: Partial<React.ComponentProps<typeof HousingEditMediaSection>> = {}) {
  render(
    <I18nextProvider i18n={i18n}>
      <HousingEditMediaSection
        listingId="listing1"
        initialMode={overrides.initialMode ?? 'thumbnail'}
        thumbnailPaths={overrides.thumbnailPaths ?? ['a', 'b']}
        onThumbnailPathsChange={overrides.onThumbnailPathsChange ?? vi.fn()}
        sourceImageUrls={overrides.sourceImageUrls ?? []}
        onSourceImageUrlsChange={overrides.onSourceImageUrlsChange ?? vi.fn()}
        videoPreview={overrides.videoPreview ?? null}
        onCommitSnsFetch={overrides.onCommitSnsFetch ?? vi.fn().mockResolvedValue({ ok: true })}
      />
    </I18nextProvider>,
  );
}

describe('HousingEditMediaSection', () => {
  it('initialMode=thumbnail のとき直接アップロードパネルを表示する', () => {
    renderSection({ initialMode: 'thumbnail', thumbnailPaths: ['a'] });
    expect(screen.getByRole('tab', { name: 'アップロード' })).toHaveAttribute('aria-selected', 'true');
    // HousingEditImageGrid のタイル画像は alt="" (装飾扱い) のため role="img" にはならない。
    // 実際に画像タイルが描画されていることは alt="" のimg要素で確認する。
    expect(screen.getAllByAltText('').length).toBeGreaterThanOrEqual(1);
  });

  it('initialMode=sns のときURLパネルを表示する', () => {
    renderSection({ initialMode: 'sns', sourceImageUrls: ['x'] });
    expect(screen.getByRole('tab', { name: 'URL' })).toHaveAttribute('aria-selected', 'true');
  });

  it('タブをクリックすると表示パネルが切り替わる (API呼び出しなし)', () => {
    renderSection({ initialMode: 'thumbnail', thumbnailPaths: [] });
    fireEvent.click(screen.getByRole('tab', { name: 'URL' }));
    expect(screen.getByRole('tab', { name: 'URL' })).toHaveAttribute('aria-selected', 'true');
  });
});
