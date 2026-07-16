import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';

export interface TourMobileBarProps {
  /** 現在地→目的地の行き方(1行・省略表示)。空文字なら行き方エリアは空欄のまま。 */
  directionsText: string;
  canPrev: boolean;
  canView: boolean;
  isLast: boolean;
  onPrev: () => void;
  onView: () => void;
  onNext: () => void;
  /** true のとき隅に招待ボタンを出す。onInvite 未指定なら描画しない。 */
  showInvite?: boolean;
  onInvite?: () => void;
}

/**
 * スマホ横持ちツアー(案A)の下部操作バー (Task4)。
 *
 * 既存のツアー進行ロジック(前へ/見学/次へ)には一切手を入れず、TourNavPage が既に
 * 算出済みのハンドラ(prev/startViewing/onPrimary)をそのまま呼び出すだけの薄い表示部品。
 * デスクトップの右パネル(TourProgressPanel)と同じラベル(前へ/見学開始/次へ/完了)を
 * 流用し、行き方だけ1行省略で常時見えるようにする。
 */
export const TourMobileBar: React.FC<TourMobileBarProps> = ({
  directionsText,
  canPrev,
  canView,
  isLast,
  onPrev,
  onView,
  onNext,
  showInvite = false,
  onInvite,
}) => {
  const { t } = useTranslation();

  return (
    <div className="housing-tour-mobilebar" data-testid="tour-mobile-bar">
      <span className="housing-tour-mobilebar-directions" title={directionsText}>
        {directionsText}
      </span>

      <div className="housing-tour-mobilebar-actions">
        <button
          type="button"
          className="housing-tour-mobilebar-btn"
          onClick={onPrev}
          disabled={!canPrev}
        >
          {t('housing.tour.nav.actions.prev')}
        </button>
        <button
          type="button"
          className="housing-tour-mobilebar-btn"
          onClick={onView}
          disabled={!canView}
        >
          {t('housing.tour.nav.actions.view')}
        </button>
        <button
          type="button"
          className="housing-tour-mobilebar-btn housing-tour-mobilebar-btn--next"
          onClick={onNext}
        >
          {t(isLast ? 'housing.tour.nav.actions.complete' : 'housing.tour.nav.actions.next')}
        </button>
      </div>

      {showInvite && onInvite && (
        <button
          type="button"
          className="housing-tour-mobilebar-invite"
          onClick={onInvite}
          aria-label={t('housing.tour.nav.invite.button')}
        >
          <UserPlus size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};
