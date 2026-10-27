import { useTranslation } from 'react-i18next';

export const RegisterAutosaveNotice: React.FC<{ postUrl: string; onDiscard: () => void }> = ({ postUrl, onDiscard }) => {
  const { t } = useTranslation();
  return (
    <div className="housing-register-autosave-notice" data-testid="housing-register-autosave-notice">
      <div className="housing-register-autosave-notice-body">
        <p className="housing-register-autosave-notice-text">
          {t('housing.register.autosave.restored')}
        </p>
        {postUrl && (
          <p className="housing-register-autosave-notice-hint">
            {t('housing.register.autosave.sns_refetch')}
          </p>
        )}
      </div>
      <button
        type="button"
        className="housing-register-autosave-discard"
        data-testid="housing-register-autosave-discard"
        onClick={onDiscard}
      >
        {t('housing.register.autosave.discard')}
      </button>
    </div>
  );
};
