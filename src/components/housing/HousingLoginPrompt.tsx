import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoginModal } from '../LoginModal';

interface Props {
  context: 'register' | 'tour' | 'favorite';
}

export const HousingLoginPrompt: React.FC<Props> = ({ context }) => {
  const { t } = useTranslation();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <>
      <div className="max-w-md mx-auto p-6 text-center">
        <p className="text-app-md text-app-text mb-2">
          {t(`housing.login_prompt.${context}.title`)}
        </p>
        <p className="text-app-sm text-app-text-muted mb-4">
          {t(`housing.login_prompt.${context}.lead`)}
        </p>
        <button
          type="button"
          onClick={() => setIsLoginOpen(true)}
          className="inline-block px-6 py-2 rounded-md bg-app-blue text-white hover:bg-app-blue-hover text-app-md"
        >
          {t('housing.login_prompt.open_login')}
        </button>
      </div>
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
};
