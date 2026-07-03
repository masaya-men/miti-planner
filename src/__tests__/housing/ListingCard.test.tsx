// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';
import type { MockListing } from '../../data/housing/mockListings';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { ListingCard } from '../../components/housing/browse/ListingCard';

const L = {
  id: 'x1', area: 'Mist', ward: 5, plot: 10, buildingType: 'house',
  size: 'M', imageMode: 'none', tags: ['fantasy', 'cafe'],
} as unknown as MockListing;

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

beforeEach(() => {
  useHousingFavoritesStore.setState({ ids: [] } as never);
  navigate.mockReset();
});

function renderCard(onAdd = () => {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ListingCard listing={L} onAddToTour={onAdd} />
    </I18nextProvider>,
  );
}

describe('ListingCard', () => {
  it('calls onAddToTour with listing id', () => {
    const onAdd = vi.fn();
    renderCard(onAdd);
    fireEvent.click(screen.getByRole('button', { name: /ツアーに追加|add_to_tour/ }));
    expect(onAdd).toHaveBeenCalledWith('x1');
  });

  it('adds then removes favorite on heart clicks', () => {
    renderCard();
    const heart = screen.getByRole('button', { name: /お気に入り|favorite/ });
    fireEvent.click(heart);
    expect(useHousingFavoritesStore.getState().ids).toContain('x1');
    fireEvent.click(heart);
    expect(useHousingFavoritesStore.getState().ids).not.toContain('x1');
  });
});
