import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useThemeStore, useEffectiveThemeStyle } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { Sidebar } from './Sidebar';
import { LocalDataSafetyAutoPrompt } from './LocalDataSafetyAutoPrompt';
import { ConsolidatedHeader } from './ConsolidatedHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MobileShareController } from './collab/MobileShareController';
import { useTutorialStore } from '../store/useTutorialStore';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import { AppFooter } from './AppFooter';
import { Loader2, Sun, Moon, Star, Users } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { RenderPendingIndicator } from './RenderPendingIndicator';
import { SyncButton } from './SyncButton';
import { WelcomeSetup } from './WelcomeSetup';
import { motion } from 'framer-motion';
import clsx from 'clsx';
// import { ParticleBackground } from './ParticleBackground';
import { MobileHeader } from './MobileHeader';
import { MobileFAB } from './MobileFab';
import { GridOverlay } from './GridOverlay';
import { MobilePartyWithTabs, MobileAccountMenu } from './MobilePartySettings';
import { AetherflowChainPromptModal } from './AetherflowChainPromptModal';
import { AstrologianDrawChainPromptModal } from './AstrologianDrawChainPromptModal';
import { LocalImportDialog } from './LocalImportDialog';
import { ShareImportSheet } from './ShareImportSheet';
import { LimitResolutionSheet } from './LimitResolutionSheet';
import { MilspecTunePanel } from './dev/MilspecTunePanel';
import { useIOSViewportFix } from '../hooks/useIOSViewportFix';
import { useSidebarOpenState } from './layout/useSidebarOpenState';
import { useMobileSheets } from './layout/useMobileSheets';
import { useLayoutShortcuts } from './layout/useLayoutShortcuts';
import { useBootstrapRestore } from './layout/useBootstrapRestore';
import { useCollabLifecycle } from './layout/useCollabLifecycle';
import { usePlanAutoSave } from './layout/usePlanAutoSave';
import { useLoginMigration } from './layout/useLoginMigration';
import { useAuthRedirecting } from './layout/useAuthRedirecting';

