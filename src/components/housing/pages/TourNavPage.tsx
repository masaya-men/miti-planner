import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { buildTourPool } from '../../../lib/housing/buildTourPool';
import { useTourRenderModel } from '../../../lib/housing/useTourRenderModel';
import { useElapsed, formatElapsed } from '../../../lib/housing/useElapsed';
import { termLabel } from '../../../lib/housing/housingTerms';
import { pickRegionLocale } from '../../../data/housing/regionMap';
import { endHostTour } from '../../../lib/sharedTour/hostSync';
import { useTourPlanning } from '../tour/useTourPlanning';
import { useTourReplan } from '../tour/useTourReplan';
import { useHostInvite } from '../tour/useHostInvite';
import { useTourExit } from '../tour/useTourExit';
import { TourProgressPanel } from '../tour/TourProgressPanel';
import { TourNavMap } from '../tour/TourNavMap';
import { TourShowcasePanel } from '../tour/TourShowcasePanel';
import { TourInvitePanel } from '../tour/TourInvitePanel';
import { TourPlanningView } from '../tour/TourPlanningView';
import { TourReplanView } from '../tour/TourReplanView';
import { TourCompleteOverlay } from '../tour/TourCompleteOverlay';
import { HousingLoginPrompt } from '../HousingLoginPrompt';
import { TourMobileBar } from '../tour/TourMobileBar';
import { TourAddressExposureDialog } from '../tour/TourAddressExposureDialog';
import { HousingReportModal } from '../report/HousingReportModal';
import './TourNavPage.css';

/**
 * ツアー中(Nav)ページ (Task8): オーケストレーター。
 *
 * store 購読 + データ解決 (useTourRenderModel 経由の resolveTourSteps/computeTourProgress/地図配線) を行い、
 * Task4-7 の表示専用部品 (進行状況パネル/地図/ショーケースパネル/空状態) に渡すだけ。
 * 派生 orchestration は Task 2.4 で `useTourRenderModel` へ抽出し、参加者ページ(JoinTourPage)と共有している。
 * 完了判定はページローカルの `completed` state で表現し、
 * store の `next()` が持つ `currentIndex` の `length-1` クランプ (既存仕様・非破壊) には依存しない。
 * 計画フェーズ/並び替え/完了の表示は tour/ の部品 (TourPlanningView/TourReplanView/TourCompleteOverlay)、
 * 計画フェーズ/並び替え/招待/終わり方の処理は tour/ のフック (useTourPlanning/useTourReplan/
 * useHostInvite/useTourExit) に分けてある。effect の登録順 (計画の選択戻し → 招待の live 同期) を保つため、
 * フックはこの順で呼ぶ。
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
  const phase = useHousingTourStore((s) => s.phase);
  const viewStartAt = useHousingTourStore((s) => s.viewStartAt);
  const startViewing = useHousingTourStore((s) => s.startViewing);

  const listings = useHousingListingsStore((s) => s.listings);
  const myListings = useHousingListingsStore((s) => s.myListings);
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const isLoggedIn = uid !== null;
  const openLogin = useHousingModalStore((s) => s.openLogin);
  const ephemeral = useEphemeralListingsStore((s) => s.ephemeralListings);

  const [completed, setCompleted] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

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

  const replan = useTourReplan(listingIds, currentIndex, pool);
  const { replanning, startReplan } = replan;

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

  const plan = useTourPlanning(pool);

  const {
    tourToken, tourName, setTourName, creatingInvite, pendingInvite, setPendingInvite,
    onInvite, onConfirmExpose, onCopyInvite, onMobileInviteTap,
  } = useHostInvite({
    isLoggedIn, openLogin, listingIds, pool, ephemeral, currentIndex, phase, viewStartAt, crossingAckIndex,
  });

  const { onFinish, backToBrowse, backToFavorites } = useTourExit(tourToken, setCompleted);

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

  // 実行中でない = 計画フェーズ (listingIds は空)。表示は TourPlanningView。
  if (listingIds.length === 0) {
    return <TourPlanningView isMobile={isMobile} plan={plan} onGoFavorites={onGoFavorites} />;
  }

  // 完了時: 全画面に切り替えず、下の3パネルは inert(操作不可)のまま残し、上に完了オーバーレイを重ねる。
  // 見学した世界を背景に残しつつ、誤操作を防いで「探す/お気に入りに戻る」へ安全に導く。
  const frozen = completed || undefined;

  if (replanning) {
    return (
      <TourReplanView isMobile={isMobile} listingIds={listingIds} currentIndex={currentIndex} pool={pool} replan={replan} />
    );
  }

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
            onReorder={completed ? undefined : startReplan}
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
          onReorder={startReplan}
        />
      )}

      {completed && <TourCompleteOverlay onBackBrowse={backToBrowse} onBackFavorites={backToFavorites} />}

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
