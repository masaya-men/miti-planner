// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { FavoritesPage } from '../FavoritesPage';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import type { MockListing } from '../../../../data/housing/mockListings';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function mk(id: string, ward = 1, plot = 1): MockListing {
  return {
    id,
    dc: 'Mana',
    server: 'マンダヴィル',
    area: 'ミスト',
    ward,
    plot,
    buildingType: 'house',
    title: id,
    tags: [],
    description: '',
    createdAt: Date.now(),
    sourceImageUrls: [],
    // addressKey を空にして重複自動追加を起こさない (2→2 の単純テスト)
    addressKey: '',
  } as unknown as MockListing;
}

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <FavoritesPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('FavoritesPage', () => {
  it('お気に入りが空なら空状態を表示', () => {
    useHousingFavoritesStore.setState({ ids: [] });
    renderPage();
    expect(screen.getByTestId('housing-favorites-empty')).toBeInTheDocument();
  });

  it('お気に入りが1件以上あれば空状態を非表示', () => {
    useHousingFavoritesStore.setState({ ids: ['listing-1'] });
    renderPage();
    expect(screen.queryByTestId('housing-favorites-empty')).not.toBeInTheDocument();
  });

  it('2件選択→「選択だけ追加」でトレイに2件反映される', () => {
    const listing1 = mk('fav-1', 1, 1);
    const listing2 = mk('fav-2', 1, 2);
    const listing3 = mk('fav-3', 2, 1);

    useHousingFavoritesStore.setState({ ids: ['fav-1', 'fav-2', 'fav-3'] });
    useHousingListingsStore.setState({ status: 'ready', listings: [listing1, listing2, listing3] });

    renderPage();

    // カードの選択ボタン (housing-card-select) を2件クリック
    const selectBtns = screen.getAllByTestId('housing-card-select');
    fireEvent.click(selectBtns[0]);
    fireEvent.click(selectBtns[1]);

    // 「選択だけ追加」ボタンをクリック
    fireEvent.click(screen.getByRole('button', { name: /選択だけ/ }));

    // 右トレイに2件のアイテムが表示される
    const trayItems = screen.getAllByRole('listitem');
    expect(trayItems).toHaveLength(2);
  });
});
