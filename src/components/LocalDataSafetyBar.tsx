import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlanStore } from '../store/usePlanStore';
import { isLocalSafetySeen, markLocalSafetySeen } from '../utils/localSafetySeen';
import { LocalDataSafetyModal } from './LocalDataSafetyModal';

interface Props {
  /** Sidebar 折りたたみ時 true。 アイコンのみ表示 */
  isCollapsed: boolean;
  /** 説明モーダルから既存バックアップ書き出しモーダルを開く */
  onOpenBackup: () => void;
}

export const LocalDataSafetyBar: React.FC<Props> = ({ isCollapsed, onOpenBackup }) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const planCount = usePlanStore((s) => s.plans.length);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => isLocalSafetySeen());

  // 非ログイン且つ表1件以上のときだけ常設
  if (user || planCount === 0) return null;

  const handleOpen = () => {
    setOpen(true);
    if (!seen) {
      markLocalSafetySeen();
      setSeen(true);
    }
  };

  const handleBackup = () => {
    setOpen(false);
    onOpenBackup();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t('local_safety.bar.aria')}
        className="w-full border-t border-b border-app-text/10 flex items-stretch min-h-9 select-none cursor-pointer hover:bg-app-text/5 transition-colors text-left"
      >
        <span className="shrink-0 px-3 py-1.5 flex items-center text-app-text">
          <span className="relative flex">
            <ShieldAlert size={16} aria-hidden="true" />
            {!seen && (
              <span
                data-testid="local-safety-unread-dot"
                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-app-bg"
                aria-hidden="true"
              />
            )}
          </span>
        </span>
        {!isCollapsed && (
          <span className="flex-1 min-w-0 overflow-hidden py-1.5 flex items-center">
            <span className="text-app-sm text-app-text-muted truncate">{t('local_safety.bar.label')}</span>
          </span>
        )}
      </button>
      <LocalDataSafetyModal isOpen={open} onClose={() => setOpen(false)} onOpenBackup={handleBackup} />
    </>
  );
};
