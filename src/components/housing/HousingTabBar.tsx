import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { LogIn } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { useAuthStore } from '../../store/useAuthStore';
import { LoginModal } from '../LoginModal';

export type HousingTab = 'search' | 'tour' | 'register';

interface Props {
  activeTab: HousingTab;
  onChange: (tab: HousingTab) => void;
}

const iconBtnBase =
  'group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95';
const hoverInvert =
  'hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text';
const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

export const HousingTabBar: React.FC<Props> = ({ activeTab, onChange }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const profileDisplayName = useAuthStore((s) => s.profileDisplayName);
  const profileAvatarUrl = useAuthStore((s) => s.profileAvatarUrl);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const tabs: { id: HousingTab; labelKey: string }[] = [
    { id: 'search', labelKey: 'housing.tabs.search' },
    { id: 'tour', labelKey: 'housing.tabs.tour' },
    { id: 'register', labelKey: 'housing.tabs.register' },
  ];

  return (
    <>
      <div role="tablist" className="flex border-b border-app-border bg-app-surface">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={`flex-1 py-3 text-app-md font-medium tracking-wider transition-colors ${
                active
                  ? 'text-app-text border-b-2 border-app-text'
                  : 'text-app-text-muted hover:text-app-text'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
        <div className="flex items-center px-3 shrink-0">
          <Tooltip content={user ? (profileDisplayName || 'Account') : t('app.sign_in') || 'Sign In'}>
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className={clsx(iconBtnBase, iconBtnDefault)}
            >
              {profileAvatarUrl ? (
                <img src={profileAvatarUrl} alt="" className="w-6 h-6 rounded-full" />
              ) : user ? (
                <div className="w-6 h-6 rounded-full bg-app-text/15 flex items-center justify-center">
                  <span className="text-app-base font-black text-app-text">
                    {(profileDisplayName || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              ) : (
                <LogIn size={16} />
              )}
            </button>
          </Tooltip>
        </div>
      </div>
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  );
};
