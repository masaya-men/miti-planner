import { useTranslation } from 'react-i18next';
import { Search, Heart, Plus, User } from 'lucide-react';

export const TopBar: React.FC = () => {
  const { t } = useTranslation();

  return (
    <header
      className="relative z-20 flex items-center justify-between gap-4 px-6 h-14"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.22)',
        color: '#ffffff',
        textShadow: '0 1px 2px rgba(0,0,0,0.55), 0 0 10px rgba(0,0,0,0.32)',
      }}
    >
      <div
        className="flex items-center gap-3 shrink-0"
        role="img"
        aria-label={t('housing.workspace.topbar.logo_alt')}
      >
        <span
          aria-hidden="true"
          className="inline-block rounded-full"
          style={{ width: 10, height: 10, background: '#ffc987' }}
        />
        <span className="text-base font-semibold tracking-wide">
          LoPo<span className="opacity-60 font-normal">&nbsp;/ Housing Tour</span>
        </span>
      </div>

      <div
        className="flex-1 max-w-xl flex items-center gap-2 px-3 py-1.5 rounded-md"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.18)',
        }}
      >
        <Search size={16} className="opacity-60" />
        <input
          type="text"
          placeholder={t('housing.workspace.topbar.search_placeholder')}
          className="bg-transparent outline-none w-full text-sm text-white placeholder-white/55"
        />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{ color: '#ffc987', border: '1px solid rgba(255,201,135,0.4)' }}
        >
          <Plus size={14} />
          {t('housing.workspace.topbar.register')}
        </button>
        <button
          type="button"
          aria-label={t('housing.workspace.topbar.favorites')}
          className="p-2 rounded-md transition-colors hover:bg-white/10"
        >
          <Heart size={18} />
        </button>
        <button
          type="button"
          aria-label={t('housing.workspace.topbar.profile')}
          className="p-2 rounded-md transition-colors hover:bg-white/10"
        >
          <User size={18} />
        </button>
      </div>
    </header>
  );
};
