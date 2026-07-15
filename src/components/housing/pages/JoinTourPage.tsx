import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useJoinTour } from '../../../lib/sharedTour/useJoinTour';
import { snapshotToPoolListing } from '../../../lib/sharedTour/snapshotToPool';
import { useTourRenderModel } from '../../../lib/housing/useTourRenderModel';
import { TourProgressPanel } from '../tour/TourProgressPanel';
import { TourNavMap } from '../tour/TourNavMap';
import { TourShowcasePanel } from '../tour/TourShowcasePanel';

/**
 * 参加者(未ログイン・匿名)が招待リンク /housing/tour/:tourToken を開いたときのページ。
 * HousingShell の子ルート(標準の匿名安全な骨組み=動画背景/AppHeader/StatusBar を提供)。
 * useJoinTour の kind で分岐する:
 *   - connecting: shared_tours 取得中/live 未到達
 *   - notfound: 招待が存在しない・読めない
 *   - ended: 幹事が共有を終了した / live doc が消えた / 期限切れ
 *   - viewing: 閲覧専用ツアーを描画する状態(Task 2.4)。幹事(TourNavPage)とほぼ同じ3パネル
 *     (showcase/map/progress)を、操作無し=「幹事が案内中」で描く。データは meta.snapshot(不変) +
 *     live(頻繁更新) から。派生の組み立ては幹事と共通の useTourRenderModel を使う。
 */
export const JoinTourPage: React.FC = () => {
  const { tourToken = '' } = useParams();
  const { t } = useTranslation();
  const { kind, meta, live } = useJoinTour(tourToken);

  // meta.snapshot(縮約データ) → useTourRenderModel が期待する MockListing[] へ写す。
  // meta が無い間(connecting/notfound/ended)は空配列(Hooks は分岐の手前で毎回呼ぶ必要があるため)。
  const pool = useMemo(() => (meta ? meta.snapshot.map(snapshotToPoolListing) : []), [meta]);
  const orderedIds = useMemo(() => (meta ? meta.snapshot.map((s) => s.id) : []), [meta]);
  const model = useTourRenderModel(pool, orderedIds, live?.currentIndex ?? 0);

  if (kind === 'viewing' && live) {
    // 幹事 TourNavPage の viewing 相当の3パネル構成をそのまま踏襲(操作系は付けない)。
    // 中央マップは showCrossing=false(参加者は跨ぎ overlay を出さない=幹事が phase を駆動する前提)。
    // 招待オーバーレイ・完了オーバーレイ・report modal は参加者ページには付けない。
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
              showCrossing={false}
            />
          </div>
        </section>

        <section className="housing-tour-page-panel" data-region="right">
          <div className="housing-tour-page-col">
            <TourProgressPanel
              readOnly
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

  const message =
    kind === 'connecting'
      ? t('housing.tour.join.connecting')
      : kind === 'notfound'
        ? t('housing.tour.join.notfound')
        : t('housing.tour.join.ended');

  // connecting/notfound/ended は既存の空状態パターン(TourEmptyState と同じ中央1枚+ヘアライン注記)に倣う。
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
