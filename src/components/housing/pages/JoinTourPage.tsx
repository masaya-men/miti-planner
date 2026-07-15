import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useJoinTour } from '../../../lib/sharedTour/useJoinTour';

/**
 * 参加者(未ログイン・匿名)が招待リンク /housing/tour/:tourToken を開いたときのページ。
 * HousingShell の子ルート(標準の匿名安全な骨組み=動画背景/AppHeader/StatusBar を提供)。
 * useJoinTour の kind で分岐する:
 *   - connecting: shared_tours 取得中/live 未到達
 *   - notfound: 招待が存在しない・読めない
 *   - ended: 幹事が共有を終了した / live doc が消えた / 期限切れ
 *   - viewing: 閲覧専用ツアーを描画する状態。中身は Task 2.4 が meta.snapshot + live で埋める。
 */
export const JoinTourPage: React.FC = () => {
  const { tourToken = '' } = useParams();
  const { t } = useTranslation();
  const { kind /*, meta, live */ } = useJoinTour(tourToken);

  if (kind === 'viewing') {
    // Task 2.4: meta.snapshot + live から閲覧専用ツアーを描画する。今回は空のプレースホルダのみ。
    return <div className="housing-tour-page housing-tour-page--reorg" data-testid="join-tour-viewing" />;
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
