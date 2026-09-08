import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MilspecChrome } from './MilspecChrome';
import { MilspecHeader } from './MilspecHeader';
import { MilspecSidebar } from './MilspecSidebar';
import { MilspecToolbar } from './MilspecToolbar';
import { MilspecWorkspace } from './MilspecWorkspace';
import { MilspecFooter } from './MilspecFooter';
import { MilspecSeam } from './MilspecSeam';
import { MilspecTunePanel } from '../dev/MilspecTunePanel';
import { RenderPendingIndicator } from '../RenderPendingIndicator';
import { AetherflowChainPromptModal } from '../AetherflowChainPromptModal';
import { AstrologianDrawChainPromptModal } from '../AstrologianDrawChainPromptModal';
import { LocalImportDialog } from '../LocalImportDialog';
import { ShareImportSheet } from '../ShareImportSheet';
import { LocalDataSafetyAutoPrompt } from '../LocalDataSafetyAutoPrompt';
import { LimitResolutionSheet } from '../LimitResolutionSheet';
import { WelcomeSetup } from '../WelcomeSetup';

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

/** themeStyle==='military' && PC のときだけ Layout が返す専用シェル。
 *  実行時ホスト(自動保存/collab/データ復旧)は Layout が分岐前に持つ。ここは見た目 + 配線のみ。 */
export const MilspecLayout: React.FC<MilspecLayoutProps> = (props) => {
  const { children, localImportProps } = props;
  const { t } = useTranslation();
  return (
    <div data-app-shell className="milspec-app" data-theme-military>
      <MilspecChrome />
      {/* ゾーン: header(Task 4)/sidebar(Task 5)/toolbar(Task 6)/workspace(Task 3)/footer(Task 7)/seam(Task 8)は実装済。 */}
      <div data-ms-zone="header" className="milspec-zone-header">
        <MilspecHeader
          theme={props.theme}
          onToggleTheme={props.onToggleTheme}
          isHeaderCollapsed={props.isHeaderCollapsed}
          setIsHeaderCollapsed={props.setIsHeaderCollapsed}
        />
      </div>
      <div data-ms-zone="sidebar" className="milspec-zone-sidebar" data-open={props.isSidebarOpen ? '' : undefined}>
        <MilspecSidebar
          isSidebarOpen={props.isSidebarOpen}
          onToggleSidebar={props.onToggleSidebar}
          onCloseSidebar={props.onCloseSidebar}
        />
      </div>
      <div data-ms-zone="seam" className="milspec-zone-seam"><MilspecSeam /></div>
      <div data-ms-zone="toolbar" className="milspec-zone-toolbar">
        <MilspecToolbar
          partySortOrder={props.partySortOrder}
          setPartySortOrder={props.setPartySortOrder}
          onAutoPlan={props.onAutoPlan}
          onImportLogs={props.onImportLogs}
          statusOpen={props.statusOpen}
          setStatusOpen={props.setStatusOpen}
        />
      </div>
      <div data-ms-zone="workspace" className="milspec-zone-workspace"><MilspecWorkspace>{children}</MilspecWorkspace></div>
      <div data-ms-zone="footer" className="milspec-zone-footer"><MilspecFooter /></div>

      {/* PC グローバルオーバーレイ(自己ゲート型・非アクティブ時 null)。標準 JSX からは移動しない。 */}
      <RenderPendingIndicator />
      <AetherflowChainPromptModal />
      <AstrologianDrawChainPromptModal />
      <LocalImportDialog isOpen={localImportProps.isOpen} plans={localImportProps.plans as never} onImport={localImportProps.onImport as never} onClose={localImportProps.onClose} />
      <ShareImportSheet />
      <LocalDataSafetyAutoPrompt />
      <LimitResolutionSheet />
      <MilspecTunePanel />

      {/* whole-branch レビュー Important#4: 標準 Layout.tsx:606,610-617 にあった2つの
          グローバルオーバーレイ(初回ログイン / リダイレクト認証中)が MilspecLayout に
          無かった不具合の修正。実装は標準 JSX をそのまま再利用。 */}
      {props.isNewUser && <WelcomeSetup />}
      {props.showAuthRedirecting && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-app-bg">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={28} className="animate-spin text-app-text-muted" />
            <p className="text-app-2xl font-medium text-app-text-muted">{t('login.authenticating')}</p>
          </div>
        </div>
      )}
    </div>
  );
};
