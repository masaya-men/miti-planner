import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { Sidebar } from './Sidebar';
import { ConsolidatedHeader } from './ConsolidatedHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileBottomSheet } from './MobileBottomSheet';
import { useTutorialStore } from '../store/useTutorialStore';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { Sun, Moon, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
// import { ParticleBackground } from './ParticleBackground';
import { GridOverlay } from './GridOverlay';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { t } = useTranslation();
    const { theme, setTheme } = useThemeStore();
    const navigate = useNavigate();
    const plans = usePlanStore(s => s.plans);
    // サイドバー開閉: プラン0件なら強制オープン、それ以外はlocalStorage記憶
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(() => {
        if (typeof window === 'undefined') return true;
        if (window.innerWidth < 768) return false;
        const stored = localStorage.getItem('lopo_sidebar_open');
        return stored !== null ? stored === 'true' : true;
    });
    // 開閉を記憶
    const handleToggleSidebar = () => {
        const next = !isSidebarOpen;
        setIsSidebarOpen(next);
        localStorage.setItem('lopo_sidebar_open', String(next));
    };
    // プラン0件なら強制的に開く
    React.useEffect(() => {
        if (plans.length === 0) setIsSidebarOpen(true);
    }, [plans.length]);
    const { myJobHighlight, setMyJobHighlight } = useMitigationStore();

    // Mobile modal triggers — these are read by Timeline.tsx via the store
    const [mobilePartyOpen, setMobilePartyOpen] = React.useState(false);
    const [mobileStatusOpen, setMobileStatusOpen] = React.useState(false);
    const [mobileToolsOpen, setMobileToolsOpen] = React.useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const { timelineSortOrder, setTimelineSortOrder } = useMitigationStore();
    const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(false);
    const [isHeaderNear, setIsHeaderNear] = React.useState(false);
    // チュートリアル中ならサイドバーを強制的に開く
    const isTutorialActive = useTutorialStore((state) => state.isActive);
    React.useEffect(() => {
        if (isTutorialActive) {
            setIsSidebarOpen(true);
            setIsHeaderCollapsed(false);
            setMobileMenuOpen(false);
        }
    }, [isTutorialActive]);

    // 自動保存（ページ離脱 + タブ切替 + 30秒間隔）
    React.useEffect(() => {
        const saveSilently = () => {
            const planStore = usePlanStore.getState();
            const mitiStore = useMitigationStore.getState();
            if (planStore.currentPlanId) {
                planStore.updatePlan(planStore.currentPlanId, { data: mitiStore.getSnapshot() });
            }
        };
        window.addEventListener('beforeunload', saveSilently);
        const onVisibilityChange = () => { if (document.hidden) saveSilently(); };
        document.addEventListener('visibilitychange', onVisibilityChange);
        // 30秒間隔の定期保存（無音）
        const interval = setInterval(saveSilently, 30_000);
        return () => {
            window.removeEventListener('beforeunload', saveSilently);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            clearInterval(interval);
        };
    }, [t]);

    // ベースの背景色（テーマ変数を参照するように変更）
    const bgClass = "bg-app-bg";

    return (
        <div className={`flex min-h-[100dvh] h-[100dvh] overflow-hidden font-sans text-app-text selection:bg-app-accent/20 ${bgClass} relative`}>

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
                height="80vh"
            >
                <div className="-mx-4 -mt-3">
                    <Sidebar isOpen={true} />
                </div>
            </MobileBottomSheet>

            <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative z-10">

                <MobileTriggersContext.Provider value={{
                    mobilePartyOpen, setMobilePartyOpen,
                    mobileStatusOpen, setMobileStatusOpen,
                    mobileToolsOpen, setMobileToolsOpen,
                    mobileMenuOpen, setMobileMenuOpen,
                    isHeaderCollapsed, setIsHeaderCollapsed,
                    isHeaderNear, setIsHeaderNear
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
                        setPartySettingsOpen={setMobilePartyOpen}
                    />
                </div>

                {/* ── Mobile Header ── */}
                <header className={clsx(
                    "h-11 shrink-0 border-b flex md:hidden items-center justify-between px-3 z-40 relative",
                    "bg-app-bg border-app-border"
                )}>
                    {/* Home button for mobile */}
                    <button
                        onClick={() => navigate('/')}
                        className="p-1.5 text-app-text flex items-center gap-1"
                    >
                        <Home size={18} />
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            data-tutorial-always
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="p-1.5 w-8 h-8 rounded-lg text-app-text hover:bg-app-surface2 flex items-center justify-center cursor-pointer"
                        >
                            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                        <LanguageSwitcher />
                    </div>
                </header>

                {/* Main content — add bottom padding on mobile for bottom nav */}
                <motion.main
                    className="flex-1 flex flex-col relative overflow-hidden pb-16 md:pb-0"
                    initial={false}
                    animate={{ paddingTop: isHeaderCollapsed ? 36 : 124 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {children}

                    {/* プラン0件時のオーバーレイ — タグ型吹き出し */}
                    {plans.length === 0 && (
                        <div className="absolute inset-0 z-[50] flex items-center justify-center pointer-events-auto">
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: [0, -4, 0] }}
                                transition={{ opacity: { duration: 0.4 }, x: { repeat: Infinity, duration: 2, ease: 'easeInOut', delay: 0.5 } }}
                                className="relative px-8 py-6 rounded-r-2xl rounded-l-none border border-l-4 border-app-text/40 bg-app-bg/95 backdrop-blur-sm shadow-lg max-w-sm text-center"
                            >
                                <p className="text-base font-bold text-app-text mb-1">
                                    {t('app.empty_state_title')}
                                </p>
                                <p className="text-[12px] text-app-text-muted">
                                    {t('app.empty_state_desc')}
                                </p>
                            </motion.div>
                        </div>
                    )}
                </motion.main>

                {/* Footer — hidden on mobile, shown on PC */}
                <footer className={clsx(
                    "h-6 shrink-0 border-t hidden md:flex items-center justify-center z-50 pointer-events-none",
                    "border-app-border",
                    "bg-transparent"
                )}>
                    <p className="text-[8px] text-app-text-muted tracking-wide">
                        {t('footer.copyright')} · {t('footer.disclaimer')}
                    </p>
                </footer>
                </MobileTriggersContext.Provider>
            </div>

            {/* Mobile Bottom Nav */}
            <MobileBottomNav
                onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
                onPartyOpen={() => setMobilePartyOpen(!mobilePartyOpen)}
                onStatusOpen={() => setMobileStatusOpen(!mobileStatusOpen)}
                onToolsOpen={() => setMobileToolsOpen(!mobileToolsOpen)}
                myJobHighlight={myJobHighlight}
                onMyJobHighlightToggle={() => setMyJobHighlight(!myJobHighlight)}
                activeTab={mobileMenuOpen ? 'menu' : mobileToolsOpen ? 'tools' : mobilePartyOpen ? 'party' : mobileStatusOpen ? 'status' : undefined}
            />
        </div>
    );
};