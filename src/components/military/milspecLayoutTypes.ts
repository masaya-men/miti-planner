// MilspecLayout の props 型。サイドバー(MilspecSidebar)も一部を使うため分けている
// (MilspecLayout.tsx に置くと MilspecLayout ⇄ MilspecSidebar の型だけの循環 import になる)。
import type React from 'react';

export interface MilspecLayoutProps {
  children: React.ReactNode;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
  isHeaderCollapsed: boolean;
  setIsHeaderCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  partySortOrder: 'light_party' | 'role';
  setPartySortOrder: (o: 'light_party' | 'role') => void;
  onAutoPlan: () => void;
  onImportLogs: () => void;
  statusOpen: boolean;
  setStatusOpen: (open: boolean) => void;
  localImportProps: { isOpen: boolean; plans: unknown[]; onImport: unknown; onClose: () => void };
  /** 初回ログイン: ウェルカムセットアップ画面(標準 Layout.tsx:606 と同じ条件で表示)。 */
  isNewUser: boolean;
  /** リダイレクト認証中オーバーレイの表示可否。呼び出し側で
   *  `isAuthRedirecting && !justLoggedInUser` を計算済みの値として渡す
   *  (justLoggedInUser 自体は型を簡潔にするため MilspecLayout へ渡さない・標準 Layout.tsx:610)。 */
  showAuthRedirecting: boolean;
}
