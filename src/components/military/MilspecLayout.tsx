import React from 'react';
import { MilspecChrome } from './MilspecChrome';
import { MilspecHeader } from './MilspecHeader';
import { MilspecSidebar } from './MilspecSidebar';
import { MilspecToolbar } from './MilspecToolbar';
import { MilspecWorkspace } from './MilspecWorkspace';
import { MilspecFooter } from './MilspecFooter';
import { MilspecTunePanel } from '../dev/MilspecTunePanel';
import { RenderPendingIndicator } from '../RenderPendingIndicator';
import { AetherflowChainPromptModal } from '../AetherflowChainPromptModal';
import { AstrologianDrawChainPromptModal } from '../AstrologianDrawChainPromptModal';
import { LocalImportDialog } from '../LocalImportDialog';
import { ShareImportSheet } from '../ShareImportSheet';
import { LocalDataSafetyAutoPrompt } from '../LocalDataSafetyAutoPrompt';
import { LimitResolutionSheet } from '../LimitResolutionSheet';

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
}

/** themeStyle==='military' && PC のときだけ Layout が返す専用シェル。
 *  実行時ホスト(自動保存/collab/データ復旧)は Layout が分岐前に持つ。ここは見た目 + 配線のみ。 */
export const MilspecLayout: React.FC<MilspecLayoutProps> = (props) => {
  const { children, localImportProps } = props;
  return (
    <div data-app-shell className="milspec-app" data-theme-military>
      <MilspecChrome />
      {/* ゾーン: header(Task 4)/sidebar(Task 5)/toolbar(Task 6)/workspace(Task 3)/footer(Task 7)は実装済。seam は Task 8 でプレースホルダのまま。 */}
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
      <div data-ms-zone="seam" className="milspec-zone-seam" />
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
    </div>
  );
};
