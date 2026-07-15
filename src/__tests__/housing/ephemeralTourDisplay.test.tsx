// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';
import type { TourStep } from '../../lib/housing/tourNav';
import { HousingPlaybackProvider } from '../../lib/housing/HousingPlaybackContext';

/**
 * 「住所登録なし一時ツアー」Task4: トレイ行 + ショーケースの「一時」バッジ表示。
 * 登録済み listing (MOCK_LISTINGS) には出ず、一時 listing (ephemeral- prefix id) にだけ出ることを確認する。
 */

const registered = MOCK_LISTINGS[0];
const ephemeralListing = { ...MOCK_LISTINGS[1], id: 'ephemeral-1000-1', ownerUid: '__ephemeral__' };

// TourShowcasePanel が useNavigate() を使うため、ListingCard.test.tsx と同じ最小モックを踏襲する。
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

vi.mock('../../store/useHousingListingsStore', () => ({
  useHousingListingsStore: (sel: (s: unknown) => unknown) => sel({ listings: [registered], myListings: [] }),
}));
vi.mock('../../store/useEphemeralListingsStore', () => ({
  useEphemeralListingsStore: (sel: (s: unknown) => unknown) =>
    sel({ ephemeralListings: [ephemeralListing] }),
}));

import { TourTray } from '../../components/housing/browse/TourTray';
import { TourShowcasePanel } from '../../components/housing/tour/TourShowcasePanel';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList);
  }
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('一時 listing の「一時」バッジ表示 (TourTray)', () => {
  it('一時 listing の行にバッジが出る', () => {
    const { container } = wrap(
      <TourTray listingIds={[ephemeralListing.id]} onChange={() => {}} onStart={() => {}} onAdd={() => {}} />,
    );
    const item = container.querySelector('.housing-tour-tray-item')!;
    expect(item.querySelector('.housing-ephemeral-badge')).not.toBeNull();
    expect(item.querySelector('.housing-ephemeral-badge')!.textContent).toBe('一時');
  });

  it('登録済み listing の行にはバッジが出ない', () => {
    const { container } = wrap(
      <TourTray listingIds={[registered.id]} onChange={() => {}} onStart={() => {}} onAdd={() => {}} />,
    );
    const item = container.querySelector('.housing-tour-tray-item')!;
    expect(item.querySelector('.housing-ephemeral-badge')).toBeNull();
  });
});

describe('一時 listing の「一時」バッジ表示 (TourShowcasePanel)', () => {
  const renderPanel = (listing: typeof registered) => {
    const step: TourStep = { id: listing.id, listing };
    return wrap(
      <HousingPlaybackProvider>
        <TourShowcasePanel currentStep={step} nextStep={null} onOpenReport={() => {}} />
      </HousingPlaybackProvider>,
    );
  };

  it('一時 listing のとき、タイトル横にバッジが出る', () => {
    const { container } = renderPanel(ephemeralListing);
    expect(container.querySelector('.housing-tour-dest-title')).not.toBeNull();
    expect(container.querySelector('.housing-ephemeral-badge')).not.toBeNull();
    expect(container.querySelector('.housing-ephemeral-badge')!.textContent).toBe('一時');
  });

  it('登録済み listing のとき、バッジが出ない', () => {
    const { container } = renderPanel(registered);
    expect(container.querySelector('.housing-ephemeral-badge')).toBeNull();
  });
});
