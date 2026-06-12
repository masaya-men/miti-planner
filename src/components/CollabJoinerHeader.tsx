// ジョイナー(招かれた参加者)専用ヘッダー。
// ⚠ usePlanStore / 自動保存 / localStorage に一切触れない(漏洩防止の不変条件を守る)。
// コンテンツ名は useCollabJoinerSession の contentId から解決(usePlanStore 非依存)。
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useCollabJoinerSession } from '../store/useCollabJoinerSession';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import { Sun, Moon, LogIn, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PresenceControls } from './collab/PresenceControls';

interface CollabJoinerHeaderProps {
  onOpenLogin: () => void;
}

export function CollabJoinerHeader({ onOpenLogin }: CollabJoinerHeaderProps) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const contentLanguage = useThemeStore((s) => s.contentLanguage);
  const user = useAuthStore((s) => s.user);
  const profileDisplayName = useAuthStore((s) => s.profileDisplayName);
  const profileAvatarUrl = useAuthStore((s) => s.profileAvatarUrl);
  const contentId = useCollabJoinerSession((s) => s.contentId);
  const { t } = useTranslation();

  // コンテンツ名をコンテンツIDから解決(ConsolidatedHeader と同じロジック)
  const addWaEiSpace = (text: string): string =>
    text
      .replace(/([　-鿿豈-﫿])([A-Za-z0-9])/g, '$1 $2')
      .replace(/([A-Za-z0-9])([　-鿿豈-﫿])/g, '$1 $2');

  const contentDef = contentId ? getContentById(contentId) : null;
  const rawContentLabel = contentDef ? getPhaseName(contentDef.name, contentLanguage) : null;
  const contentLabel =
    rawContentLabel && contentLanguage === 'ja' ? addWaEiSpace(rawContentLabel) : rawContentLabel;

  return (
    <header className="shrink-0 min-h-12 px-4 py-1.5 flex items-center justify-between border-b border-app-border bg-app-bg gap-3">
      {/* 左: ブランド + コンテンツ名 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-bold text-app-text shrink-0">LoPo</span>
        {contentLabel && (
          <>
            <span className="text-app-text-muted shrink-0">/</span>
            <span className="text-app-text-muted text-app-sm truncate">{contentLabel}</span>
          </>
        )}
      </div>

      {/* 右: プレゼンスコントロール + ログインボタン + テーマ + 言語 */}
      <div className="flex items-center gap-2 shrink-0">
        {/* カーソル/ジョブ共有コントロール */}
        <div className="glass-tier2 rounded-xl px-2.5 py-1.5">
          <PresenceControls />
        </div>

        {/* ログイン / アカウントボタン */}
        {user ? (
          <button
            aria-label="account"
            onClick={onOpenLogin}
            className="group w-9 h-9 rounded-full border border-app-border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95 bg-transparent text-app-text hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text overflow-hidden"
            title={profileDisplayName || t('login.title')}
          >
            {profileAvatarUrl ? (
              <img src={profileAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={16} />
            )}
          </button>
        ) : (
          <button
            aria-label="login"
            onClick={onOpenLogin}
            className="group flex items-center gap-1.5 px-3 h-9 rounded-full border border-app-border text-app-text text-app-sm font-medium transition-all duration-300 cursor-pointer active:scale-95 bg-transparent hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text"
          >
            <LogIn size={14} className="shrink-0" />
            <span>{t('login.title')}</span>
          </button>
        )}

        {/* テーマ切替 */}
        <button
          aria-label="toggle-theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 rounded hover:bg-app-surface transition-colors active:scale-90 cursor-pointer"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <LanguageSwitcher />
      </div>
    </header>
  );
}
