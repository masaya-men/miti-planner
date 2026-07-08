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
    useHousingTourStore.setState({ listingIds: [], running: false, currentIndex: 0 });
    useHousingListingsStore.setState({ status: 'ready', listings: [], myListings: [] });
    useHousingViewStore.getState().reset();
  });

  it('listingIds が空なら空状態のみ表示され、3カラムは出ない', () => {
    renderPage();
    expect(screen.getByText('ツアーがまだ始まっていません')).toBeInTheDocument();
    expect(screen.queryByText('ツアー進行状況')).not.toBeInTheDocument();
    expect(screen.queryByText('ルートのステップ')).not.toBeInTheDocument();
  });

  it('listingIds + listings 注入で3カラム(進捗/地図/次の目的地)が描画される', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
    seedListings();
    const { container } = renderPage();
    expect(screen.getByText('ツアー進行状況')).toBeInTheDocument();
    expect(container.querySelector('[data-region="tour-map"]')).not.toBeNull();
    // Phase3 Task1時点では進行状況パネル(左)と次の目的地パネル(右)の両方が
    // TourRouteSteps を描画するため「ルートのステップ」見出しは2箇所に出る
    // (重複は意図済み・Task3で右カラムの重複が撤去される予定)。
    expect(screen.getAllByText('ルートのステップ')).toHaveLength(2);
  });

  it('「到着した → 次へ」でtourStore.nextが発火しcurrentIndexが進む', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
    seedListings();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '到着した → 次へ' }));
    expect(useHousingTourStore.getState().currentIndex).toBe(1);
  });

  it('報告ボタンでHousingReportModalが現在のlistingIdでopenする', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 1 });
    seedListings();
    renderPage();
    expect(screen.queryByTestId('mock-report-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '情報が違う・報告する' }));
    expect(screen.getByTestId('mock-report-modal')).toHaveTextContent(listing2.id);
  });

  it('最終ステップで主ボタンが「ツアーを完了」になり、押すと完了状態(complete.title)に切替わる', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: ids.length - 1 });
    seedListings();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'ツアーを完了' }));
    expect(screen.getByText('すべて回りました')).toBeInTheDocument();
    // store非破壊: currentIndex は完了フラグと無関係にそのまま
    expect(useHousingTourStore.getState().currentIndex).toBe(ids.length - 1);
  });
});
