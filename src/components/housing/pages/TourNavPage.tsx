import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { useTourTrayStore } from '../../../store/useTourTrayStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { buildTourPool } from '../../../lib/housing/buildTourPool';
import { canAddToTour, tourAnchorRegion, tourRegionConflict } from '../../../lib/housing/tourCrossing';
import { resolveTourOrder } from '../../../lib/housing/resolveTourOrder';
import { useTourRenderModel } from '../../../lib/housing/useTourRenderModel';
import { useElapsed, formatElapsed } from '../../../lib/housing/useElapsed';
import { termLabel } from '../../../lib/housing/housingTerms';
import { pickRegionLocale } from '../../../data/housing/regionMap';
import { createSharedTour } from '../../../lib/housingApiClient';
import { buildTourSnapshots, snapshotContainsHiddenAddress } from '../../../lib/sharedTour/snapshot';
import { pushHostState, endHostTour } from '../../../lib/sharedTour/hostSync';
import { TourProgressPanel } from '../tour/TourProgressPanel';
import { TourNavMap } from '../tour/TourNavMap';
import { TourShowcasePanel } from '../tour/TourShowcasePanel';
import { TourEmptyState } from '../tour/TourEmptyState';
import { TourInvitePanel } from '../tour/TourInvitePanel';
import { TourTrayDetailPanel } from '../tour/TourTrayDetailPanel';
import { TourTrayBoard } from '../browse/TourTrayBoard';
import { TourTrayList } from '../browse/TourTrayList';
import { EphemeralAddPanel } from '../browse/EphemeralAddPanel';
import { MannerNoticeDialog } from '../workspace/MannerNoticeDialog';
import { HousingLoginPrompt } from '../HousingLoginPrompt';
import { TourMobileBar } from '../tour/TourMobileBar';
import { TourAddressExposureDialog } from '../tour/TourAddressExposureDialog';
import { HousingReportModal } from '../report/HousingReportModal';
import { showToast } from '../../Toast';
import type { MockListing } from '../../../data/housing/mockListings';
import type { TourSnapshot } from '../../../types/sharedTour';

/**
 * ツアー中(Nav)ページ (Task8): オーケストレーター。
 *
 * store 購読 + データ解決 (useTourRenderModel 経由の resolveTourSteps/computeTourProgress/地図配線) を行い、
 * Task4-7 の表示専用部品 (進行状況パネル/地図/ショーケースパネル/空状態) に渡すだけ。
 * 派生 orchestration は Task 2.4 で `useTourRenderModel` へ抽出し、参加者ページ(JoinTourPage)と共有している。
 * 完了判定はページローカルの `completed` state で表現し、
 * store の `next()` が持つ `currentIndex` の `length-1` クランプ (既存仕様・非破壊) には依存しない。
 */
