import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useMilspecFonts } from './useMilspecFonts';
import { MilspecBackdropVideo } from './MilspecBackdropVideo';
import { MilspecHeaderV11 } from './header/MilspecHeaderV11';
import { MilspecSidebar } from './MilspecSidebar';
import { MilspecWorkspace } from './MilspecWorkspace';
import { MilspecFooter } from './MilspecFooter';
import { MilspecVent } from './MilspecVent';
import { MilspecRail } from './MilspecRail';
import { startAmbient } from './fx/engine';
import { relayoutZones } from './relayout';
import { useHeaderCollapseAnimator } from './headerCollapseAnimator';
import { useSidebarToggleAnimator } from './sidebarToggleAnimator';
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
  useLayoutEffect(() => { collapsedRef.current = props.isHeaderCollapsed; });
  const { setIsHeaderCollapsed } = props;
  const setCollapsedAnimated: React.Dispatch<React.SetStateAction<boolean>> = useCallback((v) => {
    const next = typeof v === 'function' ? v(collapsedRef.current) : v;
    if (next === collapsedRef.current) return; // 同じ値なら何もしない
    const app = appRef.current;
    if (!app) { setIsHeaderCollapsed(next); return; }
    relayoutZones(app, () => flushSync(() => setIsHeaderCollapsed(next)), 'hdr', reduced);
  }, [setIsHeaderCollapsed, reduced]);

  // Layout のキーボード操作(H / F・フォーカスモード・チュートリアル)にも動きを付けるため、マウント中だけ登録する
  useEffect(() => {
    useHeaderCollapseAnimator.getState().set(setCollapsedAnimated);
    return () => useHeaderCollapseAnimator.getState().set(null);
  }, [setCollapsedAnimated]);

  // サイドバーの開閉も同じ作り: 残像が左へ抜け、他の区画が滑る。最新の開閉状態と親の toggle は ref で参照
  const sbOpenRef = useRef(props.isSidebarOpen);
  const toggleRef = useRef(props.onToggleSidebar);
  useLayoutEffect(() => { sbOpenRef.current = props.isSidebarOpen; toggleRef.current = props.onToggleSidebar; });
  const setSidebarAnimated = useCallback((open: boolean) => {
    if (open === sbOpenRef.current) return; // 同じ値なら何もしない
    const app = appRef.current;
    if (!app) { toggleRef.current(); return; }
    relayoutZones(app, () => flushSync(() => toggleRef.current()), 'sb', reduced);
  }, [reduced]);
  const toggleSidebarAnimated = useCallback(() => setSidebarAnimated(!sbOpenRef.current), [setSidebarAnimated]);
  // Layout のキーボード操作(S / F・フォーカスモード・チュートリアル)にも動きを付ける
  useEffect(() => {
    useSidebarToggleAnimator.getState().set(setSidebarAnimated);
    return () => useSidebarToggleAnimator.getState().set(null);
  }, [setSidebarAnimated]);

  return (
    <div ref={appRef} data-app-shell className="milspec-app" data-theme-military>
      <MilspecBackdropVideo />
      {/* ゾーン: header / vent / sidebar / rail / workspace / footer。ヘッダーは 1 つの v11 ヘッダー(H1〜H5)。 */}
      <div ref={headerRef} data-ms-zone="header" className="milspec-zone-header" data-collapsed={props.isHeaderCollapsed ? '' : undefined}>
        <div className="milspec-hs-box">
        <MilspecHeaderV11
          theme={props.theme}
          onToggleTheme={props.onToggleTheme}
          partySortOrder={props.partySortOrder}
          setPartySortOrder={props.setPartySortOrder}
          onAutoPlan={props.onAutoPlan}
          onImportLogs={props.onImportLogs}
          statusOpen={props.statusOpen}
          setStatusOpen={props.setStatusOpen}
        />
        </div>
      </div>
      {/* 通気口の区画。取っ手でヘッダーを開閉する(閉じていても押せる)。縮小用の内箱は区画ごとに持つ */}
      <div data-ms-zone="vent" className="milspec-zone-vent">
        <div className="milspec-hs-box">
          <MilspecVent isHeaderCollapsed={props.isHeaderCollapsed} onToggleHeader={() => setCollapsedAnimated((v) => !v)} />
        </div>
      </div>
      <div data-ms-zone="sidebar" className="milspec-zone-sidebar" data-open={props.isSidebarOpen ? '' : undefined}>
        <MilspecSidebar
          isSidebarOpen={props.isSidebarOpen}
          onToggleSidebar={toggleSidebarAnimated}
          onCloseSidebar={props.onCloseSidebar}
        />
      </div>
      <div data-ms-zone="rail" className="milspec-zone-rail"><MilspecRail isSidebarOpen={props.isSidebarOpen} onToggleSidebar={toggleSidebarAnimated} /></div>
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
