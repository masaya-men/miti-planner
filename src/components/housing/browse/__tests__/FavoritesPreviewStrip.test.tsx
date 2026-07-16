// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';

import { vi } from 'vitest';
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

// 探す/お気に入りページと同じ合流プールを使うための最小モック (未ログイン=uid null で固定)。
vi.mock('../../../../store/useAuthStore', () => ({
  useAuthStore: Object.assign(
    (sel: (s: { user: { uid: string } | null }) => unknown) => sel({ user: null }),
    { setState: vi.fn(), getState: vi.fn() },
  ),
}));

import { FavoritesPreviewStrip } from '../FavoritesPreviewStrip';

const listing = { ...MOCK_LISTINGS[0], imageMode: 'sns' as const, sourceImageUrls: ['https://x/a.jpg', 'https://x/b.jpg'] };
const listing2 = { ...MOCK_LISTINGS[1], imageMode: 'sns' as const, sourceImageUrls: ['https://x/c.jpg'] };

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList);
  }
});

beforeEach(() => {
  useHousingListingsStore.setState({ listings: [listing] });
  useHousingFavoritesStore.setState({ ids: [listing.id] });
});

describe('FavoritesPreviewStrip — 生きたカード (画像のみ)', () => {
  it('Provider 配下で各サムネに ambient スライドショーが出る', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <FavoritesPreviewStrip />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    const thumb = container.querySelector('.housing-fav-strip-thumb');
    expect(thumb?.querySelector('.housing-card-ambient-slideshow')).not.toBeNull();
  });
});

describe('FavoritesPreviewStrip — 件数バッジ (解決できた物件のみを数える)', () => {
  it('解決できない id と重複 id を除いたユニーク件数を表示する', () => {
    useHousingListingsStore.setState({ listings: [listing, listing2] });
    useHousingFavoritesStore.setState({
      // listing を2回 (重複) + 存在しない id (削除済み等) を混ぜる。
      ids: [listing.id, listing2.id, listing.id, 'deleted-listing-id'],
    });

    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <FavoritesPreviewStrip />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );

    // 解決できたユニーク件数は listing / listing2 の2件のみ。
    expect(container.querySelector('.housing-fav-strip-count')?.textContent).toBe('2');
    expect(container.querySelectorAll('.housing-fav-strip-thumb')).toHaveLength(2);
  });
});