const PipView = React.lazy(() => import('./PipView'));
// 軍事テーマの PC だけが使うので、標準/スマホには配信しない
const MilspecLayout = React.lazy(() => import('./military/MilspecLayout').then(m => ({ default: m.MilspecLayout })));

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { t } = useTranslation();
    const { theme, setTheme } = useThemeStore();
    const { runTransition } = useTransitionOverlay();
    const navigate = useNavigate();
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const { isSidebarOpen, setIsSidebarOpen, handleToggleSidebar, setSidebarPersisted } = useSidebarOpenState();
    const { myJobHighlight, setMyJobHighlight } = useMitigationStore(
        useShallow(s => ({ myJobHighlight: s.myJobHighlight, setMyJobHighlight: s.setMyJobHighlight }))
    );
    const hideEmptyRows = useMitigationStore(s => s.hideEmptyRows);

    // モバイル判定（md: 768px）
    const [isMobile, setIsMobile] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    React.useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

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
    }, [isTutorialActive]);
    const {
        mobilePartyOpen, setMobilePartyOpen,
        mobileStatusOpen, setMobileStatusOpen,
        mobileToolsOpen, setMobileToolsOpen,
        mobileMenuOpen, setMobileMenuOpen,
        mobileLoginModalOpen, setMobileLoginModalOpen,
        mobileAccountOpen, setMobileAccountOpen,
        mobileShareOpen, setMobileShareOpen,
        mobileCueSheet, setMobileCueSheet,
        navHandlers,
    } = useMobileSheets(isTutorialActive);

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
                onCloseSidebar={() => { setIsSidebarOpen(false); localStorage.setItem('lopo_sidebar_open', 'false'); }}
                isHeaderCollapsed={isHeaderCollapsed}
                setIsHeaderCollapsed={setIsHeaderCollapsed}
                theme={theme}
                onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                partySortOrder={timelineSortOrder}
                setPartySortOrder={setTimelineSortOrder}
                onAutoPlan={() => window.dispatchEvent(new CustomEvent('timeline:autoplan'))}
                onImportLogs={() => window.dispatchEvent(new CustomEvent('timeline:import'))}
                statusOpen={mobileStatusOpen}
                setStatusOpen={setMobileStatusOpen}
                localImportProps={localImport}
                isNewUser={isNewUser}
                showAuthRedirecting={showAuthRedirecting}
            >
                {children}
            </MilspecLayout>
            </React.Suspense>
        );
    }

    return (
        <div data-app-shell className={`flex min-h-[100dvh] h-[100dvh] overflow-hidden font-sans text-app-text selection:bg-app-accent/20 md:max-w-[var(--container-max)] md:mx-auto ${bgClass} relative`}>

            {/* 初回ログイン: ウェルカムセットアップ画面 */}
            {isNewUser && <WelcomeSetup />}

            {/* リダイレクト認証中オーバーレイ — Discord/Twitter からの戻り時、 processPendingAuth
                完了前に表示。 実際にログイン処理中の場面のみ出る。 */}
            {showAuthRedirecting && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-app-bg">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={28} className="animate-spin text-app-text-muted" />
                        <p className="text-app-2xl font-medium text-app-text-muted">{t('login.authenticating')}</p>
                    </div>
                </div>
            )}

            {/* 背景エフェクト — ParticleBackgroundは一時的に無効化 */}
            {/* <ParticleBackground /> */}
            <GridOverlay />

            {/* サイドバー — on PC: normal flow; on mobile: overlay drawer */}
{/* PC sidebar */}
            <div className="hidden md:block">
                <Sidebar
                    isOpen={isSidebarOpen}
                    onToggle={handleToggleSidebar}
                    onClose={() => { setIsSidebarOpen(false); localStorage.setItem('lopo_sidebar_open', 'false'); }}
                />
            </div>

            {/* Mobile sidebar — slides up from bottom as a sheet */}
            <MobileBottomSheet
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                title={t('sidebar.menu')}
                height="calc(100dvh - 3.5rem - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px) - 8px)"
                fillContent
                swipeArea="handle"
                headerAction={
                    <button
                        onClick={() => { setMobileMenuOpen(false); setMobilePartyOpen(true); }}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-full border border-app-border text-app-text hover:bg-app-text/10 active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                        <Users size={15} />
                        <span className="text-app-sm font-bold whitespace-nowrap">{t('nav.party')}</span>
                    </button>
                }
            >
                <div className="flex-1 min-h-0 flex flex-col">
                    <Sidebar
                        isOpen={true}
                        fullWidth
                        onClose={() => setMobileMenuOpen(false)}
                        onAutoPlan={() => { setMobileMenuOpen(false); window.dispatchEvent(new CustomEvent('timeline:autoplan')); }}
                    />
                </div>
            </MobileBottomSheet>

            {/* Mobile: パーティ編成（タブでステータスも表示） */}
            <MobileBottomSheet
                isOpen={mobilePartyOpen}
                onClose={() => setMobilePartyOpen(false)}
                title={t('nav.party')}
                height="calc(100dvh - 3.5rem - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px) - 8px)"
                swipeArea="handle"
            >
                <MobilePartyWithTabs />
            </MobileBottomSheet>

            <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative z-10">

                <MobileTriggersContext.Provider value={{
                    mobilePartyOpen, setMobilePartyOpen,
                    mobileStatusOpen, setMobileStatusOpen,
                    mobileToolsOpen, setMobileToolsOpen,
                    mobileMenuOpen, setMobileMenuOpen,
                    isHeaderCollapsed, setIsHeaderCollapsed,
                    isHeaderNear, setIsHeaderNear,
                    isSidebarOpen
                }}>
                    {/* ── PC Header ── */}
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
                        statusOpen={mobileStatusOpen}
                        setStatusOpen={setMobileStatusOpen}
                    />
                </div>

                {/* ── Mobile Header ── */}
                <MobileHeader
                    onHome={() => navigate('/')}
                    theme={theme}
                    onToggleTheme={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
                />

                {/* Main content — モバイルはfixedヘッダー分のpaddingTop、PCはヘッダー開閉に連動 */}
                <motion.main
                    className={clsx("flex-1 flex flex-col relative overflow-hidden pb-0", !currentPlanId && "no-plan")}
                    initial={false}
                    animate={{ paddingTop: isMobile ? 0 : (isHeaderCollapsed ? 23 : 124) }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                >
                    {children}

                    {/* プラン未選択時 — 抽象イラスト + テキスト（ガラスはTimeline内に配置済み） */}
                    {!currentPlanId && (
                        <div className="absolute inset-0 pb-16 md:pb-0 z-[100] flex items-center justify-center pointer-events-none">
                            <div className="text-center empty-text-in">
                                {/* ハンバーガーメニューアイコン — PC:左からスライドイン / スマホ:上からスライドイン */}
                                <svg
                                    className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} mx-auto mb-4`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <line x1="4" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-app-text/50 ${isMobile ? 'empty-burger-top-1' : 'empty-burger-left-1'}`} />
                                    <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-app-text/50 ${isMobile ? 'empty-burger-top-2' : 'empty-burger-left-2'}`} />
                                    <line x1="4" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-app-text/50 ${isMobile ? 'empty-burger-top-3' : 'empty-burger-left-3'}`} />
                                </svg>
                                <p className={`${isMobile ? 'text-app-2xl' : 'text-app-2xl-plus'} text-app-text font-medium tracking-[0.15em]`}>
                                    {t(isMobile ? 'app.empty_state_mobile' : 'app.empty_state_pc')}
                                </p>
                            </div>
                        </div>
                    )}
                </motion.main>

                {/* Footer — hidden on mobile, shown on PC */}
                <AppFooter />
                </MobileTriggersContext.Provider>
            </div>

            {/* 右罫線 — サイドバー左ハンドルと対称（PC only, フォーカスモード時のみ表示） */}
            <motion.div
                className="hidden md:flex flex-col h-full shrink-0 relative z-40 glass-tier3 glass-frame glass-border-t-0 glass-border-l-0 glass-shadow-none overflow-hidden"
                initial={false}
                animate={{ width: isHeaderCollapsed && !isSidebarOpen ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
            >
                {/* 左端ライン（コンテンツとの境界） */}
                <div className="absolute inset-y-0 left-0 w-[1px] bg-app-border" />
                {/* 右端ライン（画面端から1px内側 — 左側と同じ太さに2px） */}
                <div className="absolute inset-y-0 right-[1px] w-[2px] bg-app-border" />

                {/* フォーカスモード用ボタン — 狭い空間からんーーっぽん！と飛び出すアニメーション */}
                <div className="flex-1 flex flex-col items-center justify-center gap-1 w-6">
                    {[
                        { key: 'theme', delay: 0.6, render: () => (
                            <button
                                onClick={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
                                className="w-6 h-6 flex items-center justify-center text-app-text-muted hover:text-app-text transition-colors cursor-pointer rounded hover:bg-app-text/10 active:scale-90 focus:outline-none"
                            >
                                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                            </button>
                        )},
                        { key: 'highlight', delay: 0.75, render: () => (
                            <button
                                onClick={() => {
                                    const current = useMitigationStore.getState().myJobHighlight;
                                    setMyJobHighlight(!current);
                                }}
                                className="w-6 h-6 flex items-center justify-center text-app-text-muted hover:text-app-text transition-colors cursor-pointer rounded hover:bg-app-text/10 active:scale-90 focus:outline-none"
                            >
                                <Star size={14} className={myJobHighlight ? "fill-current text-app-text" : ""} />
                            </button>
                        )},
                        { key: 'sync', delay: 0.9, render: () => (
                            <SyncButton size={14} className="w-6 h-6 justify-center" />
                        )},
                    ].map(({ key, delay, render }) => (
                        <motion.div
                            key={key}
                            initial={{ scaleX: 0.3, scaleY: 0.1, opacity: 0 }}
                            animate={isHeaderCollapsed && !isSidebarOpen
                                ? { scaleX: 1, scaleY: 1, opacity: 1 }
                                : { scaleX: 0.3, scaleY: 0.1, opacity: 0 }
                            }
                            transition={{
                                type: "spring",
                                stiffness: 800,
                                damping: 8,
                                delay: isHeaderCollapsed && !isSidebarOpen ? delay : 0,
                            }}
                        >
                            {render()}
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* エーテルフロー連鎖配置プロンプト（SCH が手動で aetherflow を置いたとき） */}
            <AetherflowChainPromptModal />

            {/* 占星ドロー交互配置プロンプト（AST が手動で astral_draw / umbral_draw を置いたとき） */}
            <AstrologianDrawChainPromptModal />

            {/* Mobile FAB — テーマ/同期/言語/ナビ（チュートリアル中は非表示） */}
            {!isTutorialActive && isMobile && (
                <MobileFAB
                    onToggleTheme={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
                    theme={theme}
                    onPhaseJump={() => window.dispatchEvent(new Event('mobile:phase-jump'))}
                    onLabelJump={() => window.dispatchEvent(new Event('mobile:label-jump'))}
                    onMechanicSearch={() => window.dispatchEvent(new Event('mobile:mechanic-search'))}
                    onToggleExpand={() => {
                        const store = useMitigationStore.getState();
                        store.setHideEmptyRows(!store.hideEmptyRows);
                    }}
                    hideEmptyRows={hideEmptyRows}
                />
            )}

            {/* Mobile Bottom Nav — 排他制御付きトグル（チュートリアル中は非表示） */}
            {!isTutorialActive && <MobileBottomNav {...navHandlers} />}

            {/* Mobile: ログインモーダル（未ログイン時） */}
            <LoginModal isOpen={mobileLoginModalOpen} onClose={() => setMobileLoginModalOpen(false)} />

            {/* 重い再描画中インジケーター(表示メンバー絞り込みトグル用・2026-08-19) */}
            <RenderPendingIndicator />

            {/* Mobile: アカウントシート（ログイン済み時） */}
            <MobileBottomSheet
                isOpen={mobileAccountOpen}
                onClose={() => setMobileAccountOpen(false)}
                title={t('nav.account')}
                height="auto"
                swipeArea="handle"
            >
                <MobileAccountMenu onClose={() => setMobileAccountOpen(false)} />
            </MobileBottomSheet>

            {/* Mobile: 共有タブ = PC と同じ共有フローを起動(コピー/共同編集2択・オーナーパネル)。
                 専用シートは作らず既存モーダルを開く。カーソル共有UIはスマホでは隠す。 */}
            <MobileShareController
                isOpen={mobileShareOpen}
                onClose={() => setMobileShareOpen(false)}
            />

            {/* スマホ用カンペビュー（フルスクリーン） */}
            {mobileCueSheet && (
                <div className="fixed inset-0 z-[9999] bg-app-bg md:hidden">
                    <React.Suspense fallback={null}>
                        <PipView mode="fullscreen" onClose={() => setMobileCueSheet(false)} />
                    </React.Suspense>
                </div>
            )}

            {/* B-1 Revision 3: ローカル取り込みダイアログ */}
            <LocalImportDialog
                isOpen={localImport.isOpen}
                plans={localImport.plans}
                onImport={localImport.onImport}
                onClose={localImport.onClose}
            />

            {/* Phase B-1.5 Task 17: 共有 URL 自動取り込みシート。
                useShareImportFlow.status !== 'idle' のときだけ自前で描画する self-rendering 設計。
                /share/:shareId 経由で SharePage が start() を叩くと自動的に表示される。 */}
            <ShareImportSheet />
            <LocalDataSafetyAutoPrompt />
            {/* 上限解消シートはグローバル単一マウント（共有取込・スプシ取込の両方が setLimitContext で呼ぶ） */}
            <LimitResolutionSheet />
            <MilspecTunePanel />
        </div>
    );
};