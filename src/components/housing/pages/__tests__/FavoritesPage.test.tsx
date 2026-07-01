// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { FavoritesPage } from '../FavoritesPage';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingTourStore } from '../../../../store/useHousingTourStore';
import type { MockListing } from '../../../../data/housing/mockListings';

const MANNER_DISMISSED_KEY = 'housing-manner-dismissed';

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
  beforeEach(() => {
    // ツアーストアをリセット
    useHousingTourStore.setState({ listingIds: [], running: false, currentIndex: 0 });
    // マナー通知を毎回クリア
    localStorage.removeItem(MANNER_DISMISSED_KEY);
  });

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

  it('トレイに2件→開始でtourStore.listingIdsに反映される(マナー通知dismiss済み)', () => {
    const listing1 = mk('tour-1', 1, 1);
    const listing2 = mk('tour-2', 1, 2);

    useHousingFavoritesStore.setState({ ids: ['tour-1', 'tour-2'] });
    useHousingListingsStore.setState({ status: 'ready', listings: [listing1, listing2] });

    // マナー通知を dismiss 済みにしてダイアログを挟まない
    localStorage.setItem(MANNER_DISMISSED_KEY, 'true');

    renderPage();

    // 全部追加ボタンで2件トレイへ
    fireEvent.click(screen.getByRole('button', { name: /すべてツアーに追加/ }));

    // 開始ボタンをクリック
    fireEvent.click(screen.getByRole('button', { name: /この内容でツアーを開始/ }));

    // tourStore に2件セットされている
    expect(useHousingTourStore.getState().listingIds).toHaveLength(2);
  });

  it('トレイに2件→開始でマナー通知が表示され、ダイアログの開始を押すとtourStoreに反映される', () => {
    const listing1 = mk('tour-3', 2, 1);
    const listing2 = mk('tour-4', 2, 2);

    useHousingFavoritesStore.setState({ ids: ['tour-3', 'tour-4'] });
    useHousingListingsStore.setState({ status: 'ready', listings: [listing1, listing2] });

    // マナー通知を未dismiss状態にする
    localStorage.removeItem(MANNER_DISMISSED_KEY);

    renderPage();

    // 全部追加で2件トレイへ
    fireEvent.click(screen.getByRole('button', { name: /すべてツアーに追加/ }));

    // 開始ボタンをクリック → マナーダイアログが開く
    fireEvent.click(screen.getByRole('button', { name: /この内容でツアーを開始/ }));

    // ダイアログの「はじめる」ボタンをクリック → commitStart
    fireEvent.click(screen.getByRole('button', { name: /はじめる/ }));

    // tourStore に2件セットされている
    expect(useHousingTourStore.getState().listingIds).toHaveLength(2);
  });
});
