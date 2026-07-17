import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { buildTourPool } from '../../../lib/housing/buildTourPool';
import { orderTourStopIds } from '../../../lib/housing/orderTourStops';
import { tourRegionConflict } from '../../../lib/housing/tourCrossing';
import { useTourRenderModel } from '../../../lib/housing/useTourRenderModel';
import { useElapsed, formatElapsed } from '../../../lib/housing/useElapsed';
import { createSharedTour } from '../../../lib/housingApiClient';
import { buildTourSnapshots, snapshotContainsHiddenAddress } from '../../../lib/sharedTour/snapshot';
import { pushHostState, endHostTour } from '../../../lib/sharedTour/hostSync';
import { TourProgressPanel } from '../tour/TourProgressPanel';
import { TourNavMap } from '../tour/TourNavMap';
import { TourShowcasePanel } from '../tour/TourShowcasePanel';
import { TourEmptyState } from '../tour/TourEmptyState';
import { TourInvitePanel } from '../tour/TourInvitePanel';
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
  const { t } = useTranslation();
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
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);

  const [completed, setCompleted] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  // 共有ツアー同期 (Task 2.1): 幹事が発行した招待の token。null=未発行。
  // mount 時の自動復帰 (localStorage からの token 復帰) は今回スコープ外
  // (設計§7 の同端末復帰は別タスク・stale token 誤表示を避ける)。
  const [tourToken, setTourToken] = useState<string | null>(null);
  // 招待リンク発行中 (create-shared-tour API 応答待ち)。ボタンを「作成中…」にして二重発行も防ぐ。
  const [creatingInvite, setCreatingInvite] = useState(false);
  // 住所露出警告ダイアログの表示に使う「発行待ち」の中身 (非公開/一時追加を含む場合のみ立つ)。
  const [pendingInvite, setPendingInvite] = useState<{ snaps: TourSnapshot[]; hasEphemeral: boolean } | null>(null);

  // spec A-3: 公開一覧 + 自分の登録 (非公開/期限切れ含む) + 一時 listing (計画: 住所登録なし一時ツアー Task2) を合流。
  const pool = useMemo(
    () => buildTourPool(listings, myListings, uid, ephemeral, Date.now()),
    [listings, myListings, uid, ephemeral],
  );
  // ステップ/進捗/次・前の目的地/行き方/跨ぎ/地図モデルの派生一式は共有フックへ抽出済み(Task 2.4)。
  // 参加者ページ(JoinTourPage)と全く同じ orchestration を通す。挙動は抽出前と同一(ロジック無変更)。
  const {
    steps, progress, nextStep, currentListing,
    directions, crossing, mapModel, mapStatus, asset, originName,
  } = useTourRenderModel(pool, listingIds, currentIndex);

  const isLast = currentIndex === listingIds.length - 1;

  // 中央マップの跨ぎ案内カード: 「移動しました」で該当ステップだけ確認済みにして消す(次の跨ぎでまた出す)。
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
    const teleport = t('housing.tour.nav.dest.teleport_to', { aetheryte: directions.aetheryte });
    return { teleport, directions: directions.directions };
  }, [directions, t]);

  // 実機FB: スマホの「見学開始」は全画面ショーケースオーバーレイ(左パネルの代替)を開くと
  // 地図が隠れてしまい実機で不評だったため撤去。地図のエリアに経過時間チップだけを出す方式に変更。
  // 見学中(phase==='viewing')の経過秒を1秒ごとに再計算し、地図側へ整形済み文言だけを渡す
  // (TourNavMap は表示専用・タイマー計算を持ち込まない)。PC は右パネルの既存表示があるため出さない。
  const viewingElapsedSeconds = useElapsed(isMobile && phase === 'viewing' ? viewStartAt : null);
  const viewingTimerText =
    isMobile && phase === 'viewing' && viewStartAt != null
      ? t('housing.tour.nav.viewing.elapsed', { elapsed: formatElapsed(viewingElapsedSeconds) })
      : null;

  const onGoFavorites = useCallback(() => navigate('/housing/favorites'), [navigate]);

  // 空状態の「住所から追加」(計画: 住所登録なし一時ツアー Task3)。
  // パネルで積んだ一時 listing の id はページローカルに保持し、開始時に既存形
  // (orderTourStopIds → setListings → start) でツアーへ確定する。
  const [emptyTrayIds, setEmptyTrayIds] = useState<string[]>([]);
  const onAddEphemeral = useCallback(
    (id: string) => setEmptyTrayIds((prev) => (prev.includes(id) ? prev : [...prev, id])),
    [],
  );
  const onRemoveEphemeral = useCallback(
    (id: string) => setEmptyTrayIds((prev) => prev.filter((x) => x !== id)),
    [],
  );
  const onStartEphemeral = useCallback(() => {
    if (emptyTrayIds.length === 0) return;
    const pool = useEphemeralListingsStore.getState().ephemeralListings;
    const orderedIds = orderTourStopIds(emptyTrayIds, pool);
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
    setEmptyTrayIds([]);
  }, [emptyTrayIds, t]);

  // 共有ツアー同期 (Task 2.1): 幹事の「みんなを招待」発行フロー。
  // 実際の Firestore 書き込み (create-shared-tour) を行う共通処理。
  const doCreate = useCallback(
    async (snaps: TourSnapshot[]) => {
      setCreatingInvite(true);
      try {
        const { tourToken: token } = await createSharedTour(snaps);
        setTourToken(token);
        localStorage.setItem('lopo_shared_tour_token', token);
      } catch {
        showToast(t('housing.tour.nav.invite.error'), 'error');
      } finally {
        setCreatingInvite(false);
      }
    },
    [t],
  );

  // 「みんなを招待」ボタン。非公開/一時追加の家を含む場合は警告ダイアログを挟み、
  // それ以外は確認なしで即発行する。
  const onInvite = useCallback(() => {
    const snaps = buildTourSnapshots(listingIds, pool);
    const hasEphemeral = listingIds.some((id) => ephemeral.some((e) => e.id === id));
    const containsHidden = snapshotContainsHiddenAddress(snaps);
    if (hasEphemeral || containsHidden) {
      setPendingInvite({ snaps, hasEphemeral });
    } else {
      void doCreate(snaps);
    }
  }, [listingIds, pool, ephemeral, doCreate]);

  // 警告ダイアログの「このまま招待する」。
  const onConfirmExpose = useCallback(() => {
    if (pendingInvite) void doCreate(pendingInvite.snaps);
    setPendingInvite(null);
  }, [pendingInvite, doCreate]);

  // 招待リンクをクリップボードへコピー。
  const onCopyInvite = useCallback(() => {
    if (!tourToken) return;
    const url = `${location.origin}/housing/tour/${tourToken}`;
    void navigator.clipboard?.writeText(url);
    showToast(t('housing.tour.nav.invite.copied'), 'success');
  }, [tourToken, t]);

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

  if (listingIds.length === 0) {
    return (
      <div className="housing-tour-page">
        <section className="housing-tour-page-panel housing-tour-page-panel-solo" data-region="center">
          <TourEmptyState
            onGoFavorites={onGoFavorites}
            ephemeralIds={emptyTrayIds}
            onAddEphemeral={onAddEphemeral}
            onRemoveEphemeral={onRemoveEphemeral}
            onStartEphemeral={onStartEphemeral}
          />
        </section>
      </div>
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
            onAckCrossing={onAckCrossing}
            addressListing={currentListing}
            // 実機2回目FB#4: 行き方はスマホ下部バーの1行省略表示だと読み切れないため、
            // スマホの時だけ地図下部の帯へ渡す(teleport/directions の2段構成)。PC は従来通り渡さない。
            footerDirections={isMobile ? footerDirections : null}
            viewingTimerText={viewingTimerText}
          />
        </div>
        <TourInvitePanel
          tourToken={tourToken}
          creating={creatingInvite}
          onInvite={onInvite}
          onCopy={onCopyInvite}
        />
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
            canView={canView}
            isLast={isLast}
            pendingCrossingAck={showCrossingOverlay}
            onPrev={prev}
            onViewStart={startViewing}
            onNext={onPrimary}
            onFinish={onFinish}
            crossing={crossing}
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
          // 招待の入口はバーに一本化する。未発行=作成 / 発行済み=リンクコピー (二重発行はモード切替で防ぐ)。
          showInvite
          inviteMode={tourToken ? 'copy' : 'create'}
          onInvite={tourToken ? onCopyInvite : onInvite}
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
