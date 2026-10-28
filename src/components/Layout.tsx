import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useThemeStore, useEffectiveThemeStyle } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { Sidebar } from './Sidebar';
import { ConsolidatedHeader } from './ConsolidatedHeader';
import { useTutorialStore } from '../store/useTutorialStore';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { useTransitionOverlay } from './ui/transitionOverlayContext';
import { AppFooter } from './AppFooter';
import { WelcomeSetup } from './WelcomeSetup';
import { motion } from 'framer-motion';
import clsx from 'clsx';
// import { ParticleBackground } from './ParticleBackground';
import { MobileHeader } from './MobileHeader';
import { GridOverlay } from './GridOverlay';
import { useIOSViewportFix } from '../hooks/useIOSViewportFix';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSidebarOpenState } from './layout/useSidebarOpenState';
import { useMobileSheets } from './layout/useMobileSheets';
import { useLayoutShortcuts } from './layout/useLayoutShortcuts';
import { useBootstrapRestore } from './layout/useBootstrapRestore';
import { useCollabLifecycle } from './layout/useCollabLifecycle';
import { usePlanAutoSave } from './layout/usePlanAutoSave';
import { useLoginMigration } from './layout/useLoginMigration';
import { useAuthRedirecting } from './layout/useAuthRedirecting';
import { AuthRedirectingOverlay } from './layout/AuthRedirectingOverlay';
import { EmptyPlanState } from './layout/EmptyPlanState';
import { FocusModeRail } from './layout/FocusModeRail';
import { MobileTopSheets } from './layout/MobileTopSheets';
import { LayoutOverlays } from './layout/LayoutOverlays';

