// TourNavPage.*.test.tsx 共通の準備 (vi.mock は hoist されるため各テストファイルに直接書く)
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import type { MockListing } from '../../../../data/housing/mockListings';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { TourNavPage } from '../TourNavPage';

export function initTestI18n() {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
}

// Mist ward の実データに存在する plot (kind='plot') を使用 (TourNavMap.test.tsx と同じ plot 1/6/30)。
// 実データエリア literal は英語 'Mist' (mockListings.ts の gen() 参照)。 カタカナ 'ミスト' は
// isMistPlaceable === false になり地図ノードが0件になる罠があるため使わない。
export function mk(id: string, plot: number): MockListing {
  return {
    id,
    ownerUid: 'owner-1',
    dc: 'Elemental',
    server: 'Aegis',
    region: 'JP',
    area: 'Mist',
    ward: 12,
    buildingType: 'house',
    plot,
    size: 'M',
    imageMode: 'thumbnail',
    tags: [],
    description: '',
    title: id,
    createdAt: Date.now(),
    lastConfirmedAt: Date.now(),
    addressKey: `Elemental|Aegis|Mist|W12|H${plot}`,
  };
}

export const listing1 = mk('tour-nav-1', 1);
export const listing2 = mk('tour-nav-2', 6);
export const listing3 = mk('tour-nav-3', 30);
export const ids = [listing1.id, listing2.id, listing3.id];

export function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <TourNavPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

export function seedListings() {
  useHousingListingsStore.setState({
    status: 'ready',
    listings: [listing1, listing2, listing3],
    myListings: [],
  });
}
