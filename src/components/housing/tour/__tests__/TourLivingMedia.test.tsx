// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';
import { TourLivingMedia } from '../TourLivingMedia';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

describe('TourLivingMedia', () => {
  it('画像とラッパーを描画し、複数画像で ambient slideshow が出る', () => {
    const multi = { ...MOCK_LISTINGS[0], imageMode: 'sns' as const, sourceImageUrls: ['https://x/a.jpg', 'https://x/b.jpg'] };
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <TourLivingMedia listing={multi} />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-tour-living-media')).not.toBeNull();
    expect(container.querySelector('.housing-tour-living-media-img')).not.toBeNull();
    expect(container.querySelector('.housing-card-ambient-slideshow')).not.toBeNull();
  });

  it('className を付与できる', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <TourLivingMedia listing={MOCK_LISTINGS[0]} className="is-next" />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-tour-living-media.is-next')).not.toBeNull();
  });
});
