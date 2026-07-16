import { useTranslation } from 'react-i18next';
import { Link2, UserPlus } from 'lucide-react';

export interface TourMobileBarProps {
  /** 現在地→目的地の行き方(1行・省略表示)。
   *  実機2回目FB#4: 行き方は地図下部の帯(TourNavMap の footerDirections)へ移設したため、
   *  現在は呼び出し側が渡さない(optional)。渡された場合のみ従来通りバーに表示する。 */
  directionsText?: string;
  canPrev: boolean;
  canView: boolean;
  isLast: boolean;
  onPrev: () => void;
  onView: () => void;
  onNext: () => void;
  /** true のとき隅に招待ボタンを出す。onInvite 未指定なら描画しない。 */
  showInvite?: boolean;
  onInvite?: () => void;
  /**
   * 招待ボタンの意味 (実機FB#7)。'create'(既定)=招待リンクを発行 / 'copy'=発行済みリンクをコピー。
   * スマホでは地図上の招待パネルを隠すため、発行後のコピー導線もこのバーが担う。
   */
  inviteMode?: 'create' | 'copy';
  /**
   * true のとき操作系(前へ/見学/次へ/招待/終了)を一切描画せず、行き方テキストのみ表示する(Task5)。
   * 共有ツアーの参加者(幹事に追従するだけ・自分では進行できない)向け。
   */
  readOnly?: boolean;
  /**
   * ツアー終了ボタンの押下ハンドラ (実機2回目FB#7)。行き方が地図下部へ移って空いたバー左端に置く。
   * 未指定なら描画しない。誤タップ対策の確認ダイアログは持たない(完了オーバーレイと違い誤操作リスクは低いため)。
   */
  onFinish?: () => void;
}

/**
 * スマホ横持ちツアー(案A)の下部操作バー (Task4)。
 *
 * 既存のツアー進行ロジック(前へ/見学/次へ)には一切手を入れず、TourNavPage が既に
 * 算出済みのハンドラ(prev/startViewing/onPrimary)をそのまま呼び出すだけの薄い表示部品。
 * デスクトップの右パネル(TourProgressPanel)と同じラベル(前へ/見学開始/次へ/完了/終了)を流用する。
 *
 * readOnly(Task5): 共有ツアーの参加者は幹事に追従するだけで自分では進行できないため、
 * 操作ボタン(前へ/見学/次へ/招待/終了)を一切描画せず行き方テキストのみのバーにする。
 *
 * 実機2回目FB#4/#7: 行き方は地図下部の帯(TourNavMap の footerDirections)へ移設したため、
 * このバーでは表示しなくなった(directionsText は互換のため optional で残す)。
 * 空いたバー左端には「終了」ボタン(onFinish)を置く。
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
  inviteMode = 'create',
  readOnly = false,
  onFinish,
}) => {
  const { t } = useTranslation();

  return (
    <div className="housing-tour-mobilebar" data-testid="tour-mobile-bar">
      {!readOnly && onFinish && (
        <button
          type="button"
          className="housing-tour-mobilebar-btn housing-tour-mobilebar-btn--finish"
          onClick={onFinish}
        >
          {t('housing.tour.nav.finish')}
        </button>
      )}

      {directionsText !== undefined && (
        <span className="housing-tour-mobilebar-directions" title={directionsText}>
          {directionsText}
        </span>
      )}

      {!readOnly && (
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
      )}

      {!readOnly && showInvite && onInvite && (
        <button
          type="button"
          className="housing-tour-mobilebar-invite"
          onClick={onInvite}
          aria-label={t(
            inviteMode === 'copy'
              ? 'housing.tour.nav.invite.copy'
              : 'housing.tour.nav.invite.button',
          )}
        >
          {inviteMode === 'copy' ? (
            <Link2 size={16} aria-hidden="true" />
          ) : (
            <UserPlus size={16} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
};
