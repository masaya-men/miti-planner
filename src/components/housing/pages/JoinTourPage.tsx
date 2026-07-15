import { useEffect, useMemo, useState } from 'react';
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
 *   - connecting: shared_tours 取得中/live 未到達
 *   - notfound: 招待が存在しない・読めない
 *   - ended: 幹事が共有を終了した / live doc が消えた / 期限切れ → 完了カード(素敵な時間でしたね)
 *   - viewing: 閲覧専用ツアーを描画する状態。幹事(TourNavPage)とほぼ同じ3パネル
 *     (showcase/map/progress)を、操作無し=「幹事が案内中」で描く。
 *     DC/ワールド跨ぎの案内は参加者にも出す(各参加者が自分で「移動しました」を押して消す=#3)。
 */
export const JoinTourPage: React.FC = () => {
  const { tourToken = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { kind, meta, live } = useJoinTour(tourToken);

  // meta.snapshot(縮約データ) → useTourRenderModel が期待する MockListing[] へ写す。
  // meta が無い間(connecting/notfound/ended)は空配列(Hooks は分岐の手前で毎回呼ぶ必要があるため)。
  const pool = useMemo(() => (meta ? meta.snapshot.map(snapshotToPoolListing) : []), [meta]);
  const orderedIds = useMemo(() => (meta ? meta.snapshot.map((s) => s.id) : []), [meta]);
  const model = useTourRenderModel(pool, orderedIds, live?.currentIndex ?? 0);

  // 参加者が「移動しました」を押した live.currentIndex。跨ぎ overlay を自分の判断で消すため。
  // 主催者の ack は届かない(host-local)ので、参加者は各自でこの家への移動を確認して地図を見る(#3)。
  const [ackedIndex, setAckedIndex] = useState<number | null>(null);

  // 参加状態をヘッダーの「ツアーに戻る」ピルへ橋渡し(#1・案い)。viewing で記録し、
  // ended/notfound で解除する(戻る先が無くなるのでピルも消す)。connecting は据え置き(再接続中)。
  const setJoined = useJoinedTourStore((s) => s.setToken);
  const clearJoined = useJoinedTourStore((s) => s.clear);
  useEffect(() => {
    if (kind === 'viewing') setJoined(tourToken);
    else if (kind === 'ended' || kind === 'notfound') clearJoined();
  }, [kind, tourToken, setJoined, clearJoined]);

  // 「ツアーから出る」= 参加記録を消してハウジングトップへ(招待リンクを再度開けば再参加可能)。
  const leave = () => {
    clearJoined();
    navigate('/housing');
  };

  if (kind === 'viewing' && live) {
    // 幹事 TourNavPage の viewing 相当の3パネル構成をそのまま踏襲(操作系は付けない)。
    // 跨ぎ overlay は「跨ぎ有り && 見学前 && この家をまだ ack していない」ときだけ出す(#3)。
    const showCrossing =
      model.crossing.kind !== 'none' && live.phase !== 'viewing' && ackedIndex !== live.currentIndex;
    return (
      <div className="housing-tour-page housing-tour-page--reorg" data-testid="join-tour-viewing">
        <section className="housing-tour-page-panel" data-region="left">
          <div className="housing-tour-page-col">
            <TourShowcasePanel currentStep={model.progress.currentStep} nextStep={model.nextStep} />
          </div>
        </section>

        <section className="housing-tour-page-panel" data-region="center">
          <div className="housing-tour-page-col">
            <TourNavMap
              status={model.mapStatus}
              svg={model.asset.status === 'ready' ? model.asset.svg : null}
              viewBox={model.asset.status === 'ready' ? model.asset.json.viewBox : null}
              model={model.mapModel}
              stepKey={live.currentIndex}
              originName={model.originName}
              crossing={model.crossing}
              showCrossing={showCrossing}
              onAckCrossing={() => setAckedIndex(live.currentIndex)}
              addressListing={model.currentListing}
            />
          </div>
        </section>

        <section className="housing-tour-page-panel" data-region="right">
          <div className="housing-tour-page-col">
            <TourProgressPanel
              readOnly
              onLeave={leave}
              progress={model.progress}
              steps={model.steps}
              currentIndex={live.currentIndex}
              phase={live.phase}
              viewStartAt={live.viewStartAt}
              directions={model.directions}
              canView={false}
              isLast={false}
              crossing={model.crossing}
            />
          </div>
        </section>
      </div>
    );
  }

  // ended = 幹事がツアーを終えた/共有終了/期限切れ → 主催者と同じ「素敵な時間でしたね」を参加者にも(#4)。
  if (kind === 'ended') {
    return (
      <div className="housing-tour-page">
        <section className="housing-tour-page-panel housing-tour-page-panel-solo" data-region="center">
          <div className="housing-tour-complete-card" data-testid="join-tour-complete">
            <h1 className="housing-tour-complete-title">{t('housing.tour.nav.complete.title')}</h1>
            <p className="housing-tour-complete-lead">{t('housing.tour.join.complete_lead')}</p>
          </div>
        </section>
      </div>
    );
  }

  // connecting / notfound は既存の空状態パターン(中央1枚)に倣う。
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
};
