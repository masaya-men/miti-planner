/**
 * マイページ一覧のワンクリック公開状態切替、確認モーダル。
 * HousingDeleteConfirm.tsx と同型 (backdrop + カード + キャンセル/確認)。
 * private へ切り替えるときだけ「他の人からは見えなくなる」警告を追加する。
 */
import { useTranslation } from 'react-i18next';
import type { HousingVisibilityValue } from './useHousingVisibilityUpdate';

export interface VisibilityConfirmModalProps {
  open: boolean;
  listingTitle: string;
  targetVisibility: HousingVisibilityValue;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export const VisibilityConfirmModal: React.FC<VisibilityConfirmModalProps> = ({
  open,
  listingTitle,
  targetVisibility,
  onCancel,
  onConfirm,
  loading,
}) => {
  const { t } = useTranslation();
  if (!open) return null;
  const targetLabel = t(`housing.register.visibility.${targetVisibility}`);
  return (
    <div className="housing-modal-backdrop" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="housing-delete-confirm-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="housing-delete-confirm-title">{t('housing.mypage.visibilityConfirm.title')}</h2>
        <p className="housing-delete-confirm-target">
          「{listingTitle}」→ {targetLabel}
        </p>
        {targetVisibility === 'private' && (
          <ul className="housing-delete-confirm-body">
            <li>{t('housing.mypage.visibilityConfirm.warningPrivate')}</li>
          </ul>
        )}
        <div className="housing-delete-confirm-actions">
          <button type="button" onClick={onCancel} disabled={loading}>
            {t('housing.mypage.visibilityConfirm.cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}>
            {t('housing.mypage.visibilityConfirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
