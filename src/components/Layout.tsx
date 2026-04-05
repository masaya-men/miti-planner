import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { useAuthStore } from '../store/useAuthStore';
import { Sidebar } from './Sidebar';
import { ConsolidatedHeader } from './ConsolidatedHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileBottomSheet } from './MobileBottomSheet';
import { useTutorialStore } from '../store/useTutorialStore';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { PulseSettings } from './PulseSettings';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import { Loader2 } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { WelcomeSetup } from './WelcomeSetup';
import { motion } from 'framer-motion';
import clsx from 'clsx';
// import { ParticleBackground } from './ParticleBackground';
import { MobileHeader } from './MobileHeader';
import { GridOverlay } from './GridOverlay';
import { MobilePartyWithTabs, MobileAccountMenu } from './MobilePartySettings';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { t } = useTranslation();
    const { theme, setTheme } = useThemeStore();
    const { runTransition } = useTransitionOverlay();
    const navigate = useNavigate();
    const plans = usePlanStore(s => s.plans);
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    // サイドバー開閉: プラン未選択なら強制オープン、それ以外はlocalStorage記憶
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
        if (plans.length === 0 || !currentPlanId) setIsSidebarOpen(true);
    }, [plans.length, currentPlanId]);
    const { myJobHighlight, setMyJobHighlight } = useMitigationStore(
        useShallow(s => ({ myJobHighlight: s.myJobHighlight, setMyJobHighlight: s.setMyJobHighlight }))
    );

    // モバイル判定（md: 768px）
    const [isMobile, setIsMobile] = React.useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    React.useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Mobile modal triggers — these are read by Timeline.tsx via the store
    const [footerLegalOpen, setFooterLegalOpen] = React.useState(false);
    const [mobilePartyOpen, setMobilePartyOpen] = React.useState(false);
    const [mobileStatusOpen, setMobileStatusOpen] = React.useState(false);
    const [mobileToolsOpen, setMobileToolsOpen] = React.useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const [mobileLoginModalOpen, setMobileLoginModalOpen] = React.useState(false);
    const [mobileAccountOpen, setMobileAccountOpen] = React.useState(false);
    const { timelineSortOrder, setTimelineSortOrder } = useMitigationStore(
        useShallow(s => ({ timelineSortOrder: s.timelineSortOrder, setTimelineSortOrder: s.setTimelineSortOrder }))
    );
    const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(false);
    const [isHeaderNear, setIsHeaderNear] = React.useState(false);
    // チュートリアル中ならサイドバーを強制的に開く
    const isTutorialActive = useTutorialStore((state) => state.isActive);
    React.useEffect(() => {
        if (isTutorialActive) {
            setIsSidebarOpen(true);
            setIsHeaderCollapsed(false);
            // チュートリアル中はモバイル用シートをすべて閉じる
            setMobileMenuOpen(false);
            setMobilePartyOpen(false);
            setMobileStatusOpen(false);
            setMobileToolsOpen(false);
            setMobileAccountOpen(false);
        }
    }, [isTutorialActive]);

    // iOS キーボード閉じた後のビューポートずれ修正
    React.useEffect(() => {
        if (!isMobile) return;
        const vv = window.visualViewport;
        if (!vv) return;
        let prevHeight = vv.height;
        const handleResize = () => {
            const newHeight = vv.height;
            // キーボードが閉じた（高さが増えた）
            if (newHeight > prevHeight + 50) {
                window.scrollTo(0, 0);
                document.documentElement.style.height = '100%';
                requestAnimationFrame(() => {
                    document.documentElement.style.height = '';
                });
            }
            prevHeight = newHeight;
        };
        // input/textareaのblur時にもスクロール位置をリセット
        const handleFocusOut = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                setTimeout(() => {
                    window.scrollTo(0, 0);
                }, 100);
            }
        };
        vv.addEventListener('resize', handleResize);
        document.addEventListener('focusout', handleFocusOut);
        return () => {
            vv.removeEventListener('resize', handleResize);
            document.removeEventListener('focusout', handleFocusOut);
        };
    }, [isMobile]);

    // キーボードショートカット（PCのみ）
    // F: フォーカスモード（サイドバー+ヘッダー両方非表示/復元）
    // S: サイドバー開閉
    // H: ヘッダー開閉
    // P/T/L/A: Timeline.tsx側で処理
    const focusModeRef = React.useRef(false);
    const preFocusSidebarRef = React.useRef(true);
    const preFocusHeaderRef = React.useRef(false);
    React.useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            if (isMobile) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const key = e.key.toLowerCase();
            if (key === 's') {
                e.preventDefault();
                handleToggleSidebar();
            } else if (key === 'h') {
                e.preventDefault();
                setIsHeaderCollapsed(prev => !prev);
            } else if (key === 'f') {
                e.preventDefault();
                if (!focusModeRef.current) {
                    // フォーカスモードに入る: 現在の状態を記憶してから隠す
                    preFocusSidebarRef.current = isSidebarOpen;
                    preFocusHeaderRef.current = isHeaderCollapsed;
                    setIsSidebarOpen(false);
                    localStorage.setItem('lopo_sidebar_open', 'false');
                    setIsHeaderCollapsed(true);
                    focusModeRef.current = true;
                } else {
                    // フォーカスモードから抜ける: 記憶した状態に復元
                    setIsSidebarOpen(preFocusSidebarRef.current);
                    localStorage.setItem('lopo_sidebar_open', String(preFocusSidebarRef.current));
                    setIsHeaderCollapsed(preFocusHeaderRef.current);
                    focusModeRef.current = false;
                }
            }
        };
        const handleExitFocus = () => {
            if (focusModeRef.current) {
                setIsSidebarOpen(preFocusSidebarRef.current);
                localStorage.setItem('lopo_sidebar_open', String(preFocusSidebarRef.current));
                setIsHeaderCollapsed(preFocusHeaderRef.current);
                focusModeRef.current = false;
            }
        };
        window.addEventListener('keydown', handleShortcut);
        window.addEventListener('shortcut:exit-focus', handleExitFocus);
        return () => {
            window.removeEventListener('keydown', handleShortcut);
            window.removeEventListener('shortcut:exit-focus', handleExitFocus);
        };
    }, [isMobile, isSidebarOpen, isHeaderCollapsed]);

    // 自動保存（2層構造）
    // localStorage: 変更検知→500msデバウンス→即時保存（コストゼロ）
    // Firestore: イベント駆動（ページ離脱 / タブ非表示 / プラン切替時）+ 5分定期バックアップ
    React.useEffect(() => {
        /** localStorage への保存 */
        const saveSilently = () => {
            const planStore = usePlanStore.getState();
            const mitiStore = useMitigationStore.getState();
            if (planStore.currentPlanId) {
                planStore.updatePlan(planStore.currentPlanId, { data: mitiStore.getSnapshot() });
            }
        };

        /** Firestoreへの同期（ログイン中 + dirtyがある場合のみ）
         * @param force trueならクールダウン無視（タブ切替・ページ離脱時）
         */
        const syncToCloud = (force = false) => {
            const authState = useAuthStore.getState();
            const planStore = usePlanStore.getState();
            if (authState.user && planStore.hasDirtyPlans()) {
                const profileName = useAuthStore.getState().profileDisplayName || 'User';
                planStore.syncToFirestore(
                    authState.user.uid,
                    profileName,
                    force,
                ).catch((err) => {
                    console.error('[LoPo] Firestore同期エラー:', err);
                });
            }
        };

        /** Firestoreから最新データを取得（ログイン中のみ） */
        const pullFromCloud = () => {
            const authState = useAuthStore.getState();
            if (authState.user) {
                usePlanStore.getState().pullFromFirestore(
                    authState.user.uid,
                ).catch((err) => {
                    console.error('[LoPo] Firestore PULL エラー:', err);
                });
            }
        };

        let localDebounceTimer: ReturnType<typeof setTimeout> | null = null;

        // useMitigationStoreの変更を監視 → localStorageへ500msデバウンス保存
        const unsubMiti = useMitigationStore.subscribe((state, prevState) => {
            // 同じ参照なら何もしない（不要な保存を防止）
            if (state.timelineMitigations === prevState.timelineMitigations
                && state.timelineEvents === prevState.timelineEvents
                && state.phases === prevState.phases
                && state.partyMembers === prevState.partyMembers) return;
            // プランが選択されていなければスキップ
            const planIdAtChange = usePlanStore.getState().currentPlanId;
            if (!planIdAtChange) return;

            // インジケーター: 「保存中...」
            usePlanStore.getState().setSaveStatus('saving');

            // localStorage: 500msデバウンス（ブラウザ内保存なのでコストゼロ）
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
            localDebounceTimer = setTimeout(() => {
                // 500ms後にplanIdが変わっていたらプラン切替中だったのでスキップ
                // （旧プランに新データを保存するデータ破損を防止）
                const currentId = usePlanStore.getState().currentPlanId;
                if (currentId !== planIdAtChange) return;
                saveSilently();
                usePlanStore.getState().setSaveStatus('saved');
                // クラウド同期も試行（3分クールダウンで自動的に間引かれる）
                syncToCloud();
            }, 500);
        });

        /** ページ離脱時: localStorage即時保存 + Firestore同期（クールダウン無視） */
        const onBeforeUnload = () => {
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
            saveSilently();
            syncToCloud(true);
            // saveSilently() でlocalStorageに同期保存済みのため、
            // ブラウザの「変更が保存されない場合があります」警告は不要
        };

        /** タブ切替時:
         * 非表示 → localStorage保存 + Firestore PUSH
         * 再表示 → Firestore PULL（他端末の変更を取得）
         */
        const onVisibilityChange = () => {
            if (document.hidden) {
                if (localDebounceTimer) clearTimeout(localDebounceTimer);
                saveSilently();
                syncToCloud(true);  // タブ切替 = ユーザーの意図的操作 → クールダウン無視
                usePlanStore.getState().setSaveStatus('saved');
            } else {
                // タブ再表示 → PULL（他端末の変更を取得）
                pullFromCloud();
            }
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('visibilitychange', onVisibilityChange);

        // プラン切替時: 旧プランをlocalStorage保存 + Firestore同期
        let prevPlanId = usePlanStore.getState().currentPlanId;
        const unsubPlan = usePlanStore.subscribe((state) => {
            const newId = state.currentPlanId;
            const oldId = prevPlanId;
            prevPlanId = newId; // 再入防止: saveSilently→updatePlan→subscribe再発火時にスキップさせる
            if (oldId && oldId !== newId) {
                saveSilently();
                syncToCloud(true);  // プラン切替 = 意図的操作 → クールダウン無視
            }
        });

        // 5分ごとの定期同期（PUSH + PULL）
        const periodicSyncInterval = setInterval(() => {
            // PULLの前にローカル編集をflush（未保存の編集が上書きされるのを防止）
            saveSilently();
            syncToCloud();
            pullFromCloud();
        }, 5 * 60 * 1000);

        return () => {
            unsubMiti();
            unsubPlan();
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
            clearInterval(periodicSyncInterval);
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [t]);

    // ログイン時のデータマイグレーション（localStorageのプランをFirestoreにアップロード）
    const authUser = useAuthStore((s) => s.user);
    const authLoading = useAuthStore((s) => s.loading);
    const [hasMigrated, setHasMigrated] = React.useState(false);
    // ログアウト時（authUser=null）にフラグをリセット → 再ログイン時にmigrateOnLoginが再実行される
    React.useEffect(() => {
        if (!authUser) setHasMigrated(false);
    }, [authUser]);
    React.useEffect(() => {
        if (authLoading || !authUser || hasMigrated) return;
        setHasMigrated(true);
        const planStore = usePlanStore.getState();
        const profileName = useAuthStore.getState().profileDisplayName || 'User';
        planStore.migrateOnLogin(
            authUser.uid,
            profileName,
        ).then(() => {
            // マイグレーション後、プランがあれば最新を開く
            const { plans, currentPlanId } = usePlanStore.getState();
            if (plans.length > 0 && !currentPlanId) {
                const latest = plans.sort((a, b) => b.updatedAt - a.updatedAt)[0];
                usePlanStore.getState().setCurrentPlanId(latest.id);
                if (latest.data) {
                    useMitigationStore.getState().loadSnapshot(latest.data);
                }
            }
        });
    }, [authUser, authLoading, hasMigrated]);

    // ベースの背景色（テーマ変数を参照するように変更）
    const bgClass = "bg-app-bg";

    // 初回ログイン判定
    const isNewUser = useAuthStore((s) => s.isNewUser);

    // リダイレクト認証の戻り検知（Discord/Twitter — ページロード前に即座に判定）
    const justLoggedInUser = useAuthStore((s) => s.justLoggedInUser);
    const [isAuthRedirecting, setIsAuthRedirecting] = React.useState(() =>
        localStorage.getItem('lopo_auth_redirecting') === 'true'
    );
    // justLoggedInUserが設定されたら or processPendingAuth完了後にリダイレクト画面を消す
    React.useEffect(() => {
        if (justLoggedInUser || !localStorage.getItem('lopo_auth_redirecting')) {
            setIsAuthRedirecting(false);
        }
    }, [justLoggedInUser]);

    return (
        <div className={`flex min-h-[100dvh] h-[100dvh] overflow-hidden font-sans text-app-text selection:bg-app-accent/20 ${bgClass} relative`}>

            {/* 初回ログイン: ウェルカムセットアップ画面 */}
            {isNewUser && <WelcomeSetup />}

            {/* リダイレクト認証中オーバーレイ — Discord/Twitterからの戻り時、processPendingAuth完了前に表示 */}
            {isAuthRedirecting && !justLoggedInUser && (
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
                height="70vh"
            >
                <div className="-mx-4 -mt-3">
                    <Sidebar isOpen={true} fullWidth onClose={() => setMobileMenuOpen(false)} />
                </div>
            </MobileBottomSheet>

            {/* Mobile: パーティ編成（タブでステータスも表示） */}
            <MobileBottomSheet
                isOpen={mobilePartyOpen}
                onClose={() => setMobilePartyOpen(false)}
                title={t('nav.party')}
                height="70vh"
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
                    />
                </div>

                {/* ── Mobile Header ── */}
                <MobileHeader
                    onHome={() => navigate('/')}
                    theme={theme}
                    onToggleTheme={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
                />

                {/* Main content — add bottom padding on mobile for bottom nav */}
                {/* モバイルではフローティングヘッダーが非表示なのでpaddingTop不要 */}
                <motion.main
                    className={clsx("flex-1 flex flex-col relative overflow-hidden pb-16 md:pb-0", !currentPlanId && "no-plan")}
                    initial={false}
                    animate={{ paddingTop: isMobile ? 0 : (isHeaderCollapsed ? 36 : 124) }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
                <footer className={clsx(
                    "h-6 shrink-0 border-t hidden md:flex items-center justify-center z-50 pointer-events-none",
                    "border-app-border",
                    "bg-transparent"
                )}>
                    <p className="text-app-xs text-app-text-muted tracking-wide pointer-events-auto flex items-center gap-0">
                        {t('footer.copyright')}{' · '}{t('footer.disclaimer')}
                        {' · '}
                        <span className="relative inline-block">
                            <button
                                onClick={() => setFooterLegalOpen(prev => !prev)}
                                className="underline hover:text-app-text transition-colors cursor-pointer px-1"
                            >
                                {t('footer.legal')}
                            </button>
                            {footerLegalOpen && (
                                <>
                                    <div className="fixed inset-0 z-[998]" onClick={() => setFooterLegalOpen(false)} />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[999] bg-app-surface border border-app-border rounded-lg shadow-lg py-2 min-w-[220px]">
                                        <a href="/privacy" className="block px-4 py-2.5 text-app-base text-app-text hover:bg-app-surface2 transition-colors" onClick={() => setFooterLegalOpen(false)}>{t('footer.privacy_policy')}</a>
                                        <a href="/terms" className="block px-4 py-2.5 text-app-base text-app-text hover:bg-app-surface2 transition-colors" onClick={() => setFooterLegalOpen(false)}>{t('footer.terms')}</a>
                                        <a href="/commercial" className="block px-4 py-2.5 text-app-base text-app-text hover:bg-app-surface2 transition-colors" onClick={() => setFooterLegalOpen(false)}>{t('footer.commercial')}</a>
                                    </div>
                                </>
                            )}
                        </span>
                        {' · '}
                        <a href="https://discord.gg/z7uypbJSnN" target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text transition-colors">{t('footer.discord')}</a>
                        {' · '}
                        <a href="https://x.com/lopoly_app" target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text transition-colors">{t('footer.x_official')}</a>
                        {' · '}
                        <PulseSettings />
                    </p>
                </footer>
                </MobileTriggersContext.Provider>
            </div>

            {/* Mobile Bottom Nav — 排他制御付きトグル（チュートリアル中は非表示） */}
            {!isTutorialActive && <MobileBottomNav
                onMenuToggle={() => {
                    const next = !mobileMenuOpen;
                    setMobileMenuOpen(next);
                    if (next) { setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); }
                }}
                onPartyOpen={() => {
                    const next = !mobilePartyOpen;
                    setMobilePartyOpen(next);
                    if (next) { setMobileMenuOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); setMobileAccountOpen(false); }
                }}
                onToolsOpen={() => {
                    const next = !mobileToolsOpen;
                    setMobileToolsOpen(next);
                    if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileAccountOpen(false); }
                }}
                onLoginOpen={() => {
                    const authUser = useAuthStore.getState().user;
                    if (authUser) {
                        // ログイン済み → アカウントシート
                        const next = !mobileAccountOpen;
                        setMobileAccountOpen(next);
                        if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); }
                    } else {
                        // 未ログイン → ログインモーダル
                        setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false);
                        setMobileLoginModalOpen(true);
                    }
                }}
                myJobHighlight={myJobHighlight}
                onMyJobHighlightToggle={() => setMyJobHighlight(!myJobHighlight)}
                activeTab={mobileMenuOpen ? 'menu' : mobilePartyOpen ? 'party' : mobileToolsOpen ? 'tools' : mobileAccountOpen ? 'login' : undefined}
            />}

            {/* Mobile: ログインモーダル（未ログイン時） */}
            <LoginModal isOpen={mobileLoginModalOpen} onClose={() => setMobileLoginModalOpen(false)} />

            {/* Mobile: アカウントシート（ログイン済み時） */}
            <MobileBottomSheet
                isOpen={mobileAccountOpen}
                onClose={() => setMobileAccountOpen(false)}
                title={t('nav.account')}
                height="auto"
            >
                <MobileAccountMenu onClose={() => setMobileAccountOpen(false)} />
            </MobileBottomSheet>
        </div>
    );
};