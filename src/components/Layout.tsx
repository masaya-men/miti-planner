import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
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
import { getContentById } from '../data/contentRegistry';
import { JOBS } from '../data/mockData';
import { Sun, Moon, Home, X, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
// import { ParticleBackground } from './ParticleBackground';
import { GridOverlay } from './GridOverlay';
import { JobMigrationModal } from './JobMigrationModal';
import { migrateMitigations } from '../utils/jobMigration';
import type { MigrationMode } from '../utils/jobMigration';
import type { Job } from '../types';

// ── モバイルヘッダー: コンテンツ名+プラン名を中央に表示 ──
const MobileHeader: React.FC<{
    onHome: () => void;
    theme: string;
    onToggleTheme: () => void;
}> = ({ onHome, theme, onToggleTheme }) => {
    const { i18n } = useTranslation();
    const currentPlan = usePlanStore(s => s.plans.find(p => p.id === s.currentPlanId));
    const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;
    const contentLabel = contentDef
        ? (i18n.language.startsWith('ja') ? contentDef.name.ja : contentDef.name.en)
        : null;

    return (
        <header className={clsx(
            "h-9 shrink-0 border-b flex md:hidden items-center justify-between px-2 z-40 relative",
            "bg-app-bg/95 backdrop-blur-md border-app-border"
        )}>
            {/* 左: Homeボタン */}
            <button
                onClick={onHome}
                className="p-1 text-app-text flex items-center shrink-0"
            >
                <Home size={16} />
            </button>

            {/* 中央: コンテンツ名 / プラン名 */}
            {currentPlan && (
                <div className="flex-1 min-w-0 flex items-center justify-center gap-1 px-1">
                    {contentLabel && (
                        <span className="text-[11px] font-black text-app-text truncate leading-none">
                            {contentLabel}
                        </span>
                    )}
                    {currentPlan.title && currentPlan.title !== contentLabel && (
                        <>
                            {contentLabel && <span className="text-[9px] text-app-text-muted shrink-0">/</span>}
                            <span className="text-[10px] text-app-text-muted truncate leading-none">
                                {currentPlan.title}
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* 右: テーマ + 言語 */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    data-tutorial-always
                    onClick={onToggleTheme}
                    className="p-1 w-7 h-7 rounded-md text-app-text hover:bg-app-surface2 flex items-center justify-center cursor-pointer"
                >
                    {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                </button>
                <LanguageSwitcher />
            </div>
        </header>
    );
};

// ── モバイル用パーティ編成UI ──
const MobilePartySettings: React.FC = () => {
    const { t } = useTranslation();
    const partyMembers = useMitigationStore(s => s.partyMembers);
    const setMemberJob = useMitigationStore(s => s.setMemberJob);
    const updatePartyBulk = useMitigationStore(s => s.updatePartyBulk);
    const timelineMitigations = useMitigationStore(s => s.timelineMitigations);
    const myMemberId = useMitigationStore(s => s.myMemberId);
    const setMyMemberId = useMitigationStore(s => s.setMyMemberId);
    const [focusedSlot, setFocusedSlot] = React.useState<string | null>(null);
    const [myJobMode, setMyJobMode] = React.useState(false);

    // ジョブ変更マイグレーション用state
    const [migrationPending, setMigrationPending] = React.useState<{
        memberId: string;
        oldJob: Job | null;
        newJob: Job;
    } | null>(null);

    const memberOrder = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
    const sortedMembers = memberOrder.map(id => partyMembers.find(m => m.id === id)).filter(Boolean) as typeof partyMembers;

    // ジョブ変更ハンドラ — 軽減がある場合はマイグレーション確認を表示
    const handleJobChange = (memberId: string, jobId: string) => {
        const member = partyMembers.find(m => m.id === memberId);
        if (!member) return;

        const newJob = JOBS.find(j => j.id === jobId);
        if (!newJob) return;

        // 既存ジョブがあり、かつ軽減が配置されている場合 → マイグレーション確認
        const hasMitigations = timelineMitigations.some(m => m.ownerId === memberId);
        if (hasMitigations && member.jobId && member.jobId !== jobId) {
            const oldJob = JOBS.find(j => j.id === member.jobId) || null;
            setMigrationPending({ memberId, oldJob, newJob });
            return;
        }

        // 軽減なし or 新規設定 → 直接変更
        setMemberJob(memberId, jobId);
        setFocusedSlot(null);
    };

    // マイグレーション確定
    const handleMigrationConfirm = (mode: MigrationMode) => {
        if (!migrationPending) return;
        const { memberId, oldJob, newJob } = migrationPending;
        const memberMitis = useMitigationStore.getState().timelineMitigations.filter(m => m.ownerId === memberId);
        const newMitis = migrateMitigations(oldJob?.id || '', newJob.id, memberId, memberMitis, mode);
        updatePartyBulk([{ memberId, jobId: newJob.id, mitigations: newMitis }]);
        setMigrationPending(null);
        setFocusedSlot(null);
    };

    return (
        <div className="flex flex-col gap-3">
            {/* MY JOBモード切替 */}
            <button
                onClick={() => { setMyJobMode(!myJobMode); setFocusedSlot(null); }}
                className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold transition-all cursor-pointer",
                    myJobMode
                        ? "bg-app-text text-app-bg border-app-text"
                        : "bg-app-surface2 border-app-border text-app-text"
                )}
            >
                <Star size={14} />
                {t('party.set_my_job', '自分のジョブを設定')}
                {myMemberId && !myJobMode && (
                    <span className="ml-auto text-[10px] text-app-text-muted">
                        {myMemberId}
                    </span>
                )}
            </button>

            {myJobMode && (
                <p className="text-[11px] text-app-text-muted px-1">
                    {t('party.my_job_tap_slot', '自分のスロットをタップしてください')}
                </p>
            )}

            {/* スロット一覧 */}
            <div className="grid grid-cols-4 gap-2">
                {sortedMembers.map(member => {
                    const job = member.jobId ? JOBS.find(j => j.id === member.jobId) : null;
                    const isMyJob = myMemberId === member.id;
                    const isFocused = focusedSlot === member.id;

                    return (
                        <button
                            key={member.id}
                            onClick={() => {
                                if (myJobMode) {
                                    setMyMemberId(isMyJob ? null : member.id);
                                    setMyJobMode(false);
                                } else {
                                    setFocusedSlot(isFocused ? null : member.id);
                                }
                            }}
                            className={clsx(
                                "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 relative cursor-pointer",
                                myJobMode
                                    ? "border-app-text/50 bg-app-text/5"
                                    : isFocused
                                        ? "border-app-text bg-app-text/10"
                                        : "border-app-border bg-app-surface2"
                            )}
                        >
                            {job ? (
                                <img src={job.icon} className="w-8 h-8 object-contain" />
                            ) : (
                                <div className="w-8 h-8 rounded-full border border-dashed border-app-border flex items-center justify-center">
                                    <span className="text-[10px] text-app-text-muted">+</span>
                                </div>
                            )}
                            <span className="text-[10px] font-black text-app-text">{member.id}</span>
                            {isMyJob && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-app-text rounded-full flex items-center justify-center">
                                    <Star size={8} className="text-app-bg fill-app-bg" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ジョブ選択グリッド（スロット選択時） */}
            {focusedSlot && !myJobMode && (
                <div className="bg-app-surface2/50 rounded-xl p-3 border border-app-border">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-app-text-muted uppercase tracking-wider">
                            {focusedSlot} — {t('party.select_job')}
                        </span>
                        <button onClick={() => setFocusedSlot(null)} className="text-app-text-muted p-1 cursor-pointer">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                        {JOBS.map(job => {
                            const isCurrentJob = partyMembers.find(m => m.id === focusedSlot)?.jobId === job.id;
                            return (
                                <button
                                    key={job.id}
                                    onClick={() => handleJobChange(focusedSlot, job.id)}
                                    className={clsx(
                                        "w-10 h-10 rounded-lg border flex items-center justify-center cursor-pointer active:scale-90 transition-all",
                                        isCurrentJob
                                            ? "bg-app-text/20 border-app-text"
                                            : "bg-app-surface2 border-app-border"
                                    )}
                                >
                                    <img src={job.icon} alt={job.name?.ja} className="w-7 h-7 object-contain" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ジョブ変更マイグレーション確認モーダル */}
            {migrationPending && (
                <JobMigrationModal
                    isOpen={true}
                    oldJob={migrationPending.oldJob}
                    newJob={migrationPending.newJob}
                    memberName={migrationPending.memberId}
                    onConfirm={handleMigrationConfirm}
                    onCancel={() => setMigrationPending(null)}
                />
            )}
        </div>
    );
};

// ── モバイル用ステータス表示 ──
const MobileStatusView: React.FC = () => {
    const { t } = useTranslation();
    const partyMembers = useMitigationStore(s => s.partyMembers);
    const myMemberId = useMitigationStore(s => s.myMemberId);

    const memberOrder = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
    const sortedMembers = memberOrder.map(id => partyMembers.find(m => m.id === id)).filter(Boolean) as typeof partyMembers;

    return (
        <div className="flex flex-col gap-2">
            {sortedMembers.map(member => {
                const job = member.jobId ? JOBS.find(j => j.id === member.jobId) : null;
                const isMyJob = myMemberId === member.id;
                return (
                    <div key={member.id} className={clsx(
                        "flex items-center gap-3 px-3 py-2 rounded-xl border",
                        isMyJob ? "border-app-text/50 bg-app-text/5" : "border-app-border bg-app-surface2"
                    )}>
                        {job ? (
                            <img src={job.icon} className="w-6 h-6 object-contain shrink-0" />
                        ) : (
                            <div className="w-6 h-6 rounded-full border border-dashed border-app-border shrink-0" />
                        )}
                        <span className="text-[11px] font-black text-app-text w-6">{member.id}</span>
                        <div className="flex-1 flex items-center gap-3 text-[10px] text-app-text-muted font-mono">
                            <span>{t('party.hp_label', 'HP')} {member.stats?.hp?.toLocaleString() || '—'}</span>
                        </div>
                        {isMyJob && <Star size={12} className="text-app-text fill-app-text shrink-0" />}
                    </div>
                );
            })}
        </div>
    );
};

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

    // 自動保存（ページ離脱 + タブ切替 + 30秒間隔）
    // Firestore同期: タブ切替 / ページ離脱 / プラン切替 / 3分間隔
    React.useEffect(() => {
        /** localStorage への即時保存 */
        const saveSilently = () => {
            const planStore = usePlanStore.getState();
            const mitiStore = useMitigationStore.getState();
            if (planStore.currentPlanId) {
                planStore.updatePlan(planStore.currentPlanId, { data: mitiStore.getSnapshot() });
            }
        };

        /** Firestoreへの同期（ログイン中 + dirtyがある場合のみ） */
        const syncToCloud = () => {
            const authState = useAuthStore.getState();
            const planStore = usePlanStore.getState();
            if (authState.user && planStore.hasDirtyPlans()) {
                planStore.syncToFirestore(
                    authState.user.uid,
                    authState.user.displayName || 'Guest',
                );
            }
        };

        /** ページ離脱時: localStorage保存 + Firestore強制同期 */
        const onBeforeUnload = () => {
            saveSilently();
            syncToCloud();
        };

        /** タブ切替時: 非表示になったら保存+同期 */
        const onVisibilityChange = () => {
            if (document.hidden) {
                saveSilently();
                syncToCloud();
            }
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('visibilitychange', onVisibilityChange);

        // localStorage: 30秒間隔の定期保存（無音）
        const localInterval = setInterval(saveSilently, 30_000);
        // Firestore: 3分間隔の定期同期
        const cloudInterval = setInterval(syncToCloud, 180_000);

        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            clearInterval(localInterval);
            clearInterval(cloudInterval);
        };
    }, [t]);

    // ログイン時のデータマイグレーション（localStorageのプランをFirestoreにアップロード）
    const authUser = useAuthStore((s) => s.user);
    const authLoading = useAuthStore((s) => s.loading);
    const [hasMigrated, setHasMigrated] = React.useState(false);
    React.useEffect(() => {
        if (authLoading || !authUser || hasMigrated) return;
        setHasMigrated(true);
        const planStore = usePlanStore.getState();
        planStore.migrateOnLogin(
            authUser.uid,
            authUser.displayName || 'Guest',
        );
    }, [authUser, authLoading, hasMigrated]);

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
                height="70vh"
            >
                <div className="-mx-4 -mt-3">
                    <Sidebar isOpen={true} fullWidth />
                </div>
            </MobileBottomSheet>

            {/* Mobile: パーティ編成 */}
            <MobileBottomSheet
                isOpen={mobilePartyOpen}
                onClose={() => setMobilePartyOpen(false)}
                title={t('nav.party')}
                height="70vh"
            >
                <MobilePartySettings />
            </MobileBottomSheet>

            {/* Mobile: ステータス（パーティHP等の確認） */}
            <MobileBottomSheet
                isOpen={mobileStatusOpen}
                onClose={() => setMobileStatusOpen(false)}
                title={t('nav.status')}
                height="50vh"
            >
                <MobileStatusView />
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
                <MobileHeader
                    onHome={() => navigate('/')}
                    theme={theme}
                    onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                />

                {/* Main content — add bottom padding on mobile for bottom nav */}
                {/* モバイルではフローティングヘッダーが非表示なのでpaddingTop不要 */}
                <motion.main
                    className="flex-1 flex flex-col relative overflow-hidden pb-16 md:pb-0"
                    initial={false}
                    animate={{ paddingTop: isMobile ? 0 : (isHeaderCollapsed ? 36 : 124) }}
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
                    <p className="text-[8px] text-app-text-muted tracking-wide pointer-events-auto">
                        {t('footer.copyright')} · {t('footer.disclaimer')}
                        {' · '}
                        <a href="/privacy" className="underline hover:text-app-text transition-colors">{t('footer.privacy_policy')}</a>
                        {' · '}
                        <a href="/terms" className="underline hover:text-app-text transition-colors">{t('footer.terms')}</a>
                    </p>
                </footer>
                </MobileTriggersContext.Provider>
            </div>

            {/* Mobile Bottom Nav — 排他制御付きトグル */}
            <MobileBottomNav
                onMenuToggle={() => {
                    const next = !mobileMenuOpen;
                    setMobileMenuOpen(next);
                    if (next) { setMobilePartyOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); }
                }}
                onPartyOpen={() => {
                    const next = !mobilePartyOpen;
                    setMobilePartyOpen(next);
                    if (next) { setMobileMenuOpen(false); setMobileStatusOpen(false); setMobileToolsOpen(false); }
                }}
                onStatusOpen={() => {
                    const next = !mobileStatusOpen;
                    setMobileStatusOpen(next);
                    if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileToolsOpen(false); }
                }}
                onToolsOpen={() => {
                    const next = !mobileToolsOpen;
                    setMobileToolsOpen(next);
                    if (next) { setMobileMenuOpen(false); setMobilePartyOpen(false); setMobileStatusOpen(false); }
                }}
                myJobHighlight={myJobHighlight}
                onMyJobHighlightToggle={() => setMyJobHighlight(!myJobHighlight)}
                activeTab={mobileMenuOpen ? 'menu' : mobilePartyOpen ? 'party' : mobileToolsOpen ? 'tools' : mobileStatusOpen ? 'status' : undefined}
            />
        </div>
    );
};