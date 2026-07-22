// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';

// showToast をスパイして、 リージョン跨ぎブロック時に呼ばれることを検証する (BrowsePage.test.tsx と同型)。
const showToastMock = vi.fn();
vi.mock('../../../Toast', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

// useIsMobile: BrowsePage.test.tsx と同じモック流儀 (既定 false・見出し行の追加ボタンは対象外)。
// 実機FB第2弾#3 で FavoritesPage が isMobile を参照するようになったため追加。
vi.mock('../../../../hooks/useIsMobile', () => ({ useIsMobile: vi.fn().mockReturnValue(false) }));

import { FavoritesPage } from '../FavoritesPage';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingTourStore } from '../../../../store/useHousingTourStore';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import { useHousingListOrderStore } from '../../../../store/useHousingListOrderStore';
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

// テスト基盤メモ: JP=Elemental/Aegis、 NA(別リージョン)=Aether/Gilgamesh (serverMasterData 実在値・BrowsePage.test.tsx と同型)。
function mkRegion(id: string, region: 'JP' | 'NA', dc: string, server: string, ward = 1, plot = 1): MockListing {
  return {
    id,
    dc,
    server,
    region,
    area: 'Mist',
    ward,
    plot,
    buildingType: 'house',
    title: id,
    tags: [],
    description: '',
    createdAt: Date.now(),
    sourceImageUrls: [],
    // addressKey を空にして重複自動追加を起こさない (mk と同じ理由)
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
    // ツアートレイストア(#5でページ横断保持に変更)を毎回クリア
    useTourTrayStore.setState({ trayIds: [] });
    showToastMock.mockClear();
    useHousingListOrderStore.getState().reset();
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

    const { container } = renderPage();

    // カードの選択ボタン (housing-card-select) を2件クリック
    const selectBtns = screen.getAllByTestId('housing-card-select');
    fireEvent.click(selectBtns[0]);
    fireEvent.click(selectBtns[1]);

    // 「選択だけ追加」ボタンをクリック
    fireEvent.click(screen.getByRole('button', { name: /選択だけ/ }));

    // 右トレイに2件のアイテムが表示される
    // (左オンボの <ol> も listitem を持つため、トレイのリストにスコープして数える)
    const trayList = container.querySelector('.housing-tour-tray-list');
    expect(trayList).not.toBeNull();
    const trayItems = within(trayList as HTMLElement).getAllByRole('listitem');
    expect(trayItems).toHaveLength(2);
  });

  it('開始ボタンだけではまだ確定せず、マナーダイアログが挟まる(#4)', () => {
    const listing1 = mk('tour-1', 1, 1);
    const listing2 = mk('tour-2', 1, 2);

    useHousingFavoritesStore.setState({ ids: ['tour-1', 'tour-2'] });
    useHousingListingsStore.setState({ status: 'ready', listings: [listing1, listing2] });

    renderPage();

    // 全部追加ボタンで2件トレイへ
    fireEvent.click(screen.getByRole('button', { name: /すべてツアーに追加/ }));

    // 開始ボタン → マナーダイアログが開くだけで、まだ tourStore は変化しない(毎回確認・#4)
    fireEvent.click(screen.getByRole('button', { name: /この内容でツアーを開始/ }));
    expect(screen.getByRole('button', { name: /はじめる/ })).toBeInTheDocument();
    expect(useHousingTourStore.getState().listingIds).toHaveLength(0);
  });

  it('トレイに2件→開始でマナー通知が表示され、ダイアログの開始を押すとtourStoreに反映される', () => {
    const listing1 = mk('tour-3', 2, 1);
    const listing2 = mk('tour-4', 2, 2);

    useHousingFavoritesStore.setState({ ids: ['tour-3', 'tour-4'] });
    useHousingListingsStore.setState({ status: 'ready', listings: [listing1, listing2] });

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

  it('お気に入りにJP+NAが混在: JP追加→NA追加は弾かれ、トレイは増えずshowToastがerrorで呼ばれる', () => {
    const jp = mkRegion('jp-1', 'JP', 'Elemental', 'Aegis');
    const na = mkRegion('na-1', 'NA', 'Aether', 'Gilgamesh');

    useHousingFavoritesStore.setState({ ids: ['jp-1', 'na-1'] });
    useHousingListingsStore.setState({ status: 'ready', listings: [jp, na] });

    const { container } = renderPage();

    // カードごとに aria-label (= title = id) でスコープする。
    // 「すべてツアーに追加」で同時追加すると1件目時点でトレイが空 (trayRegion=null) のため
    // どちらを先に処理するかで結果が変わってしまう。個別クリックで「JPが先に追加済み」を固定する。
    const jpCard = screen.getByRole('link', { name: 'jp-1' });
    const naCard = screen.getByRole('link', { name: 'na-1' });
    fireEvent.click(within(jpCard).getByRole('button', { name: 'ツアーに追加' }));
    fireEvent.click(within(naCard).getByRole('button', { name: 'ツアーに追加' }));

    const trayList = container.querySelector('.housing-tour-tray-list');
    expect(trayList).not.toBeNull();
    const trayItems = within(trayList as HTMLElement).getAllByRole('listitem');
    expect(trayItems).toHaveLength(1);

    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('トレイ確定後にlistingのregionが変わり混在した場合、開始時ネットで阻止されtourStoreは変化しない', () => {
    // addToTray の追加時ブロックは「trayに積む瞬間」のregionしか見ないため、
    // 積んだ後にlisting側のregionが変わるケース(実データ編集/同期などを想定)は
    // 開始時ネット(commitStart内のtourRegionConflict)だけが最後の砦になる。
    const jp1 = mkRegion('net-1', 'JP', 'Elemental', 'Aegis', 1, 1);
    const jp2 = mkRegion('net-2', 'JP', 'Elemental', 'Aegis', 2, 2);

    useHousingFavoritesStore.setState({ ids: ['net-1', 'net-2'] });
    useHousingListingsStore.setState({ status: 'ready', listings: [jp1, jp2] });

    renderPage();

    // 追加時点では両方JPなのでブロックされず2件トレイへ
    fireEvent.click(screen.getByRole('button', { name: /すべてツアーに追加/ }));

    // トレイ確定後、net-2 の region が NA に変わる
    act(() => {
      useHousingListingsStore.setState({
        status: 'ready',
        listings: [jp1, { ...jp2, region: 'NA' }],
      });
    });

    // 開始 → マナーダイアログの「はじめる」で commitStart → 開始時ネットで弾かれる
    fireEvent.click(screen.getByRole('button', { name: /この内容でツアーを開始/ }));
    fireEvent.click(screen.getByRole('button', { name: /はじめる/ }));

    expect(useHousingTourStore.getState().listingIds).toHaveLength(0);
    expect(useHousingTourStore.getState().running).toBe(false);
    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
