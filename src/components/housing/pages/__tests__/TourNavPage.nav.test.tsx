// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { useHousingTourStore } from '../../../../store/useHousingTourStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import { useEphemeralListingsStore } from '../../../../store/useEphemeralListingsStore';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import { useHousingModalStore } from '../../../../store/useHousingModalStore';


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
import { initTestI18n, mk, listing2, ids, renderPage, seedListings } from './tourNavPageTestSetup';

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

  // 招待発行(create-shared-tour)はログイン必須。未ログインで招待パネルを普通に出すと
  // 「みんなを招待」→サイレント失敗(招待リンクの発行に失敗しました)になるバグが実機で見つかった。
  // ログイン案内へ差し替えることで、非ログインユーザーが原因不明の失敗に遭わないようにする。
  it('未ログインなら招待パネルの代わりにログイン案内が出て、招待ボタンは出ない', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
    seedListings();
    renderPage();
    expect(screen.getByText('ツアーへの招待にはログインが必要です')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'みんなを招待' })).not.toBeInTheDocument();
  });

  it('ログイン済みなら通常通り「みんなを招待」ボタンが出る', () => {
    useAuthStore.setState({ user: { uid: 'test-uid' } as any });
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
    seedListings();
    renderPage();
    expect(screen.getByRole('button', { name: 'みんなを招待' })).toBeInTheDocument();
    expect(screen.queryByText('ツアーへの招待にはログインが必要です')).not.toBeInTheDocument();
  });

  // スマホ地図下部の招待案内(tour-map-invite-hint)は isMobile 限定。PC側に漏れ出さないことを確認する。
  it('PC(既定)では地図下部の招待案内は出ない', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
    seedListings();
    renderPage();
    expect(screen.queryByTestId('tour-map-invite-hint')).not.toBeInTheDocument();
  });

  it('「次へ」でtourStore.nextが発火しcurrentIndexが進む', () => {
    useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
    seedListings();
    renderPage();
    // #2: 1件目は「まず○○へ」出発案内が出るため、最初の「次へ」はその ack(前進しない)。
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    expect(useHousingTourStore.getState().currentIndex).toBe(0);
    // ack 後の「次へ」で前進する(跨ぎ ack と同型)。
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

  // Task4: スマホ横持ちUI(案A)。useIsMobile=true かつ未完了・listingIds ありで
  // 下部操作バー(TourMobileBar)が追加描画されることだけを検証する(既存3カラムはそのまま)。
  describe('モバイル(useIsMobile=true)', () => {
    beforeEach(() => {
      vi.mocked(useIsMobile).mockReturnValue(true);
    });
    afterEach(() => {
      vi.mocked(useIsMobile).mockReturnValue(false);
    });

    it('TourMobileBarが描画される', () => {
      useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
      seedListings();
      renderPage();
      expect(screen.getByTestId('tour-mobile-bar')).toBeInTheDocument();
    });

    // 実機FB: 見学開始で全画面ショーケースオーバーレイを開く旧UXを撤去し、
    // 地図側の経過時間チップだけを出すようにした。overlay 非表示 + チップ表示を検証する。
    it('見学中(phase=viewing)はショーケースオーバーレイを開かず、地図に経過時間チップだけ出す', () => {
      useHousingTourStore.setState({
        listingIds: ids,
        running: true,
        currentIndex: 0,
        phase: 'viewing',
        viewStartAt: Date.now(),
      });
      seedListings();
      renderPage();
      expect(screen.queryByTestId('tour-mobile-showcase')).not.toBeInTheDocument();
      expect(screen.getByTestId('tour-mobile-viewing-timer')).toBeInTheDocument();
    });

    // 移動中(phase=moving)ではチップを出さない(見学開始前に経過時間を見せる意味がないため)。
    it('移動中(phase=moving)は経過時間チップを出さない', () => {
      useHousingTourStore.setState({
        listingIds: ids,
        running: true,
        currentIndex: 0,
        phase: 'moving',
        viewStartAt: null,
      });
      seedListings();
      renderPage();
      expect(screen.queryByTestId('tour-mobile-viewing-timer')).not.toBeInTheDocument();
    });

    // 2026-08-12 相談: スマホには招待の入口説明が一切無かった実機指摘への対応。
    // 未ログイン=人+マークのまま・地図下部にログイン案内、タップでログインモーダルが開く。
    it('未ログイン: 招待アイコンは変わらず、地図下部にログイン案内が出てタップでログインモーダルが開く', () => {
      useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
      seedListings();
      renderPage();
      const bar = screen.getByTestId('tour-mobile-bar');
      const inviteBtn = within(bar).getByRole('button', { name: 'みんなを招待' });
      expect(screen.getByTestId('tour-map-invite-hint')).toHaveTextContent(
        'ログインするとツアーに招待できます',
      );
      expect(useHousingModalStore.getState().login.open).toBe(false);
      fireEvent.click(inviteBtn);
      expect(useHousingModalStore.getState().login.open).toBe(true);
    });

    // ログイン済み(未発行含む)は最初からリンクマーク+「右下のボタンでコピー」案内にする
    // (文言と見た目を一致させるための2026-08-12方針)。
    it('ログイン済み(未発行): 招待アイコンはリンクマークになり、地図下部に「右下のボタンでコピー」案内が出る', () => {
      useAuthStore.setState({ user: { uid: 'test-uid' } as any });
      useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex: 0 });
      seedListings();
      renderPage();
      const bar = screen.getByTestId('tour-mobile-bar');
      expect(within(bar).getByRole('button', { name: 'コピー' })).toBeInTheDocument();
      expect(screen.getByTestId('tour-map-invite-hint')).toHaveTextContent(
        '右下のボタンから招待リンクをコピーできます',
      );
    });
  });

  // PC(useIsMobile=false, 既定)では見学中でも地図に経過時間チップを出さない
  // (右パネル TourProgressPanel/TourPhaseZone に既存の見学中表示があるため)。
  it('PCでは見学中でも地図に経過時間チップを出さない', () => {
    useHousingTourStore.setState({
      listingIds: ids,
      running: true,
      currentIndex: 0,
      phase: 'viewing',
      viewStartAt: Date.now(),
    });
    seedListings();
    renderPage();
    expect(screen.queryByTestId('tour-mobile-viewing-timer')).not.toBeInTheDocument();
  });
});