export const TourNavPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = pickRegionLocale(i18n.language);
  const navigate = useNavigate();
  // Task4: スマホ横持ちUI(案A)。既存のPC向け3カラムはそのまま(CSSで左右パネルのみ非表示)。
  const isMobile = useIsMobile();

  const listingIds = useHousingTourStore((s) => s.listingIds);
  const currentIndex = useHousingTourStore((s) => s.currentIndex);
  const next = useHousingTourStore((s) => s.next);
  const prev = useHousingTourStore((s) => s.prev);
  const stop = useHousingTourStore((s) => s.stop);
  const reset = useHousingTourStore((s) => s.reset);
  const phase = useHousingTourStore((s) => s.phase);
  const viewStartAt = useHousingTourStore((s) => s.viewStartAt);
  const startViewing = useHousingTourStore((s) => s.startViewing);
  const exitTourMode = useHousingViewStore((s) => s.exitTourMode);

  const listings = useHousingListingsStore((s) => s.listings);
  const myListings = useHousingListingsStore((s) => s.myListings);
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const isLoggedIn = uid !== null;
  const openLogin = useHousingModalStore((s) => s.openLogin);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);

  const [completed, setCompleted] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  // 共有ツアー同期 (Task 2.1): 幹事が発行した招待の token。null=未発行。
  // mount 時の自動復帰 (localStorage からの token 復帰) は今回スコープ外
  // (設計§7 の同端末復帰は別タスク・stale token 誤表示を避ける)。
  const [tourToken, setTourToken] = useState<string | null>(null);
  // 招待発行前にホストが書ける短い文章(OGPカードにも使う)。
  const [tourName, setTourName] = useState('');
  // 招待リンク発行中 (create-shared-tour API 応答待ち)。ボタンを「作成中…」にして二重発行も防ぐ。
  const [creatingInvite, setCreatingInvite] = useState(false);
  // 住所露出警告ダイアログの表示に使う「発行待ち」の中身 (非公開/一時追加を含む場合のみ立つ)。
  // alsoCopy: スマホ下部バー由来の発行(発行直後に自動でリンクをコピーまで行う)かどうか。
  const [pendingInvite, setPendingInvite] = useState<{
    snaps: TourSnapshot[];
    hasEphemeral: boolean;
    alsoCopy: boolean;
  } | null>(null);

  // spec A-3: 公開一覧 + 自分の登録 (非公開/期限切れ含む) + 一時 listing (計画: 住所登録なし一時ツアー Task2) を合流。
  const pool = useMemo(
    () => buildTourPool(listings, myListings, uid, ephemeral, Date.now()),
    [listings, myListings, uid, ephemeral],
  );
  // ステップ/進捗/次・前の目的地/行き方/跨ぎ/地図モデルの派生一式は共有フックへ抽出済み(Task 2.4)。
  // 参加者ページ(JoinTourPage)と全く同じ orchestration を通す。挙動は抽出前と同一(ロジック無変更)。
  const {
    steps, progress, nextStep, currentListing,
    directions, directionsText, crossing, mapModel, mapStatus, asset, originName,
  } = useTourRenderModel(pool, listingIds, currentIndex, locale);

  const isLast = currentIndex === listingIds.length - 1;

  // 中央マップの跨ぎ案内カード: 「次へ」の1回目(ack)で該当ステップだけ確認済みにして消す(次の跨ぎでまた出す)。
  // カード自体にはボタンを持たず、ack への到達手段は下記 onPrimary の「次へ」二段階ロジックに一本化している。
  // 見学中(viewing)は必ず解除する = 見学=既に現地に着いている前提。未 ack のまま「見学開始」を
  // 押しても地図(光る区画)が見えるようにする(見学中もぼかしが残る不具合の防止)。
  const [crossingAckIndex, setCrossingAckIndex] = useState<number | null>(null);
  const showCrossingOverlay =
    crossing.kind !== 'none' && crossingAckIndex !== currentIndex && phase !== 'viewing';
  const onAckCrossing = useCallback(() => setCrossingAckIndex(currentIndex), [currentIndex]);
  const canView = currentListing != null;

  // Task4(地図下部の帯用): directions(PlotDirections={aetheryte,directions})を
  // teleport(エーテライト名の文)/directions(行き方本文)の2段データへ整形。
  // 右パネル(TourPhaseZone)と同じ i18n キー(teleport_to)を使うだけで、行き方データ自体は
  // 既存の派生値(useTourRenderModel の directions)をそのまま使う(新しい行き方ロジックは持たない)。
  const footerDirections = useMemo(() => {
    if (!directions) return null;
    const teleport = t('housing.tour.nav.dest.teleport_to', {
      aetheryte: termLabel('aetheryte', directions.aetheryte, locale),
    });
    return { teleport, directions: directionsText ?? directions.directions };
  }, [directions, directionsText, t, locale]);

  // 実機FB: スマホの「見学開始」は全画面ショーケースオーバーレイ(左パネルの代替)を開くと
  // 地図が隠れてしまい実機で不評だったため撤去。地図のエリアに経過時間チップだけを出す方式に変更。
  // 見学中(phase==='viewing')の経過秒を1秒ごとに再計算し、地図側へ整形済み文言だけを渡す
  // (TourNavMap は表示専用・タイマー計算を持ち込まない)。PC は右パネルの既存表示があるため出さない。
  const viewingElapsedSeconds = useElapsed(isMobile && phase === 'viewing' ? viewStartAt : null);
  const viewingTimerText =
    isMobile && phase === 'viewing' && viewStartAt != null
      ? t('housing.tour.nav.viewing.elapsed', { elapsed: formatElapsed(viewingElapsedSeconds) })
      : null;

  // スマホの地図下部帯に常時出す招待の案内文(実機指摘: 招待の入口説明がスマホに一切無かったため追加)。
  // 未ログイン=ログインすれば招待できる案内 / ログイン済み=下部バーのボタンでコピーできる案内。
  // 行き方の有無(footerDirections)に関わらず、この案内自体は常に出す。
  const mobileInviteHint = isMobile
    ? t(
        isLoggedIn
          ? 'housing.tour.nav.invite.mobile_hint_copy'
          : 'housing.tour.nav.invite.mobile_hint_login',
      )
    : null;

  const onGoFavorites = useCallback(() => navigate('/housing/favorites'), [navigate]);

  // 空状態/計画画面の「住所から追加」モーダル (計画: 住所登録なし一時ツアー Task3)。
  // 開閉 state をここ (TourNavPage) が持つことで、trayIds 0↔1 や PC↔スマホ切替でレイアウトが
  // 入れ替わっても EphemeralAddPanel がアンマウントされず、Allmarks 一括インポートの進捗が
  // 途中で消えない。
  const [addOpen, setAddOpen] = useState(false);
  // BrowsePage.addToTray と同型: 一時 listing をストアから fresh 解決 → 跨ぎ検査 →
  // useTourTrayStore へ積む。旧実装はページローカルの emptyTrayIds に積んでいたため、
  // 探す等へ遷移した瞬間に消え、trayIds が 0 のままで PC 計画ビューにも切り替わらなかった
  // (2026-09-04 bug #3 修正)。
  const onAddToTray = useCallback(
    (id: string) => {
      const eph = useEphemeralListingsStore.getState().ephemeralListings;
      const candidate = pool.find((l) => l.id === id) ?? eph.find((l) => l.id === id);
      if (!candidate || candidate.visibility === 'unlisted') return;
      const curTrayIds = useTourTrayStore.getState().trayIds;
      const trayRegion = tourAnchorRegion(
        curTrayIds.map(
          (tid) => (pool.find((l) => l.id === tid) ?? eph.find((l) => l.id === tid))?.region ?? null,
        ),
      );
      if (!canAddToTour(trayRegion, candidate.region ?? '')) {
        showToast(t('housing.tour.region_block'), 'error');
        return;
      }
      useTourTrayStore
        .getState()
        .setTrayIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [pool, t],
  );

  // 計画画面(蛇行グリッド): トレイに1件以上あれば「ツアー未開始だが計画中」として
  // TourEmptyState の代わりに TourTrayDetailPanel + TourTrayBoard(PC)/TourTrayList(スマホ)を出す。
  const trayIds = useTourTrayStore((s) => s.trayIds);
  const setTrayIds = useTourTrayStore((s) => s.setTrayIds);
  const pinnedIds = useTourTrayStore((s) => s.pinnedIds);
  // EphemeralAddPanel の早期跨ぎブロック用: いまトレイに入っている家の非OCEアンカー地域。
  const trayRegionForAdd = useMemo(
    () => tourAnchorRegion(trayIds.map((tid) => pool.find((l) => l.id === tid)?.region ?? null)),
    [trayIds, pool],
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planMannerOpen, setPlanMannerOpen] = useState(false);

  // 選択中idがトレイから外れたら(削除/開始等)、先頭の家へ選択を戻す。
  // 「先頭」はトレイ配列の生の順ではなく、グリッド/一覧が実際に表示している解決済みの順
  // (resolveTourOrder = ピン留め + 効率順) の先頭に合わせる。
  // でないと初期選択の家がカード①と一致せず紛らわしい。
  useEffect(() => {
    if (trayIds.length === 0) {
      setSelectedPlanId(null);
      return;
    }
    if (!selectedPlanId || !trayIds.includes(selectedPlanId)) {
      const displayOrder = resolveTourOrder(trayIds, pool, { pinnedIds });
      setSelectedPlanId(displayOrder[0] ?? trayIds[0]);
    }
  }, [trayIds, selectedPlanId, pool, pinnedIds]);

  const selectedPlanListing = selectedPlanId
    ? (pool.find((l) => l.id === selectedPlanId) ?? null)
    : null;

  // 計画画面の「ツアーを開始する」。BrowsePage.commitStart / FavoritesPage.commitStart と同型
  // (resolveTourOrder → 跨ぎ検査 → マナー確認 → setListings/start/enterTourMode/clear)。
  // 既にこのページ(/housing/tour)にいるため、開始後の navigate は不要
  // (useHousingTourStore.listingIds が非0になり、このページ自身が実行中の3パネルへ再描画される)。
  const commitPlanStart = useCallback(() => {
    if (trayIds.length === 0) return;
    const orderedIds = resolveTourOrder(trayIds, pool, { pinnedIds });
    const stops = orderedIds
      .map((id) => pool.find((l) => l.id === id))
      .filter((l): l is MockListing => Boolean(l));
    const conflict = tourRegionConflict(stops);
    if (conflict) {
      showToast(t('housing.tour.region_block_start', { regions: conflict.join(' / ') }), 'error');
      return;
    }
    useHousingTourStore.getState().setListings(orderedIds);
    useHousingTourStore.getState().start();
    useHousingViewStore.getState().enterTourMode();
    useTourTrayStore.getState().clear();
    setPlanMannerOpen(false);
  }, [trayIds, pool, pinnedIds, t]);

  // 共有ツアー同期 (Task 2.1): 幹事の「みんなを招待」発行フロー。
  // 実際の Firestore 書き込み (create-shared-tour) を行う共通処理。
  // alsoCopy=true のときは発行直後にそのままリンクをクリップボードへコピーする
  // (スマホ下部バーは「発行」と「コピー」を1タップに統合しているため)。
  const doCreate = useCallback(
    async (snaps: TourSnapshot[], alsoCopy = false) => {
      setCreatingInvite(true);
      try {
        const { tourToken: token } = await createSharedTour(snaps, tourName);
        setTourToken(token);
        localStorage.setItem('lopo_shared_tour_token', token);
        if (alsoCopy) {
          const url = `${location.origin}/housing/tour/${token}`;
          void navigator.clipboard?.writeText(url);
          showToast(t('housing.tour.nav.invite.copied'), 'success');
        }
      } catch {
        showToast(t('housing.tour.nav.invite.error'), 'error');
      } finally {
        setCreatingInvite(false);
      }
    },
    [t, tourName],
  );

  // 「みんなを招待」の共通処理。非公開/一時追加の家を含む場合は警告ダイアログを挟み、
  // それ以外は確認なしで即発行する。
  // 招待の発行(create-shared-tour)はログイン必須(housingApiClient 参照)。デスクトップは
  // パネルごとログイン案内に差し替えるため通常ここに来ないが、スマホ下部バーはボタンが
  // 常設のため、未ログイン時はここでログインモーダルを開いて終わる(サイレント失敗の防止)。
  const startInvite = useCallback(
    (alsoCopy: boolean) => {
      if (!isLoggedIn) {
        openLogin();
        return;
      }
      const snaps = buildTourSnapshots(listingIds, pool);
      const hasEphemeral = listingIds.some((id) => ephemeral.some((e) => e.id === id));
      const containsHidden = snapshotContainsHiddenAddress(snaps);
      if (hasEphemeral || containsHidden) {
        setPendingInvite({ snaps, hasEphemeral, alsoCopy });
      } else {
        void doCreate(snaps, alsoCopy);
      }
    },
    [isLoggedIn, openLogin, listingIds, pool, ephemeral, doCreate],
  );

  // デスクトップ(TourInvitePanel)の「みんなを招待」ボタン。発行のみ、コピーは別ボタン。
  const onInvite = useCallback(() => startInvite(false), [startInvite]);

  // 警告ダイアログの「このまま招待する」。
  const onConfirmExpose = useCallback(() => {
    if (pendingInvite) void doCreate(pendingInvite.snaps, pendingInvite.alsoCopy);
    setPendingInvite(null);
  }, [pendingInvite, doCreate]);

  // 招待リンクをクリップボードへコピー。
  const onCopyInvite = useCallback(() => {
    if (!tourToken) return;
    const url = `${location.origin}/housing/tour/${tourToken}`;
    void navigator.clipboard?.writeText(url);
    showToast(t('housing.tour.nav.invite.copied'), 'success');
  }, [tourToken, t]);

  // スマホ下部バーの招待アイコン。発行済みならコピーのみ、未発行なら発行して自動コピー(1タップ統合)。
  const onMobileInviteTap = useCallback(() => {
    if (tourToken) {
      onCopyInvite();
      return;
    }
    startInvite(true);
  }, [tourToken, onCopyInvite, startInvite]);

  // 幹事の操作 (前へ/見学/次へ) を live state に反映する (孤児 live 防止は onFinish 側で別途)。
  useEffect(() => {
    if (!tourToken) return;
    // #A: crossingAckIndex(幹事の「移動しました」)も同期し、参加者の跨ぎ overlay を主催者操作でだけ解除する。
    void pushHostState(tourToken, { currentIndex, phase, viewStartAt, crossingAckedIndex: crossingAckIndex });
  }, [tourToken, currentIndex, phase, viewStartAt, crossingAckIndex]);

  const onFinish = useCallback(() => {
    // ツアー終了時、共有中なら live state を ended にして参加者側を追従させる (孤児 live 防止)。
    if (tourToken) {
      void endHostTour(tourToken);
      localStorage.removeItem('lopo_shared_tour_token');
    }
    stop();
    exitTourMode();
    reset();
    navigate('/housing');
  }, [tourToken, stop, exitTourMode, reset, navigate]);

  const backToBrowse = useCallback(() => {
    // 完了後にツアーを離れる＝共有中なら live を ended にして参加者を追従させる（孤児 live 防止・onFinish と同型）。
    if (tourToken) {
      void endHostTour(tourToken);
      localStorage.removeItem('lopo_shared_tour_token');
    }
    stop();
    exitTourMode();
    reset();
    setCompleted(false);
    navigate('/housing');
  }, [tourToken, stop, exitTourMode, reset, navigate]);

  const backToFavorites = useCallback(() => {
    // 完了後にツアーを離れる＝共有中なら live を ended にして参加者を追従させる（孤児 live 防止・onFinish と同型）。
    if (tourToken) {
      void endHostTour(tourToken);
      localStorage.removeItem('lopo_shared_tour_token');
    }
    stop();
    exitTourMode();
    reset();
    setCompleted(false);
    navigate('/housing/favorites');
  }, [tourToken, stop, exitTourMode, reset, navigate]);

  const onPrimary = useCallback(() => {
    // L: 跨ぎ(DCトラベル/ワールド訪問)のぼかしオーバーレイ表示中は、「次へ」の1回目で
    // 「移動しました(地図を見る)」と同じ ack を行い、ぼかしを解除して地図を見せる (ステップは進めない)。
    // ack 済み(オーバーレイ非表示)なら従来通り前進する。ユーザーは同じ「次へ」を押し続けるだけで進める。
    if (showCrossingOverlay) {
      onAckCrossing();
      return;
    }
    if (isLast) {
      setCompleted(true);
      // #B: 完了と同時に共有 live を ended にして、参加者にも同じ完了画面を出す(主催者と同じ終わり方)。
      if (tourToken) void endHostTour(tourToken);
    } else {
      next();
    }
  }, [showCrossingOverlay, onAckCrossing, isLast, next, tourToken]);

  const onOpenReport = useCallback(() => {
    const listing = progress.currentStep?.listing;
    if (listing) setReportId(listing.id);
  }, [progress.currentStep]);

  // 実行中でない = 計画フェーズ (listingIds は空)。
  // トレイが空 → 空状態 / トレイに行き先あり → 計画画面 (PC=詳細+蛇行グリッド / スマホ=縦一覧)。
  // 「住所から追加」モーダル (EphemeralAddPanel) は、trayIds 0↔1 や PC↔スマホ切替でレイアウトが
  // 入れ替わってもアンマウントされないよう、下のフラグメント直下に1つだけ置く。
  if (listingIds.length === 0) {
    const planning = trayIds.length > 0;
    return (
      <>
        {!planning && (
          <div className="housing-tour-page">
            <section
              className="housing-tour-page-panel housing-tour-page-panel-solo"
              data-region="center"
            >
              <TourEmptyState
                onGoFavorites={onGoFavorites}
                onGoBrowse={() => navigate('/housing')}
                onOpenAdd={() => setAddOpen(true)}
                addOpen={addOpen}
              />
            </section>
          </div>
        )}

        {planning && isMobile && (
          <div className="housing-tour-plan-mobile">
            <button
              type="button"
              className="housing-ephemeral-toggle"
              aria-expanded={addOpen}
              onClick={() => setAddOpen((o) => !o)}
            >
              <Plus size={14} aria-hidden="true" />
              {t('housing.ephemeral.add_button')}
            </button>
            <TourTrayList listingIds={trayIds} onChange={setTrayIds} />
            <button
              type="button"
              className="housing-tour-tray-start"
              disabled={trayIds.length === 0}
              onClick={() => setPlanMannerOpen(true)}
            >
              {t('housing.tray.start')}
            </button>
            <MannerNoticeDialog
              open={planMannerOpen}
              onCancel={() => setPlanMannerOpen(false)}
              onStart={commitPlanStart}
            />
          </div>
        )}

        {planning && !isMobile && (
          <div className="housing-tour-plan">
            <section className="housing-tour-page-panel" data-region="left">
              <div className="housing-tour-page-col">
                <TourTrayDetailPanel
                  listing={selectedPlanListing}
                  onStartClick={() => setPlanMannerOpen(true)}
                  startDisabled={trayIds.length === 0}
                />
              </div>
            </section>
            <section className="housing-tour-page-panel" data-region="right">
              <div className="housing-tour-page-col">
                <TourTrayBoard
                  listingIds={trayIds}
                  onChange={setTrayIds}
                  selectedId={selectedPlanId}
                  onSelect={setSelectedPlanId}
                />
              </div>
            </section>
            <MannerNoticeDialog
              open={planMannerOpen}
              onCancel={() => setPlanMannerOpen(false)}
              onStart={commitPlanStart}
            />
          </div>
        )}

        <EphemeralAddPanel
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={onAddToTray}
          trayRegion={trayRegionForAdd}
        />
      </>
    );
  }

  // 完了時: 全画面に切り替えず、下の3パネルは inert(操作不可)のまま残し、上に完了オーバーレイを重ねる。
  // 見学した世界を背景に残しつつ、誤操作を防いで「探す/お気に入りに戻る」へ安全に導く。
  const frozen = completed || undefined;

  return (
    <div className="housing-tour-page housing-tour-page--reorg">
      <section className="housing-tour-page-panel" data-region="left" inert={frozen}>
        <div className="housing-tour-page-col">
          <TourShowcasePanel
            currentStep={progress.currentStep}
            nextStep={nextStep}
            onOpenReport={onOpenReport}
          />
        </div>
      </section>

      <section className="housing-tour-page-panel" data-region="center" inert={frozen}>
        <div className="housing-tour-page-col">
          <TourNavMap
            status={mapStatus}
            svg={asset.status === 'ready' ? asset.svg : null}
            viewBox={asset.status === 'ready' ? asset.json.viewBox : null}
            model={mapModel}
            stepKey={currentIndex}
            // originName の解決(家=directions.aetheryte優先/アパート=mapModel.originNameへフォールバック)は
            // useTourRenderModel 内で行い、ここでは結果をそのまま渡すだけ。
            originName={originName}
            crossing={crossing}
            showCrossing={showCrossingOverlay}
            addressListing={currentListing}
            // 実機2回目FB#4: 行き方はスマホ下部バーの1行省略表示だと読み切れないため、
            // スマホの時だけ地図下部の帯へ渡す(teleport/directions の2段構成)。PC は従来通り渡さない。
            footerDirections={isMobile ? footerDirections : null}
            viewingTimerText={viewingTimerText}
            inviteHint={mobileInviteHint}
          />
        </div>
        {isLoggedIn ? (
          <TourInvitePanel
            tourToken={tourToken}
            creating={creatingInvite}
            tourName={tourName}
            onTourNameChange={setTourName}
            onInvite={onInvite}
            onCopy={onCopyInvite}
          />
        ) : (
          <div className="housing-tour-invite housing-tour-invite--login">
            <HousingLoginPrompt context="tour" />
          </div>
        )}
      </section>

      <section className="housing-tour-page-panel" data-region="right" inert={frozen}>
        <div className="housing-tour-page-col">
          <TourProgressPanel
            progress={progress}
            steps={steps}
            currentIndex={currentIndex}
            phase={phase}
            viewStartAt={viewStartAt}
            directions={directions}
            directionsText={directionsText}
            canView={canView}
            isLast={isLast}
            pendingCrossingAck={showCrossingOverlay}
            onPrev={prev}
            onViewStart={startViewing}
            onNext={onPrimary}
            onFinish={onFinish}
          />
        </div>
      </section>

      {/* Task4: スマホ横持ちUI(案A)。左右パネルはCSSで非表示にし、下部バー+縦持ちヒントを追加描画する。
          既存の3パネル/完了オーバーレイのロジックには手を入れない(表示のみの追加レイヤー)。
          実機FB: 見学開始の全画面ショーケースオーバーレイは撤去済み(地図側の経過時間チップに置き換え)。 */}
      {isMobile && listingIds.length > 0 && !completed && (
        <TourMobileBar
          canPrev={currentIndex > 0}
          canView={canView}
          isLast={isLast}
          onPrev={prev}
          onView={startViewing}
          onNext={onPrimary}
          // 実機FB#7: 地図上の招待パネルはスマホでは非表示 (CSS) にして地図を全画面化するため、
          // 招待の入口はバーに一本化する。
          // 2026-08-12 相談: アイコンはログイン状態だけで決める(未ログイン=招待/ログイン済み=リンク)。
          // ログイン済みで未発行の場合も見た目はコピーのままにし、実際の発行は onMobileInviteTap 側で
          // 「未発行なら発行して自動コピーまで一括で行う」ことで文言(右下のボタンでコピー)と挙動を一致させる。
          showInvite
          inviteMode={isLoggedIn ? 'copy' : 'create'}
          onInvite={onMobileInviteTap}
          // 実機2回目FB#7: 行き方が地図下部へ移って空いたバー左端に「終了」ボタンを置く。
          // 既存の onFinish(共有 live の終了処理込み)をそのまま渡すだけ。
          onFinish={onFinish}
        />
      )}

      {completed && (
        <div
          className="housing-tour-complete-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="housing-tour-complete-title"
          data-testid="tour-complete-overlay"
        >
          <div className="housing-tour-complete-card">
            <h1 id="housing-tour-complete-title" className="housing-tour-complete-title">
              {t('housing.tour.nav.complete.title')}
            </h1>
            <p className="housing-tour-complete-lead">{t('housing.tour.nav.complete.lead')}</p>
            <div className="housing-tour-complete-actions">
              <button
                type="button"
                className="housing-tour-complete-btn housing-tour-complete-btn--primary"
                onClick={backToBrowse}
              >
                {t('housing.tour.nav.complete.back_browse')}
              </button>
              <button type="button" className="housing-tour-complete-btn" onClick={backToFavorites}>
                {t('housing.tour.nav.complete.back_favorites')}
              </button>
            </div>
          </div>
        </div>
      )}

      <HousingReportModal open={!!reportId} listingId={reportId ?? ''} onClose={() => setReportId(null)} />
      <TourAddressExposureDialog
        open={pendingInvite !== null}
        hasEphemeral={pendingInvite?.hasEphemeral ?? false}
        onConfirm={onConfirmExpose}
        onCancel={() => setPendingInvite(null)}
      />
    </div>
  );
};
