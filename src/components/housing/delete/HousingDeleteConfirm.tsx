/**
 * Phase 3: 家主物件の削除確認ダイアログ。
 *
 * - 削除は soft delete (`deletedAt = Date.now()`) のため、 文言では「30 日後に完全削除」 と明記
 * - 確認・キャンセル両方の disable 状態を loading prop で同期
 * - スタイルは housing.css の token 経由 (`--housing-*`) で記述
 */
import { useTranslation } from 'react-i18next';

export interface HousingDeleteConfirmProps {
  open: boolean;
  listingTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export const HousingDeleteConfirm: React.FC<HousingDeleteConfirmProps> = ({
  open,
  listingTitle,
  onCancel,
  onConfirm,
  loading,
}) => {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="housing-modal-backdrop" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="housing-delete-confirm-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="housing-delete-confirm-title">{t('housing.delete.title')}</h2>
        <p className="housing-delete-confirm-target">「{listingTitle}」</p>
        <ul className="housing-delete-confirm-body">
          <li>{t('housing.delete.body.line1')}</li>
          <li>{t('housing.delete.body.line2')}</li>
          <li>{t('housing.delete.body.line3')}</li>
        </ul>
        <div className="housing-delete-confirm-actions">
          <button type="button" onClick={onCancel} disabled={loading}>
            {t('housing.delete.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="housing-btn-danger"
          >
            {t('housing.delete.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
