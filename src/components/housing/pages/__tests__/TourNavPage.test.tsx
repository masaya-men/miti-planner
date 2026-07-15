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

  it('空状態: JPを積んだ後、別リージョン(NA)のDCを選ぶと注記が出て2件目が追加できない (早期ブロック)', () => {
    // 一時追加パネルは trayRegion を受け取り、別リージョンの DC を選んだ時点で注記+追加不可にする。
    // これにより、空状態でも住所を全部埋めてから開始時ネットで弾かれる無駄入力を避ける
    // (開始時ネット tourRegionConflict は依然 backstop として残る)。
    renderPage();

    // 「住所から追加」を開く
    fireEvent.click(screen.getByRole('button', { name: '住所から追加' }));

    // 1件目: JP (Elemental/Aegis) → 追加成功
    fireEvent.change(screen.getByLabelText('データセンター'), { target: { value: 'Elemental' } });
    fireEvent.change(screen.getByLabelText('サーバー'), { target: { value: 'Aegis' } });
    fireEvent.change(screen.getByLabelText('エリア'), { target: { value: 'Mist' } });
    fireEvent.change(screen.getByLabelText('区'), { target: { value: '3' } });
    // 建物タイプ (個人宅) を選ぶまで番地欄は出ない → 先に選ぶ。
    fireEvent.click(screen.getByRole('radio', { name: '個人宅・FCハウス' }));
    fireEvent.change(screen.getByLabelText('番地'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'ツアーに追加' }));
    expect(useEphemeralListingsStore.getState().ephemeralListings).toHaveLength(1);

    // 2件目: NA (Aether) の DC を選んだ時点で注記が出て、サーバー以下がロックされ追加できない
    fireEvent.change(screen.getByLabelText('データセンター'), { target: { value: 'Aether' } });

    expect(screen.getByText('別リージョンのハウジングは同じツアーに入れられません')).toBeInTheDocument();
    expect((screen.getByLabelText('サーバー') as HTMLSelectElement).disabled).toBe(true);
    const addBtn = screen.getByRole('button', { name: 'ツアーに追加' }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);

    // 2件目は積まれない (JP の1件だけ)
    expect(useEphemeralListingsStore.getState().ephemeralListings).toHaveLength(1);
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

  // L: 跨ぎ(DCトラベル/ワールド訪問)のぼかし中は「次へ」1回目で ack(ぼかし解除)、
  // 2回目で次ステップへ。ユーザーは同じ「次へ」を押し続けるだけで進める。
  it('跨ぎステップ: 「次へ」1回目でぼかし解除(ack)されcurrentIndexは進まず、2回目で次へ進む', () => {
    // A(Aegis)→B(Atomos) は同DC別ワールド = world 跨ぎ。B→C は同ワールドで跨ぎ無し。
    const a = mk('cross-a', 1);
    const b = { ...mk('cross-b', 6), server: 'Atomos', addressKey: 'Elemental|Atomos|Mist|W12|H6' };
    const c = { ...mk('cross-c', 30), server: 'Atomos', addressKey: 'Elemental|Atomos|Mist|W12|H30' };
    useHousingListingsStore.setState({ status: 'ready', listings: [a, b, c], myListings: [] });
    useHousingTourStore.setState({ listingIds: [a.id, b.id, c.id], running: true, currentIndex: 1, phase: 'moving' });

    renderPage();

    // index1 到着: 前(A)→現(B)は world 跨ぎ → 中央マップにぼかし+跨ぎ案内が出る
    expect(screen.getByTestId('tour-map-cross')).toBeInTheDocument();

    // 「次へ」1回目: ぼかし解除(ack)されるが currentIndex は 1 のまま
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    expect(useHousingTourStore.getState().currentIndex).toBe(1);
    expect(screen.queryByTestId('tour-map-cross')).not.toBeInTheDocument();

    // 「次へ」2回目: 次のステップ(index2)へ進む
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    expect(useHousingTourStore.getState().currentIndex).toBe(2);
  });

  it('跨ぎでないステップは「次へ」1回で進む (同DC同ワールドの ids)', () => {
    // ids(listing1/2/3)は全て Elemental/Aegis で跨ぎ無し → 中央マップにぼかしは出ない。
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 1, phase: 'moving' });
    seedListings();
    renderPage();
    expect(screen.queryByTestId('tour-map-cross')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    expect(useHousingTourStore.getState().currentIndex).toBe(2);
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
