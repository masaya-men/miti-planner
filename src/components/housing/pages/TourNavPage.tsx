import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { buildTourPool } from '../../../lib/housing/buildTourPool';
import { orderTourStopIds } from '../../../lib/housing/orderTourStops';
import { resolveTourSteps, computeTourProgress } from '../../../lib/housing/tourNav';
import { resolveWardMapRef } from '../../../lib/housing/resolveWardMapRef';
import { getPlotDirections } from '../../../lib/housing/wardDirections';
import { useWardMapAsset } from '../../../lib/housing/useWardMapAsset';
import { buildTourMapPlacements } from '../../../lib/housing/buildTourMapPlacements';
import { crossingBetween, tourRegionConflict, type TourCrossing } from '../../../lib/housing/tourCrossing';
import { TourProgressPanel } from '../tour/TourProgressPanel';
import { TourNavMap } from '../tour/TourNavMap';
import { TourShowcasePanel } from '../tour/TourShowcasePanel';
import { TourEmptyState } from '../tour/TourEmptyState';
import { HousingReportModal } from '../report/HousingReportModal';
import { showToast } from '../../Toast';
import type { MockListing } from '../../../data/housing/mockListings';

/**
 * ツアー中(Nav)ページ (Task8): オーケストレーター。
 *
 * store 購読 + データ解決 (resolveTourSteps/computeTourProgress/地図配線) を行い、
 * Task4-7 の表示専用部品 (進行状況パネル/地図/ショーケースパネル/空状態) に渡すだけ。
 * 完了判定はページローカルの `completed` state で表現し、
 * store の `next()` が持つ `currentIndex` の `length-1` クランプ (既存仕様・非破壊) には依存しない。
 */
export const TourNavPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

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

  // spec A-3: 公開一覧 + 自分の登録 (非公開/期限切れ含む) + 一時 listing (計画: 住所登録なし一時ツアー Task2) を合流。
  const pool = useMemo(
    () => buildTourPool(listings, myListings, uid, ephemeral, Date.now()),
    [listings, myListings, uid, ephemeral],
  );
  const steps = useMemo(() => resolveTourSteps(listingIds, pool), [listingIds, pool]);
  const progress = useMemo(
    () => computeTourProgress(steps, currentIndex),
    [steps, currentIndex],
  );

  const isLast = currentIndex === listingIds.length - 1;

  // 次の目的地(左パネルの生きたカード用) / 前の目的地(跨ぎ判定用) / 行き方(右パネル移動中) / 見学可否。
  const nextStep = useMemo(
    () => (currentIndex + 1 < steps.length ? steps[currentIndex + 1] : null),
    [steps, currentIndex],
  );
  const prevStep = useMemo(
    () => (currentIndex - 1 >= 0 ? steps[currentIndex - 1] : null),
    [steps, currentIndex],
  );

  // 地図 (全5エリア対応): 現在の目的地の住所 → 表示すべきワード地図 mapKey を解決し、
  // そのマップだけ遅延ロード。ready になったら実エーテライト起点→家のゴージャス経路モデルを組む。
  const currentListing = progress.currentStep?.listing ?? null;
  const directions = useMemo(
    () => getPlotDirections(currentListing?.area ?? '', currentListing?.plot),
    [currentListing],
  );
  // 前の家→この家の移動種別(DC/ワールド跨ぎ)。行き方枠(右パネル)+中央マップのぼかし案内へ渡す。
  const crossing: TourCrossing = useMemo(
    () => (currentListing ? crossingBetween(prevStep?.listing ?? null, currentListing) : { kind: 'none' }),
    [prevStep, currentListing],
  );
  // 中央マップの跨ぎ案内カード: 「移動しました」で該当ステップだけ確認済みにして消す(次の跨ぎでまた出す)。
  // 見学中(viewing)は必ず解除する = 見学=既に現地に着いている前提。未 ack のまま「見学開始」を
  // 押しても地図(光る区画)が見えるようにする(見学中もぼかしが残る不具合の防止)。
  const [crossingAckIndex, setCrossingAckIndex] = useState<number | null>(null);
  const showCrossingOverlay =
    crossing.kind !== 'none' && crossingAckIndex !== currentIndex && phase !== 'viewing';
  const onAckCrossing = useCallback(() => setCrossingAckIndex(currentIndex), [currentIndex]);
  const canView = currentListing != null;
  const mapRef = useMemo(
    () =>
      currentListing
        ? resolveWardMapRef(
            currentListing.area ?? '',
            currentListing.plot ?? null,
            currentListing.apartmentBuilding ?? null,
            currentListing.buildingType,
          )
        : null,
    [currentListing],
  );
  const asset = useWardMapAsset(mapRef?.mapKey ?? null);
  const mapModel = useMemo(
    () =>
      asset.status === 'ready' && mapRef
        ? buildTourMapPlacements(asset.json, mapRef.mapKey, mapRef, currentListing, steps, currentIndex)
        : null,
    [asset, mapRef, currentListing, steps, currentIndex],
  );
  const mapStatus: 'none' | 'loading' | 'ready' | 'error' = !mapRef
    ? 'none'
    : asset.status === 'ready'
      ? 'ready'
      : asset.status === 'error'
        ? 'error'
        : 'loading';

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

  const onFinish = useCallback(() => {
    stop();
    exitTourMode();
    reset();
    navigate('/housing');
  }, [stop, exitTourMode, reset, navigate]);

  const backToBrowse = useCallback(() => {
    stop();
    exitTourMode();
    reset();
    setCompleted(false);
    navigate('/housing');
  }, [stop, exitTourMode, reset, navigate]);

  const backToFavorites = useCallback(() => {
    stop();
    exitTourMode();
    reset();
    setCompleted(false);
    navigate('/housing/favorites');
  }, [stop, exitTourMode, reset, navigate]);

  const onPrimary = useCallback(() => {
    // L: 跨ぎ(DCトラベル/ワールド訪問)のぼかしオーバーレイ表示中は、「次へ」の1回目で
    // 「移動しました(地図を見る)」と同じ ack を行い、ぼかしを解除して地図を見せる (ステップは進めない)。
    // ack 済み(オーバーレイ非表示)なら従来通り前進する。ユーザーは同じ「次へ」を押し続けるだけで進める。
    if (showCrossingOverlay) {
      onAckCrossing();
      return;
    }
    if (isLast) setCompleted(true);
    else next();
  }, [showCrossingOverlay, onAckCrossing, isLast, next]);

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
            // 名前ラベルの源: 家は正典 directions.aetheryte、アパートは plot が無く directions が引けないため
            // 起点解決済みの mapModel.originName にフォールバック(マーカーと同じ最寄りエーテライト名)。
            originName={directions?.aetheryte ?? mapModel?.originName ?? null}
            crossing={crossing}
            showCrossing={showCrossingOverlay}
            onAckCrossing={onAckCrossing}
          />
        </div>
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
            onPrev={prev}
            onViewStart={startViewing}
            onNext={onPrimary}
            onFinish={onFinish}
            crossing={crossing}
          />
        </div>
      </section>

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
    </div>
  );
};