// 軍事テーマの PC だけが使うので、標準/スマホには配信しない
const MilspecLayout = React.lazy(() => import('./military/MilspecLayout').then(m => ({ default: m.MilspecLayout })));

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { theme, setTheme } = useThemeStore();
    const { runTransition } = useTransitionOverlay();
    const navigate = useNavigate();
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const { isSidebarOpen, setIsSidebarOpen, handleToggleSidebar, setSidebarPersisted, closeSidebar } = useSidebarOpenState();

    // モバイル判定（md: 768px）
    const isMobile = useIsMobile();

    const { timelineSortOrder, setTimelineSortOrder } = useMitigationStore(
        useShallow(s => ({ timelineSortOrder: s.timelineSortOrder, setTimelineSortOrder: s.setTimelineSortOrder }))
    );
    const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(false);
    const [isHeaderNear, setIsHeaderNear] = React.useState(false);
    // チュートリアル中ならサイドバーを強制的に開く(スマホのシートは useMobileSheets が閉じる)
    const isTutorialActive = useTutorialStore((state) => state.isActive);
    React.useEffect(() => {
        if (isTutorialActive) {
            setIsSidebarOpen(true);
            // effect 内から動き付き setter(flushSync)を呼ぶと反映が遅れて動きがずれるため、ここだけ即時展開
            setIsHeaderCollapsed(false);
        }
    }, [isTutorialActive, setIsSidebarOpen]);
    const sheets = useMobileSheets(isTutorialActive);

    // iOS Safari のビューポートずれ補正(共通フック。マウント時 1 回 + resize/focusout)
    useIOSViewportFix(isMobile);

    useLayoutShortcuts({ isMobile, isSidebarOpen, isHeaderCollapsed, setSidebarPersisted, setIsHeaderCollapsed });

    // リモートデータ読み込み中フラグ（PULL/マイグレーション時のdirty marking防止）
    const isRemoteLoadingRef = React.useRef(false);

    // ⚠ 呼ぶ順番が重要(データ安全): 起動時復旧 → 共同編集の管制 → 自動保存 → ログイン時の取り込み。
    //   管制の subscribe を自動保存より先に登録する(理由は useCollabLifecycle.ts)。
    useBootstrapRestore(isRemoteLoadingRef);
    useCollabLifecycle();
    usePlanAutoSave(isRemoteLoadingRef);
    const localImport = useLoginMigration(isRemoteLoadingRef);

    // ベースの背景色（テーマ変数を参照するように変更）
    const bgClass = "bg-app-bg";

    const { isNewUser, showAuthRedirecting } = useAuthRedirecting();

    // MIL-SPEC 専用シェル分岐: themeStyle==='military' かつ PC のときだけ標準 JSX の代わりに
    // MilspecLayout を返す。全フックはこの上で実行済 (実行時ホスト=自動保存/collab/データ復旧は
    // 分岐前に持つ)。標準モード (themeStyle 未設定 / 'standard') は完全不変。
    const themeStyle = useEffectiveThemeStyle();

    if (themeStyle === 'military' && !isMobile) {
        return (
            <React.Suspense fallback={null}>
            <MilspecLayout
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={handleToggleSidebar}
                onCloseSidebar={closeSidebar}
                isHeaderCollapsed={isHeaderCollapsed}
                setIsHeaderCollapsed={setIsHeaderCollapsed}
                theme={theme}
                onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                partySortOrder={timelineSortOrder}
                setPartySortOrder={setTimelineSortOrder}
                onAutoPlan={() => window.dispatchEvent(new CustomEvent('timeline:autoplan'))}
                onImportLogs={() => window.dispatchEvent(new CustomEvent('timeline:import'))}
                statusOpen={sheets.mobileStatusOpen}
                setStatusOpen={sheets.setMobileStatusOpen}
                localImportProps={localImport}
                isNewUser={isNewUser}
                showAuthRedirecting={showAuthRedirecting}
            >
                {children}
            </MilspecLayout>
            </React.Suspense>
        );
    }

    const toggleThemeWithTransition = () => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme');

    return (
        <div data-app-shell className={`flex min-h-[100dvh] h-[100dvh] overflow-hidden font-sans text-app-text selection:bg-app-accent/20 md:max-w-[var(--container-max)] md:mx-auto ${bgClass} relative`}>

            {/* 初回ログイン: ウェルカムセットアップ画面 */}
            {isNewUser && <WelcomeSetup />}

            {showAuthRedirecting && <AuthRedirectingOverlay />}

            {/* 背景エフェクト — ParticleBackgroundは一時的に無効化 */}
            {/* <ParticleBackground /> */}
            <GridOverlay />

            {/* サイドバー — on PC: normal flow; on mobile: overlay drawer */}
            {/* PC sidebar */}
            <div className="hidden md:block">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onToggle={handleToggleSidebar}
                    onClose={closeSidebar}
                />
            </div>

            <MobileTopSheets sheets={sheets} />

            <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative z-10">

                <MobileTriggersContext.Provider value={{
                    mobilePartyOpen: sheets.mobilePartyOpen, setMobilePartyOpen: sheets.setMobilePartyOpen,
                    mobileStatusOpen: sheets.mobileStatusOpen, setMobileStatusOpen: sheets.setMobileStatusOpen,
                    mobileToolsOpen: sheets.mobileToolsOpen, setMobileToolsOpen: sheets.setMobileToolsOpen,
                    mobileMenuOpen: sheets.mobileMenuOpen, setMobileMenuOpen: sheets.setMobileMenuOpen,
                    isHeaderCollapsed, setIsHeaderCollapsed,
                    isHeaderNear, setIsHeaderNear,
                    isSidebarOpen
                }}>
                    {/* ── Consolidated Floating Header (on PC) ── */}
                    <div className="hidden md:block h-0 relative z-[120]">
                        <ConsolidatedHeader
                            onAutoPlan={() => {
                                // Dispatch a custom event for Timeline.tsx or use a shared store
                                window.dispatchEvent(new CustomEvent('timeline:autoplan'));
                            }}
                            onImportLogs={() => {
                                window.dispatchEvent(new CustomEvent('timeline:import'));
                            }}
                            partySortOrder={timelineSortOrder}
                            setPartySortOrder={setTimelineSortOrder}
                            statusOpen={sheets.mobileStatusOpen}
                            setStatusOpen={sheets.setMobileStatusOpen}
                        />
                    </div>

                    {/* ── Mobile Header ── */}
                    <MobileHeader
                        onHome={() => navigate('/')}
                        theme={theme}
                        onToggleTheme={toggleThemeWithTransition}
                    />

                    {/* Main content — モバイルはfixedヘッダー分のpaddingTop、PCはヘッダー開閉に連動 */}
                    <motion.main
                        className={clsx("flex-1 flex flex-col relative overflow-hidden pb-0", !currentPlanId && "no-plan")}
                        initial={false}
                        animate={{ paddingTop: isMobile ? 0 : (isHeaderCollapsed ? 23 : 124) }}
                        transition={{ type: "spring", stiffness: 380, damping: 22 }}
                    >
                        {children}

                        {!currentPlanId && <EmptyPlanState isMobile={isMobile} />}
                    </motion.main>

                    {/* Footer — hidden on mobile, shown on PC */}
                    <AppFooter />
                </MobileTriggersContext.Provider>
            </div>

            <FocusModeRail
                visible={isHeaderCollapsed && !isSidebarOpen}
                theme={theme}
                onToggleTheme={toggleThemeWithTransition}
            />

            <LayoutOverlays
                isMobile={isMobile}
                isTutorialActive={isTutorialActive}
                theme={theme}
                onToggleTheme={toggleThemeWithTransition}
                sheets={sheets}
                localImport={localImport}
            />
        </div>
    );
};
