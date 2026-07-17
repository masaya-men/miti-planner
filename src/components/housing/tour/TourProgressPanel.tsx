import { useTranslation } from 'react-i18next';
import { ProgressRing } from './ProgressRing';
import { TourRouteSteps } from './TourRouteSteps';
import { TourPhaseZone } from './TourPhaseZone';
import type { TourProgress, TourStep } from '../../../lib/housing/tourNav';
import type { PlotDirections } from '../../../lib/housing/wardDirections';
import type { TourCrossing } from '../../../lib/housing/tourCrossing';

export interface TourProgressPanelProps {
  progress: TourProgress;
  steps: TourStep[];
  currentIndex: number;
  phase: 'moving' | 'viewing';
  viewStartAt: number | null;
  directions: PlotDirections | null;
  /** 見学ボタンを押せるか(=現在の家が表示できる)。 */
  canView: boolean;
  isLast: boolean;
  /** readOnly 時は操作ハンドラを渡さなくてよい(ボタン自体を描画しないため)。 */
  onPrev?: () => void;
  onViewStart?: () => void;
  onNext?: () => void;
  onFinish?: () => void;
  /** 参加者(readOnly)の「ツアーから出る」。省略時は退出リンクを出さない。 */
  onLeave?: () => void;
  /** 前の家→この家の移動種別。省略時は跨ぎ無し扱い。 */
  crossing?: TourCrossing;
  /**
   * true=参加者の閲覧専用(Task 2.4)。操作3ボタン+(任意)注記+区切り+終了ボタンの塊を
   * 「幹事が案内中」の静かなテキストに置換する。進捗ヘッダー/リング/ステップ一覧/行き方・タイマーは
   * 参加者も見るため readOnly でも従来通り表示する。省略時(false)はホストの既存挙動を完全維持する。
   */
  readOnly?: boolean;
}

/**
 * 右カラム: 進行状況＋操作の司令塔 (表示専用)。
 * ヘッダー(進行状況 + N/M インジケーター) → 縦ステッパー(可能な限り広く・多く) →
 * フェーズ枠(移動中=行き方/見学中=タイマー) → 操作3ボタン(横長・前へ/見学開始/次へ) →
 * (任意) 注記 → ツアーを終了(小さな下線テキスト・最下部)。
 */
export const TourProgressPanel: React.FC<TourProgressPanelProps> = ({
  progress, steps, currentIndex, phase, viewStartAt, directions,
  canView, isLast, onPrev, onViewStart, onNext, onFinish, onLeave,
  crossing = { kind: 'none' }, readOnly = false,
}) => {
  const { t } = useTranslation();
  const { total, percent } = progress;
  // ヘッダーの N/M はリング(1つ前倒し)と揃えて「現在いるステップ / 総数」を表す。
  // 最後のステップで M/M、リングも100% になり整合する(ステップ一覧の現在位置とも一致)。
  const position = Math.min(currentIndex + 1, total);

  return (
    <div className="housing-tour-progress">
      <div className="housing-tour-progress-head">
        <span className="housing-tour-progress-title">{t('housing.tour.nav.progress.label')}</span>
        <span className="housing-tour-progress-count">{position}/{total}</span>
      </div>

      <div className="housing-tour-progress-summary">
        <ProgressRing percent={percent} />
      </div>

      <TourRouteSteps steps={steps} currentIndex={currentIndex} />

      {/* 下部フッター: ステップに上のスペースを譲るため、行き方枠〜操作ボタン〜終了を最下部に密集。
          行き方(フェーズ枠)は常にボタン群の直上に固定。親の gap(16px) から切り離し内部を詰める。 */}
      <div className="housing-tour-progress-foot">
        <TourPhaseZone phase={phase} directions={directions} viewStartAt={viewStartAt} crossing={crossing} />
        {readOnly ? (
          // 参加者(閲覧専用): 操作ボタン群の代わりに「幹事が案内中」+「ツアーから出る」。
          <>
            <p className="housing-tour-progress-readonly-note">{t('housing.tour.join.host_guiding')}</p>
            {onLeave && (
              <button type="button" className="housing-tour-progress-leave" onClick={onLeave}>
                {t('housing.tour.join.leave')}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="housing-tour-progress-actions">
              <button
                type="button"
                className="housing-tour-progress-action housing-tour-progress-action--prev"
                onClick={onPrev}
                disabled={currentIndex === 0}
              >
                {t('housing.tour.nav.actions.prev')}
              </button>
              <button
                type="button"
                className="housing-tour-progress-action housing-tour-progress-action--view"
                onClick={onViewStart}
                disabled={!canView || phase === 'viewing'}
              >
                {t('housing.tour.nav.actions.view')}
              </button>
              <button
                type="button"
                className="housing-tour-progress-action housing-tour-progress-action--next"
                onClick={onNext}
              >
                {t(isLast ? 'housing.tour.nav.actions.complete' : 'housing.tour.nav.actions.next')}
              </button>
            </div>
            <span className="housing-tour-progress-view-note">{t('housing.tour.nav.actions.view_optional')}</span>

            <div className="housing-tour-progress-foot-sep" aria-hidden="true" />
            <button type="button" className="housing-tour-progress-finish" onClick={onFinish}>
              {t('housing.tour.nav.finish')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
