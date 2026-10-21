import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useMilspecFonts } from './useMilspecFonts';
import { MilspecBackdropVideo } from './MilspecBackdropVideo';
import { MilspecHeader } from './MilspecHeader';
import { MilspecSidebar } from './MilspecSidebar';
import { MilspecToolbar } from './MilspecToolbar';
import { MilspecWorkspace } from './MilspecWorkspace';
import { MilspecFooter } from './MilspecFooter';
import { MilspecRail } from './MilspecRail';
import { startAmbient } from './fx/engine';
import { relayoutZones } from './relayout';
import { headerScale } from './headerGeometry';
import { useReducedMotion } from '../../lib/housing/useReducedMotion';
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
  useMilspecFonts();
  // 常時の光(見本どおり 0.8〜2.5 秒ごと)。アンマウントで止める
  useEffect(() => startAmbient(), []);

  const appRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // ヘッダー区画の実幅を測って --ms-hs(縮小率)を .milspec-app に入れる(再描画せず直接書く)
  useLayoutEffect(() => {
    const app = appRef.current, hz = headerRef.current;
    if (!app || !hz) return;
    const apply = (w: number) => app.style.setProperty('--ms-hs', String(Number((w > 0 ? headerScale(w) : 1).toFixed(4))));
    apply(hz.getBoundingClientRect().width);
    const ro = new ResizeObserver((es) => { const w = es[es.length - 1]?.contentRect.width; if (typeof w === 'number') apply(w); });
    ro.observe(hz);
    return () => ro.disconnect();
  }, []);

  // ヘッダーの開閉は他の区画が滑る動き付きで行う(relayoutZones)。最新の畳み状態は ref で参照
  const collapsedRef = useRef(props.isHeaderCollapsed);
  collapsedRef.current = props.isHeaderCollapsed;
  const { setIsHeaderCollapsed } = props;
  const setCollapsedAnimated: React.Dispatch<React.SetStateAction<boolean>> = useCallback((v) => {
    const next = typeof v === 'function' ? v(collapsedRef.current) : v;
    const app = appRef.current;
    if (!app) { setIsHeaderCollapsed(next); return; }
    relayoutZones(app, () => flushSync(() => setIsHeaderCollapsed(next)), 'hdr', reduced);
  }, [setIsHeaderCollapsed, reduced]);

  return (
    <div ref={appRef} data-app-shell className="milspec-app" data-theme-military>
      <MilspecBackdropVideo />
      {/* ゾーン: header(Task 4)/sidebar(Task 5)/toolbar(Task 6)/workspace(Task 3)/footer(Task 7)/rail は実装済。 */}
      {/* masaya 2026-09-14 確定: header ゾーンの高さは今までどおり(clamp 76-90px)据え置きで、
          その中を縦に 2 段(上=MilspecHeader を少し薄く/下=MilspecToolbar を薄い帯で)に積む。
          標準 ConsolidatedHeader の Layer A(h-12)+ Layer B(h-12)を 1 つの折りたたみ容器に
          収めているのと同じ形(横に並べるのではなく縦積み・合計高さを増やさない)。 */}
      <div ref={headerRef} data-ms-zone="header" className="milspec-zone-header" data-collapsed={props.isHeaderCollapsed ? '' : undefined}>
        <div className="milspec-hs-box">
        <MilspecHeader
          theme={props.theme}
          onToggleTheme={props.onToggleTheme}
          isHeaderCollapsed={props.isHeaderCollapsed}
          setIsHeaderCollapsed={setCollapsedAnimated}
        />
        <MilspecToolbar
          partySortOrder={props.partySortOrder}
          setPartySortOrder={props.setPartySortOrder}
          onAutoPlan={props.onAutoPlan}
          onImportLogs={props.onImportLogs}
          statusOpen={props.statusOpen}
          setStatusOpen={props.setStatusOpen}
        />
        </div>
      </div>
      {/* 通気口の区画(中身は Task 9 以降)。縮小用の内箱は区画ごとに持つ */}
      <div data-ms-zone="vent" className="milspec-zone-vent"><div className="milspec-hs-box" /></div>
      <div data-ms-zone="sidebar" className="milspec-zone-sidebar" data-open={props.isSidebarOpen ? '' : undefined}>
        <MilspecSidebar
          isSidebarOpen={props.isSidebarOpen}
          onToggleSidebar={props.onToggleSidebar}
          onCloseSidebar={props.onCloseSidebar}
        />
      </div>
      <div data-ms-zone="rail" className="milspec-zone-rail"><MilspecRail isSidebarOpen={props.isSidebarOpen} onToggleSidebar={props.onToggleSidebar} /></div>
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
