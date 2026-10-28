// @vitest-environment happy-dom
import { it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { useHousingTourStore } from '../../../../store/useHousingTourStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import { useEphemeralListingsStore } from '../../../../store/useEphemeralListingsStore';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';


const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

// useIsMobile: BrowsePage.test.tsx と同じモック流儀 (既定 false、個別 it で true に上書き)。
vi.mock('../../../../hooks/useIsMobile', () => ({ useIsMobile: vi.fn().mockReturnValue(false) }));

// HousingReportModal は実物 (useHousingReport/fetch) を通さず、
// open/listingId の配線だけを検証する軽量スタブに差し替える。
vi.mock('../../report/HousingReportModal', () => ({
  HousingReportModal: ({ open, listingId }: { open: boolean; listingId: string; onClose: () => void }) =>
    open ? <div data-testid="mock-report-modal">{listingId}</div> : null,
}));

// showToast をスパイして、 リージョン跨ぎブロック時に呼ばれることを検証する (BrowsePage.test.tsx と同型)。
const showToastMock = vi.fn();
vi.mock('../../../toastBus', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

// HousingerByline(TourShowcasePanel 経由で描画される)は内部で Firestore getDoc を叩く。
// 未モックだと実ネットワーク呼び出しが残留し vmThreads プールが終了できずハングする
// (HousingDetailContent.test.tsx / TourShowcasePanel.test.tsx と同じ対処)。
vi.mock('../../housinger/HousingerByline', () => ({
  HousingerByline: () => null,
}));

import { useIsMobile } from '../../../../hooks/useIsMobile';
import { initTestI18n, listing1, listing2, listing3, ids, renderPage, seedListings } from './tourNavPageTestSetup';

beforeAll(initTestI18n);

describe('TourNavPage', () => {
  beforeEach(() => {
    navigate.mockReset();
    useHousingTourStore.setState({ listingIds: [], running: false, currentIndex: 0, phase: 'moving', viewStartAt: null });
    useHousingListingsStore.setState({ status: 'ready', listings: [], myListings: [] });
    useHousingViewStore.getState().reset();
    useEphemeralListingsStore.getState().clear();
    useAuthStore.setState({ user: null });
    useTourTrayStore.getState().clear();
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

  // bug #3 (2026-09-04): 空状態の「住所から追加」はページローカル state ではなく
  // useTourTrayStore に積む。 でないと探す等へ遷移した瞬間に消え、trayIds が 0 のままで
  // PC 計画ビューにも切り替わらなかった (「PC 用の見た目にならない」)。
  function addOneJpAddress() {
    fireEvent.click(screen.getByRole('button', { name: '住所から追加' }));
    fireEvent.change(screen.getByLabelText('データセンター'), { target: { value: 'Elemental' } });
    fireEvent.change(screen.getByLabelText('サーバー'), { target: { value: 'Aegis' } });
    fireEvent.change(screen.getByLabelText('エリア'), { target: { value: 'Mist' } });
    fireEvent.change(screen.getByLabelText('区'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('radio', { name: '個人宅・FCハウス' }));
    fireEvent.change(screen.getByLabelText('番地'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'ツアーに追加' }));
  }

  it('空状態: 住所から追加した家は useTourTrayStore.trayIds に積まれる (bug #3)', () => {
    renderPage();
    addOneJpAddress();
    const eph = useEphemeralListingsStore.getState().ephemeralListings;
    expect(eph).toHaveLength(1);
    expect(useTourTrayStore.getState().trayIds).toEqual([eph[0].id]);
  });

  it('空状態: 住所から追加すると PC 計画ビュー(蛇行グリッド)に切り替わる (bug #3)', () => {
    renderPage();
    addOneJpAddress();
    expect(screen.queryByText('ツアーがまだ始まっていません')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /開始/ })).toBeInTheDocument();
  });

  // ツアー計画画面: listingIds は空 (未開始) でもトレイに行き先があれば、空状態ではなく
  // 計画画面 (PC=詳細+蛇行グリッド / スマホ=縦一覧) を出す。
  it('listingIdsは空だがtrayIdsに1件以上あれば計画画面(PC・蛇行グリッド)を表示する', () => {
    seedListings();
    useTourTrayStore.getState().setTrayIds([listing1.id]);
    renderPage();
    expect(screen.queryByText('ツアーがまだ始まっていません')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /開始/ })).toBeInTheDocument();
    // 蛇行グリッド(TourTrayBoard)だけが出す案内文で、PC版であることを確定させる。
    expect(screen.getByText('カード左の ⋮⋮ をつかんでドラッグで入れ替え・効率順ボタンで自動に並べ替え')).toBeInTheDocument();
  });

  // 計画画面の要: 右のグリッドで家を選ぶと左の詳細パネルが差し替わる、という繋ぎ目。
  // 初期選択がどの家になるか(表示順=resolveTourOrder)に依存しないよう、
  // 「今出ていない家」のカードを選んでクリックする。
  it('計画画面(PC): グリッドのカードをクリックすると左の詳細パネルがその家に切り替わる', () => {
    seedListings();
    useTourTrayStore.getState().setTrayIds([listing1.id, listing2.id, listing3.id]);
    const { container } = renderPage();

    const detailTitle = () =>
      container.querySelector('.housing-tour-dest-title')?.textContent?.trim() ?? '';
    const initial = detailTitle();
    expect([listing1.title, listing2.title, listing3.title]).toContain(initial);

    // 初期選択と違う家 = クリックで確実に表示が変わる対象。
    const other = [listing1, listing2, listing3].find((l) => l.title !== initial);
    expect(other).toBeDefined();

    // グリッド(蛇行グリッド)のカード側のタイトル。左パネルの h2 と取り違えないよう
    // .housing-tour-board-cell 配下に限定して探す。
    const card = Array.from(
      container.querySelectorAll('.housing-tour-board-cell .housing-tour-tray-title'),
    ).find((el) => el.textContent?.trim() === other!.title);
    expect(card).toBeTruthy();

    fireEvent.click(card!);
    expect(detailTitle()).toBe(other!.title);
  });

  it('計画画面: 開始ボタンでマナー確認が開き、開始するとトレイが空になりlistingIdsが積まれる', () => {
    seedListings();
    useTourTrayStore.getState().setTrayIds([listing1.id, listing2.id]);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /開始/ }));
    fireEvent.click(screen.getByRole('button', { name: 'はじめる' }));
    expect(useTourTrayStore.getState().trayIds).toHaveLength(0);
    expect(useHousingTourStore.getState().listingIds.length).toBeGreaterThan(0);
  });

  it('計画画面(スマホ): 蛇行グリッドではなく縦一覧が出て、開始ボタンから実際にツアーが始まる', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    try {
      seedListings();
      useTourTrayStore.getState().setTrayIds([listing1.id, listing2.id]);
      renderPage();
      expect(screen.getByRole('button', { name: /開始/ })).toBeInTheDocument();
      // 蛇行グリッド(TourTrayBoard)の案内文が出ていないこと = PC版でなく縦一覧版であることの確認。
      expect(screen.queryByText('カード左の ⋮⋮ をつかんでドラッグで入れ替え・効率順ボタンで自動に並べ替え')).not.toBeInTheDocument();
      // ボタンが在るだけでなく、PC版と同じく「開始 → マナー確認 → はじめる」で実際に開始できること。
      fireEvent.click(screen.getByRole('button', { name: /開始/ }));
      fireEvent.click(screen.getByRole('button', { name: 'はじめる' }));
      expect(useTourTrayStore.getState().trayIds).toHaveLength(0);
      expect(useHousingTourStore.getState().listingIds.length).toBeGreaterThan(0);
    } finally {
      // 失敗時も後続テスト(PC前提)へ mobile が漏れないよう必ず戻す。
      vi.mocked(useIsMobile).mockReturnValue(false);
    }
  });

  it('ナビ中の「順番を変える」: 見学済み/これから行く順番が出て削除ボタンは無く、「ツアーに戻る」でナビに戻る', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 1 });
    seedListings();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '順番を変える' }));
    expect(screen.getByText('見学済み', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('これから行く順番')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ツアーに戻る' }));
    expect(screen.getByText('ルートのステップ')).toBeInTheDocument();
    expect(screen.queryByText('これから行く順番')).not.toBeInTheDocument();
    expect(useHousingTourStore.getState().listingIds).toEqual(ids);
  });

  it('ナビ中: 完了オーバーレイ表示中は「順番を変える」が出ない', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 2 });
    seedListings();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    expect(screen.queryByRole('button', { name: '順番を変える' })).not.toBeInTheDocument();
  });

});
