// ジョイナー(招かれた参加者)専用の表示専用ヘッダー。
// ⚠ usePlanStore / 自動保存 / localStorage に一切触れない(漏洩防止の不変条件を守る)。
// 内容は LoPo ブランド + 言語切替 + テーマ切替のみ。ジョブ/ステータス編集は配線しない(表示用)。
import { useThemeStore } from '../store/useThemeStore';
import { Sun, Moon } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

export function CollabJoinerHeader() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <header className="shrink-0 h-12 px-4 flex items-center justify-between border-b border-app-border bg-app-bg">
      <span className="font-bold text-app-text">LoPo</span>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <button
          aria-label="toggle-theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 rounded hover:bg-app-surface transition-colors active:scale-90"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
}
