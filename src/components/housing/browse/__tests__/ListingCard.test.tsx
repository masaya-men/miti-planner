// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { ListingCard } from '../ListingCard';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';

const mockListing = MOCK_LISTINGS[0];

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderCard(props: Partial<Parameters<typeof ListingCard>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ListingCard listing={mockListing} onAddToTour={() => {}} {...props} />
    </I18nextProvider>
  );
}

describe('ListingCard — selectable (選択UI)', () => {
  it('selectable未指定なら housing-card-select は描画されない', () => {
    renderCard();
    expect(screen.queryByTestId('housing-card-select')).not.toBeInTheDocument();
  });

  it('selectable=trueなら housing-card-select が描画される', () => {
    renderCard({ selectable: true, selected: false, onToggleSelect: vi.fn() });
    expect(screen.getByTestId('housing-card-select')).toBeInTheDocument();
  });

  it('選択チェックをクリックすると onToggleSelect が listing.id で呼ばれる', () => {
    const onToggle = vi.fn();
    renderCard({ selectable: true, selected: false, onToggleSelect: onToggle });
    fireEvent.click(screen.getByTestId('housing-card-select'));
    expect(onToggle).toHaveBeenCalledWith(mockListing.id);
  });

  it('selected=trueのとき is-selected クラスが付く', () => {
    renderCard({ selectable: true, selected: true, onToggleSelect: vi.fn() });
    expect(screen.getByTestId('housing-card-select')).toHaveClass('is-selected');
  });
});

describe('ListingCard — ♡と選択の独立性', () => {
  it('選択クリックが ♡(favorites)状態を変えない', () => {
    useHousingFavoritesStore.setState({ ids: [] });
    const onToggle = vi.fn();
    renderCard({ selectable: true, selected: false, onToggleSelect: onToggle });
    const before = useHousingFavoritesStore.getState().ids.slice();
    fireEvent.click(screen.getByTestId('housing-card-select'));
    expect(useHousingFavoritesStore.getState().ids).toEqual(before);
  });
});

describe('ListingCard — 非破壊回帰(selectable未指定)', () => {
  it('♡クリックでfavoritesにIDが追加される', () => {
    useHousingFavoritesStore.setState({ ids: [] });
    renderCard();
    // aria-label は翻訳済み（「お気に入り」）
    const favBtn = screen.getByRole('button', { name: 'お気に入り' });
    fireEvent.click(favBtn);
    expect(useHousingFavoritesStore.getState().ids).toContain(mockListing.id);
  });

  it('onAddToTour が listing.id で呼ばれる', () => {
    const onAddToTour = vi.fn();
    renderCard({ onAddToTour });
    // ツアー追加ボタンをクリック
    const addBtn = screen.getAllByRole('button').find(
      (btn) => btn.className.includes('housing-card-add-btn')
    );
    expect(addBtn).toBeTruthy();
    fireEvent.click(addBtn!);
    expect(onAddToTour).toHaveBeenCalledWith(mockListing.id);
  });
});
