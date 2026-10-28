/**
 * HousingerPage.*.test.tsx 共通の準備 (テストデータ・描画関数・環境の用意)。
 * vi.mock は hoist されるため各テストファイルに直接書く。
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { HousingerPage } from '../../components/housing/pages/HousingerPage';
import type { HousingerProfile, HousingListing } from '../../types/housing';

export const publishedProfile: HousingerProfile = {
  displayName: 'たかし',
  displayNameLower: 'たかし',
  avatarUrl: null,
  bio: 'S字改築が好きです',
  snsUrl: null,
  isPublished: true,
  isModerationHidden: false,
  reportCount: 0,
  createdAt: 1,
  updatedAt: 1,
};

export function rawListing(id: string, ownerUid: string): HousingListing {
  return {
    id,
    ownerUid,
    dc: 'Elemental',
    server: 'Carbuncle',
    area: 'Mist',
    ward: 1,
    buildingType: 'house',
    plot: 3,
    size: 'M',
    addressKey: `Elemental-Carbuncle-Mist-1-3`,
    imageMode: 'none',
    tags: [],
    visibility: 'public',
    createdAt: 100,
    lastConfirmedAt: 100,
  } as unknown as HousingListing;
}

export function setupHousingerPageEnv() {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja',
      fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
  if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList);
  }
}

export function renderPage(uid: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[`/housing/housinger/${uid}`]}>
        <Routes>
          <Route path="/housing/housinger/:uid" element={<HousingerPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

export function renderMyPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/housing/mypage']}>
        <Routes>
          <Route path="/housing/mypage" element={<HousingerPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}
