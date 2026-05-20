import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { HousingRegisterView } from '../register/HousingRegisterView';
import { LoginModal } from '../../LoginModal';
import type { HousingListing } from '../../../types/housing';

export type HousingRegisterModalMode = 'create' | 'edit';

export interface HousingRegisterModalProps {
  open: boolean;
  onClose: () => void;
  /** デフォルト 'create'。 'edit' で編集モード */
  mode?: HousingRegisterModalMode;
  /** mode='edit' の場合に必須。 編集対象の物件 */
  initialValues?: Partial<HousingListing> & { id: string };
}

/**
 * Plan F Task 5: modal shell that wraps Sub-spec 2A's HousingRegisterView.
 * - Logged-in users see the registration form directly.
 * - Logged-out users see a login-required prompt that opens LoginModal.
 * - Replaces the legacy `#register` hash route from HousingWorkspace.
 *
 * Phase 3 (2026-05-21): `mode` + `initialValues` を追加し、 編集モーダルの薄ラッパー
 * (HousingEditModal) からも再利用できるようにした。 既定 mode='create' なので
 * 既存の呼び出し元は無変更で動作する。
 */
export const HousingRegisterModal: React.FC<HousingRegisterModalProps> = ({
  open,
  onClose,
  mode = 'create',
  initialValues,
}) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [loginOpen, setLoginOpen] = useState(false);

  if (!open) return null;

  const titleKey =
    mode === 'edit'
      ? 'housing.edit.modal.title'
      : 'housing.workspace.register_modal.title';

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!user) {
    return (
      <>
        <div
          className="housing-register-modal-backdrop"
          data-variant="login-required"
          onClick={handleBackdropClick}
        >
          <div
            className="housing-register-modal-card"
            data-variant="login-required"
            role="dialog"
            aria-modal="true"
            aria-label={t(titleKey)}
          >
            <div className="housing-register-modal-login-body">
              <div className="housing-register-modal-title">{t(titleKey)}</div>
              <div className="housing-register-modal-login-text">
                {t('housing.workspace.register_modal.login_required')}
              </div>
              <div className="housing-register-modal-login-actions">
                <button
                  type="button"
                  className="housing-register-modal-login-cancel"
                  onClick={onClose}
                >
                  {t('housing.workspace.register_modal.close')}
                </button>
                <button
                  type="button"
                  className="housing-register-modal-login-btn"
                  onClick={() => setLoginOpen(true)}
                >
                  {t('housing.workspace.register_modal.login_button')}
                </button>
              </div>
            </div>
          </div>
        </div>
        <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      </>
    );
  }

  return (
    <div className="housing-register-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="housing-register-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={t(titleKey)}
      >
        <div className="housing-register-modal-head">
          <h2 className="housing-register-modal-title">{t(titleKey)}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('housing.workspace.register_modal.close')}
            className="housing-register-modal-close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="housing-register-modal-body">
          <HousingRegisterView mode={mode} initialValues={initialValues} onClose={onClose} />
        </div>
      </div>
    </div>
  );
};
