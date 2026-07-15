import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useJoinTour } from '../../../lib/sharedTour/useJoinTour';
import { snapshotToPoolListing } from '../../../lib/sharedTour/snapshotToPool';
import { useTourRenderModel } from '../../../lib/housing/useTourRenderModel';
import { useJoinedTourStore } from '../../../store/useJoinedTourStore';
import { TourProgressPanel } from '../tour/TourProgressPanel';
import { TourNavMap } from '../tour/TourNavMap';
import { TourShowcasePanel } from '../tour/TourShowcasePanel';

/**
 * 参加者(未ログイン・匿名)が招待リンク /housing/tour/:tourToken を開いたときのページ。
 * HousingShell の子ルート(標準の匿名安全な骨組み=動画背景/AppHeader/StatusBar を提供)。
 * useJoinTour の kind で分岐する:
 *   - connecting: shared_tours 取得中/live 未到達 → 中央メッセージ
 *   - notfound: 招待が存在しない・読めない → 中央メッセージ
 *   - viewing / ended: 幹事とほぼ同じ3パネル(showcase/map/progress)を閲覧専用で描く。
 *     - 跨ぎ(DC/ワールド移動)案内は主催者が「移動しました」を押した(broadcast された
 *       crossingAckedIndex)ときだけ解除 = 参加者は操作できず主催者操作でだけ地図が出る(#A)。
 *     - ended は主催者と同じ完了オーバーレイ(素敵な時間でしたね)を3パネルの上に重ねる(#B)。
 */
export const JoinTourPage: React.FC = () => {
  const { tourToken = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { kind, meta, live } = useJoinTour(tourToken);

  // meta.snapshot(縮約データ) → useTourRenderModel が期待する MockListing[] へ写す。
  const pool = useMemo(() => (meta ? meta.snapshot.map(snapshotToPoolListing) : []), [meta]);
  const orderedIds = useMemo(() => (meta ? meta.snapshot.map((s) => s.id) : []), [meta]);
  const currentIndex = live?.currentIndex ?? 0;
  const model = useTourRenderModel(pool, orderedIds, currentIndex);

  // 参加状態をヘッダーの「ツアーに戻る」ピルへ橋渡し(#1・案い)。viewing で記録し、
  // ended/notfound で解除する(戻る先が無くなるのでピルも消す)。connecting は据え置き(再接続中)。
  const setJoined = useJoinedTourStore((s) => s.setToken);
  const clearJoined = useJoinedTourStore((s) => s.clear);
  useEffect(() => {
    if (kind === 'viewing') setJoined(tourToken);
    else if (kind === 'ended' || kind === 'notfound') clearJoined();
  }, [kind, tourToken, setJoined, clearJoined]);

  // 「出る」= 参加記録を消して指定先へ(招待リンクを再度開けば再参加可能)。
  const leave = (to: string) => {
    clearJoined();
    navigate(to);
  };

  // connecting / notfound は中央1枚のメッセージ。
  if (kind === 'connecting' || kind === 'notfound') {
    const message =
      kind === 'connecting' ? t('housing.tour.join.connecting') : t('housing.tour.join.notfound');
    return (
      <div className="housing-tour-page">
        <section className="housing-tour-page-panel housing-tour-page-panel-solo" data-region="center">
          <div className="housing-tour-empty">
            <p className="housing-tour-empty-title">{message}</p>
          </div>
        </section>
      </div>
    );
  }

  // viewing / ended = 幹事の3パネル構成をそのまま踏襲(操作系は付けない)。
  const isEnded = kind === 'ended';
  const phase = live?.phase ?? 'moving';
  // 跨ぎ overlay: 主催者が「移動しました」で ack した(broadcast=crossingAckedIndex が currentIndex に
  // 一致した)ときだけ解除。参加者は自分で ack できない(crossingReadOnly)。ended では出さない。
  const showCrossing =
    !isEnded &&
    model.crossing.kind !== 'none' &&
    phase !== 'viewing' &&
    (live?.crossingAckedIndex ?? null) !== currentIndex;

  return (
    <div
      className="housing-tour-page housing-tour-page--reorg"
      data-testid={isEnded ? 'join-tour-ended' : 'join-tour-viewing'}
    >
      <section className="housing-tour-page-panel" data-region="left" inert={isEnded || undefined}>
        <div className="housing-tour-page-col">
          <TourShowcasePanel currentStep={model.progress.currentStep} nextStep={model.nextStep} />
        </div>
      </section>

      <section className="housing-tour-page-panel" data-region="center" inert={isEnded || undefined}>
        <div className="housing-tour-page-col">
          <TourNavMap
            status={model.mapStatus}
            svg={model.asset.status === 'ready' ? model.asset.svg : null}
            viewBox={model.asset.status === 'ready' ? model.asset.json.viewBox : null}
            model={model.mapModel}
            stepKey={currentIndex}
            originName={model.originName}
            crossing={model.crossing}
            showCrossing={showCrossing}
            crossingReadOnly
            addressListing={model.currentListing}
          />
        </div>
      </section>

      <section className="housing-tour-page-panel" data-region="right" inert={isEnded || undefined}>
        <div className="housing-tour-page-col">
          <TourProgressPanel
            readOnly
            onLeave={() => leave('/housing')}
            progress={model.progress}
            steps={model.steps}
            currentIndex={currentIndex}
            phase={phase}
            viewStartAt={live?.viewStartAt ?? null}
            directions={model.directions}
            canView={false}
            isLast={false}
            crossing={model.crossing}
          />
        </div>
      </section>

      {/* ended = 主催者と同じ完了オーバーレイ(素敵な時間でしたね)を重ねる(#B)。
          ゲストも「探す/お気に入りに戻る」で移動でき、離脱時に参加記録をクリアする。 */}
      {isEnded && (
        <div
          className="housing-tour-complete-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="join-tour-complete-title"
          data-testid="join-tour-complete"
        >
          <div className="housing-tour-complete-card">
            <h1 id="join-tour-complete-title" className="housing-tour-complete-title">
              {t('housing.tour.nav.complete.title')}
            </h1>
            <p className="housing-tour-complete-lead">{t('housing.tour.join.complete_lead')}</p>
            <div className="housing-tour-complete-actions">
              <button
                type="button"
                className="housing-tour-complete-btn housing-tour-complete-btn--primary"
                onClick={() => leave('/housing')}
              >
                {t('housing.tour.nav.complete.back_browse')}
              </button>
              <button
                type="button"
                className="housing-tour-complete-btn"
                onClick={() => leave('/housing/favorites')}
              >
                {t('housing.tour.nav.complete.back_favorites')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
