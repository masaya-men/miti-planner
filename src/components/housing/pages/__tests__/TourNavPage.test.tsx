// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import type { MockListing } from '../../../../data/housing/mockListings';
import { useHousingTourStore } from '../../../../store/useHousingTourStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import { useEphemeralListingsStore } from '../../../../store/useEphemeralListingsStore';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

// HousingReportModal は実物 (useHousingReport/fetch) を通さず、
// open/listingId の配線だけを検証する軽量スタブに差し替える。
vi.mock('../../report/HousingReportModal', () => ({
  HousingReportModal: ({ open, listingId }: { open: boolean; listingId: string; onClose: () => void }) =>
    open ? <div data-testid="mock-report-modal">{listingId}</div> : null,
}));

// showToast をスパイして、 リージョン跨ぎブロック時に呼ばれることを検証する (BrowsePage.test.tsx と同型)。
const showToastMock = vi.fn();
vi.mock('../../../Toast', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

import { TourNavPage } from '../TourNavPage';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

// Mist ward の実データに存在する plot (kind='plot') を使用 (TourNavMap.test.tsx と同じ plot 1/6/30)。
// 実データエリア literal は英語 'Mist' (mockListings.ts の gen() 参照)。 カタカナ 'ミスト' は
// isMistPlaceable === false になり地図ノードが0件になる罠があるため使わない。
function mk(id: string, plot: number): MockListing {
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

const listing1 = mk('tour-nav-1', 1);
const listing2 = mk('tour-nav-2', 6);
const listing3 = mk('tour-nav-3', 30);
const ids = [listing1.id, listing2.id, listing3.id];

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <TourNavPage />
      </MemoryRouter>
    </I18nextProvider>
  );
}

function seedListings() {
  useHousingListingsStore.setState({
    status: 'ready',
    listings: [listing1, listing2, listing3],
    myListings: [],
  });
}

describe('TourNavPage', () => {
  beforeEach(() => {
    navigate.mockReset();
    useHousingTourStore.setState({ listingIds: [], running: false, currentIndex: 0, phase: 'moving', viewStartAt: null });
    useHousingListingsStore.setState({ status: 'ready', listings: [], myListings: [] });
    useHousingViewStore.getState().reset();
    useEphemeralListingsStore.getState().clear();
    showToastMock.mockClear();
  });

  it('listingIds が空なら空状態のみ表示され、3カラムは出ない', () => {
    renderPage();
    expect(screen.getByText('ツアーがまだ始まっていません')).toBeInTheDocument();
    expect(screen.queryByText('ツアー進行状況')).not.toBeInTheDocument();
    expect(screen.queryByText('ルートのステップ')).not.toBeInTheDocument();
  });

  it('空状態: 「住所から追加」でJP+NA混在の一時トレイを作ると開始時ネットで阻止される', () => {
    // TourEmptyState.onAddEphemeral には canAddToTour による追加時ブロックが無い
    // (BrowsePage/FavoritesPage の addToTray と違い、住所から追加パネルは常に追加を通す)。
    // そのため、この画面では onStartEphemeral 内の tourRegionConflict だけが唯一の防波堤になる。
    renderPage();

    // 「住所から追加」を開く
    fireEvent.click(screen.getByRole('button', { name: '住所から追加' }));

    // 1件目: JP (Elemental/Aegis)
    fireEvent.change(screen.getByLabelText('データセンター'), { target: { value: 'Elemental' } });
    fireEvent.change(screen.getByLabelText('サーバー'), { target: { value: 'Aegis' } });
    fireEvent.change(screen.getByLabelText('エリア'), { target: { value: 'Mist' } });
    fireEvent.change(screen.getByLabelText('区'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('番地'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'ツアーに追加' }));

    // 2件目: NA (Aether/Gilgamesh)、別住所 (連続追加: パネルは開いたまま入力だけクリアされる)
    fireEvent.change(screen.getByLabelText('データセンター'), { target: { value: 'Aether' } });
    fireEvent.change(screen.getByLabelText('サーバー'), { target: { value: 'Gilgamesh' } });
    fireEvent.change(screen.getByLabelText('エリア'), { target: { value: 'Mist' } });
    fireEvent.change(screen.getByLabelText('区'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('番地'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'ツアーに追加' }));

    // 2件とも一時トレイに積まれている (追加時ブロックが無いことの確認)
    expect(useEphemeralListingsStore.getState().ephemeralListings).toHaveLength(2);

    // 開始 → 開始時ネットで弾かれ、tourStoreは変化しない
    fireEvent.click(screen.getByRole('button', { name: 'この内容でツアーを開始' }));

    expect(useHousingTourStore.getState().listingIds).toHaveLength(0);
    expect(useHousingTourStore.getState().running).toBe(false);
    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('listingIds + listings 注入で3カラム(進行状況/地図/ショーケース)が描画される', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
    seedListings();
    const { container } = renderPage();
    expect(screen.getByText('ツアー進行状況')).toBeInTheDocument();
    expect(container.querySelector('[data-region="tour-map"]')).not.toBeNull();
    // Phase3 Task2でショーケースパネル(右)からTourRouteStepsを撤去したため、
    // 「ルートのステップ」見出しは進行状況パネル(左)のみに出る。
    expect(screen.getByText('ルートのステップ')).toBeInTheDocument();
  });

  it('「次へ」でtourStore.nextが発火しcurrentIndexが進む', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
    seedListings();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    expect(useHousingTourStore.getState().currentIndex).toBe(1);
  });

  it('「見学」で viewing に切替わりタイマーが出る / 「次へ」で moving に戻る', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
    seedListings();
    const { container } = renderPage();
    // 移動中: 行き方が出る / タイマーは無い
    expect(container.querySelector('.housing-tour-phasezone-timer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /見学開始/ }));
    expect(useHousingTourStore.getState().phase).toBe('viewing');
    expect(container.querySelector('.housing-tour-phasezone-timer')).not.toBeNull();
    // 次へ: moving に戻りタイマーが消える
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    expect(useHousingTourStore.getState().phase).toBe('moving');
    expect(container.querySelector('.housing-tour-phasezone-timer')).toBeNull();
  });

  it('報告ボタンでHousingReportModalが現在のlistingIdでopenする', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 1 });
    seedListings();
    renderPage();
    expect(screen.queryByTestId('mock-report-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '情報が違う・報告する' }));
    expect(screen.getByTestId('mock-report-modal')).toHaveTextContent(listing2.id);
  });

  it('最終ステップで主ボタンが「完了」になり、押すと完了状態(complete.title)に切替わる', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: ids.length - 1 });
    seedListings();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    expect(screen.getByText('素敵な時間でしたね！')).toBeInTheDocument();
    // store非破壊: currentIndex は完了フラグと無関係にそのまま
    expect(useHousingTourStore.getState().currentIndex).toBe(ids.length - 1);
  });

  it('完了はオーバーレイ方式: 下の3パネルは残しつつ inert(操作不可)で重ねる', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: ids.length - 1 });
    seedListings();
    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    // オーバーレイが出る
    expect(screen.getByTestId('tour-complete-overlay')).toBeInTheDocument();
    // 全画面に切替えず、下のパネル(進行状況見出し)は残っている
    expect(screen.getByText('ツアー進行状況')).toBeInTheDocument();
    // 3パネルは inert (安全に戻すため操作不可)
    expect(container.querySelector('[data-region="left"]')?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('[data-region="center"]')?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('[data-region="right"]')?.hasAttribute('inert')).toBe(true);
  });
});
