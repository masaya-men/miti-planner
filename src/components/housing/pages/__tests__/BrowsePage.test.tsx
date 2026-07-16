// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

// showToast をスパイして、 リージョン跨ぎブロック時に呼ばれることを検証する (計画 Task3 Step5)。
const showToastMock = vi.fn();
vi.mock('../../../Toast', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

// useIsMobile: SpreadsheetGridImportModal.test.tsx と同じモック流儀 (既定 false、個別 describe で true に上書き)。
vi.mock('../../../../hooks/useIsMobile', () => ({ useIsMobile: vi.fn().mockReturnValue(false) }));

import { BrowsePage } from '../BrowsePage';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingFilterStore } from '../../../../store/useHousingFilterStore';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { useEphemeralListingsStore } from '../../../../store/useEphemeralListingsStore';
import { useHousingTourStore } from '../../../../store/useHousingTourStore';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import type { MockListing } from '../../../../data/housing/mockListings';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

// テスト基盤メモ: JP=Elemental/Aegis、 NA(別リージョン)=Aether/Gilgamesh (serverMasterData 実在値)。
function mk(id: string, region: 'JP' | 'NA', dc: string, server: string): MockListing {
  return {
    id,
    ownerUid: 'owner-x',
    dc,
    server,
    region,
    area: 'Mist',
    ward: 1,
    buildingType: 'house',
    plot: 1,
    imageMode: 'none',
    tags: [],
    title: id,
    createdAt: Date.now(),
    lastConfirmedAt: Date.now(),
    addressKey: `${dc}-${server}-Mist-1-1`,
  } as MockListing;
}

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <BrowsePage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('BrowsePage: リージョン跨ぎの追加時ブロック', () => {
  beforeEach(() => {
    useHousingFilterStore.getState().clearAll();
    useHousingViewStore.getState().reset();
    useHousingFavoritesStore.setState({ ids: [] });
    useEphemeralListingsStore.getState().clear();
    useHousingTourStore.setState({ listingIds: [], running: false, currentIndex: 0 });
    useTourTrayStore.setState({ trayIds: [] });
    showToastMock.mockClear();
  });

  it('別リージョンの家をツアーに追加しようとすると弾かれ、トーストが出る', () => {
    const jp = mk('jp-1', 'JP', 'Elemental', 'Aegis');
    const na = mk('na-1', 'NA', 'Aether', 'Gilgamesh');
    useHousingListingsStore.setState({ status: 'ready', listings: [jp, na], myListings: [] } as never);

    renderPage();

    const addButtons = screen.getAllByRole('button', { name: 'ツアーに追加' });
    expect(addButtons).toHaveLength(2);

    // 1件目 (JP) は通常どおり追加できる。
    fireEvent.click(addButtons[0]);
    // 2件目 (NA・別リージョン) は弾かれる。
    fireEvent.click(addButtons[1]);

    const trayList = document.querySelector('.housing-tour-tray-list');
    expect(trayList).not.toBeNull();
    const trayItems = within(trayList as HTMLElement).getAllByRole('listitem');
    expect(trayItems).toHaveLength(1);

    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('同リージョンの家は両方ともトレイに追加される (回帰なし)', () => {
    const jp1 = mk('jp-1', 'JP', 'Elemental', 'Aegis');
    const jp2 = mk('jp-2', 'JP', 'Gaia', 'Ifrit');
    useHousingListingsStore.setState({ status: 'ready', listings: [jp1, jp2], myListings: [] } as never);

    renderPage();

    const addButtons = screen.getAllByRole('button', { name: 'ツアーに追加' });
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[1]);

    const trayList = document.querySelector('.housing-tour-tray-list');
    const trayItems = within(trayList as HTMLElement).getAllByRole('listitem');
    expect(trayItems).toHaveLength(2);
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('トレイ確定後にlistingのregionが変わり混在した場合、開始時ネットで阻止されtourStoreは変化しない', () => {
    // addToTray の追加時ブロックは「trayに積む瞬間」のregionしか見ないため、
    // 積んだ後にlisting側のregionが変わるケース(実データ編集/同期などを想定)は
    // 開始時ネット(onStart内のtourRegionConflict)だけが最後の砦になる。
    const jp1 = mk('net-1', 'JP', 'Elemental', 'Aegis');
    const jp2 = mk('net-2', 'JP', 'Gaia', 'Ifrit');
    useHousingListingsStore.setState({ status: 'ready', listings: [jp1, jp2], myListings: [] } as never);

    renderPage();

    const addButtons = screen.getAllByRole('button', { name: 'ツアーに追加' });
    // 追加時点では両方JPなのでブロックされず2件トレイへ
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[1]);

    const trayList = document.querySelector('.housing-tour-tray-list');
    expect(within(trayList as HTMLElement).getAllByRole('listitem')).toHaveLength(2);

    // トレイ確定後、net-2 の region が NA に変わる
    act(() => {
      useHousingListingsStore.setState({
        status: 'ready',
        listings: [jp1, { ...jp2, region: 'NA' }],
        myListings: [],
      } as never);
    });

    fireEvent.click(screen.getByRole('button', { name: 'この内容でツアーを開始' }));
    // #4: 開始はマナーダイアログを挟む。「はじめる」で commitStart → 開始時ネットが弾く。
    fireEvent.click(screen.getByRole('button', { name: /はじめる/ }));

    expect(useHousingTourStore.getState().listingIds).toHaveLength(0);
    expect(useHousingTourStore.getState().running).toBe(false);
    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});

// C-2 (f): BrowseViewToggle の横の「フィルター解除」ボタン。
// 文言 (housing.browse.clear_filter) は統合担当が locale に追加するまで未確定のため、
// アクセシブルネームではなく新規クラス (.housing-browse-clear-filter) で対象を特定する。
describe('BrowsePage: 中央フィルター解除ボタン (f)', () => {
  beforeEach(() => {
    useHousingFilterStore.getState().clearAll();
    useHousingViewStore.getState().reset();
    useHousingListingsStore.setState({ status: 'ready', listings: [], myListings: [] } as never);
  });

  it('絞り込み無しでは中央のフィルター解除ボタンは出ない', () => {
    renderPage();
    expect(document.querySelector('.housing-browse-clear-filter')).toBeNull();
  });

  it('絞り込み中 (エリア選択) は中央にフィルター解除ボタンが出る', () => {
    useHousingFilterStore.getState().toggleArea('Mist');
    renderPage();
    expect(document.querySelector('.housing-browse-clear-filter')).not.toBeNull();
  });

  it('中央のフィルター解除ボタンをクリックすると clearAll される (絞り込みが全解除)', () => {
    useHousingFilterStore.getState().toggleArea('Mist');
    useHousingFilterStore.getState().toggleSize('M');
    renderPage();

    const clearBtn = document.querySelector('.housing-browse-clear-filter');
    expect(clearBtn).not.toBeNull();
    fireEvent.click(clearBtn as HTMLElement);

    const state = useHousingFilterStore.getState();
    expect(state.areas).toEqual([]);
    expect(state.sizes).toEqual([]);
    expect(state.dc).toBeNull();
  });
});

// Task2 (スマホ2列グリッド + マップ非表示): browseView='map' でもスマホでは
// 一覧 (effectiveView='list') を強制し、 BrowseMapView (WorldSelectGate 等) をマウントさせない。
describe('BrowsePage: スマホでは地図を強制的に一覧表示にする', () => {
  beforeEach(() => {
    useHousingFilterStore.getState().clearAll();
    useHousingViewStore.getState().reset();
    useHousingListingsStore.setState({ status: 'ready', listings: [], myListings: [] } as never);
    // PC側で選択済みの 'map' を保ったまま、 スマホでは一覧強制になることを検証する。
    useHousingViewStore.getState().setBrowseView('map');
    vi.mocked(useIsMobile).mockReturnValue(true);
  });

  afterEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  it('browseView が map でもスマホでは地図 (housing-browse-map-view) をマウントしない (EmptyResult=一覧側の分岐になる)', () => {
    renderPage();
    expect(document.querySelector('[data-testid="housing-browse-map-view"]')).toBeNull();
    // listings=[] なので一覧側の分岐に入っていれば EmptyResult が出る。
    expect(document.querySelector('.housing-empty-result')).not.toBeNull();
  });
});
