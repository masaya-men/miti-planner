/**
 * 住所露出警告ダイアログ
 *
 * 幹事が非公開／一時追加の家を含むツアーの招待リンクを発行しようとした直前に出す確認ダイアログ。
 * - 純粋な表示部品。onConfirm/onCancel を呼ぶだけで、実際の招待発行 (createSharedTour 等) の
 *   配線は呼び出し側 (TourNavPage) が担う。
 * - `hasEphemeral` が true のときだけ「持ち主の許可を…」の注記を、本文とヘアラインで区切って足す。
 * - ハウジングのトンマナ(ガラス面＋ハニーのアイコンバッジ)に寄せた見た目。portal 不使用・
 *   housing-modal-backdrop・role="dialog"。
 */
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';

export interface TourAddressExposureDialogProps {
  open: boolean;
  /** 一時追加(ephemeral)の家が含まれるか。true のとき「持ち主の許可を…」の一文を足す。 */
  hasEphemeral: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TourAddressExposureDialog: React.FC<TourAddressExposureDialogProps> = ({
  open,
  hasEphemeral,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="housing-modal-backdrop" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="housing-tour-expose-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="housing-tour-expose-head">
          <span className="housing-tour-expose-icon" aria-hidden="true">
            <Eye size={20} />
          </span>
          <h2 className="housing-tour-expose-title">
            {t('housing.tour.nav.invite.warning.title')}
          </h2>
        </div>
        <p className="housing-tour-expose-body">{t('housing.tour.nav.invite.warning.body')}</p>
        {hasEphemeral && (
          <p className="housing-tour-expose-note">
            {t('housing.tour.nav.invite.warning.ephemeral_note')}
          </p>
        )}
        <div className="housing-tour-expose-actions">
          <button type="button" className="housing-tour-expose-cancel" onClick={onCancel}>
            {t('housing.tour.nav.invite.warning.cancel')}
          </button>
          <button type="button" onClick={onConfirm} className="housing-btn-primary">
            {t('housing.tour.nav.invite.warning.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
