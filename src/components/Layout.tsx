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
import { LoPoButton } from './LoPoButton';
import { PulseSettings } from './PulseSettings';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import { useJobs } from '../hooks/useSkillsData';
import { Sun, Moon, X, Star, LogOut, Loader2 } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { motion } from 'framer-motion';
import clsx from 'clsx';
// import { ParticleBackground } from './ParticleBackground';
import { GridOverlay } from './GridOverlay';
import { JobMigrationModal } from './JobMigrationModal';
import { ConfirmDialog } from './ConfirmDialog';
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
            {/* 左: LoPoロゴ（Homeリンク兼用） */}
            <button
                onClick={onHome}
                className="p-1 text-app-text flex items-center shrink-0 cursor-pointer"
            >
                <LoPoButton size="sm" />
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
    const JOBS = useJobs();
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
    const JOBS = useJobs();
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

// ── モバイル用パーティ＋ステータスタブ ──
const MobilePartyWithTabs: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = React.useState<'party' | 'status'>('party');

    return (
        <div className="flex flex-col gap-3">
            {/* タブ切り替え */}
            <div className="flex rounded-xl bg-app-surface2 border border-app-border p-0.5">
                <button
                    onClick={() => setActiveTab('party')}
                    className={clsx(
                        "flex-1 py-2 text-xs font-black tracking-wide rounded-lg transition-all cursor-pointer",
                        activeTab === 'party'
                            ? "bg-app-text text-app-bg"
                            : "text-app-text-muted"
                    )}
                >
                    {t('nav.tab_party')}
                </button>
                <button
                    onClick={() => setActiveTab('status')}
                    className={clsx(
                        "flex-1 py-2 text-xs font-black tracking-wide rounded-lg transition-all cursor-pointer",
                        activeTab === 'status'
                            ? "bg-app-text text-app-bg"
                            : "text-app-text-muted"
                    )}
                >
                    {t('nav.tab_status')}
                </button>
            </div>

            {/* タブの中身 */}
            {activeTab === 'party' ? <MobilePartySettings /> : <MobileStatusView />}
        </div>
    );
};

// ── モバイル用アカウントメニュー（ログイン済み時） ──
const MobileAccountMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const signOut = useAuthStore((s) => s.signOut);
    const deleteAccount = useAuthStore((s) => s.deleteAccount);
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        onClose();
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            await deleteAccount();
            onClose();
            navigate('/');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (!user) return null;

    return (
        <div className="flex flex-col gap-4">
            {/* ユーザー情報 */}
            <div className="flex items-center gap-3 px-1">
                {user.photoURL ? (
                    <img
                        src={user.photoURL}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-app-border"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-app-surface2 border border-app-border flex items-center justify-center">
                        <span className="text-sm font-bold text-app-text">
                            {(user.displayName || '?')[0]}
                        </span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-app-text truncate">
                        {user.displayName || t('nav.account')}
                    </p>
                    <p className="text-[10px] text-app-text-muted truncate">
                        {user.email || ''}
                    </p>
                </div>
            </div>

            {/* ログアウトボタン */}
            <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-app-border text-sm font-bold text-app-text bg-app-surface2 active:bg-app-text/10 transition-colors cursor-pointer"
            >
                <LogOut size={16} />
                {t('nav.logout')}
            </button>

            {/* アカウント削除（控えめ配置） */}
            <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-[10px] text-app-text-muted/50 hover:text-app-text-muted transition-colors cursor-pointer py-1"
            >
                {t('nav.deleteAccount')}
            </button>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onConfirm={handleDeleteAccount}
                onCancel={() => setShowDeleteConfirm(false)}
                title={t('nav.deleteAccountTitle')}
                message={isDeleting ? '...' : t('nav.deleteAccountMessage')}
                confirmLabel={t('nav.deleteAccountConfirm')}
                variant="danger"
            />
        </div>
    );
};

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
    const [mobileLoginModalOpen, setMobileLoginModalOpen] = React.useState(false);
    const [mobileAccountOpen, setMobileAccountOpen] = React.useState(false);
    const { timelineSortOrder, setTimelineSortOrder } = useMitigationStore();
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

    // 自動保存（2層構造）
    // localStorage: 変更検知→500msデバウンス→即時保存（コストゼロ）
    // Firestore: イベント駆動のみ（ページ離脱 / タブ非表示 / プラン切替時）→ DAU 3,000でも無料枠内
    React.useEffect(() => {
        /** localStorage への保存 */
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
                ).catch(() => {});
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
            }, 500);
        });

        /** ページ離脱時: localStorage即時保存 + Firestore同期 */
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
            saveSilently();
            syncToCloud();
            // 未ログインでプランがある場合、離脱前に警告
            const authState = useAuthStore.getState();
            const planState = usePlanStore.getState();
            if (!authState.user && planState.plans.length > 0) {
                e.preventDefault();
            }
        };

        /** タブ切替時: 非表示になったらlocalStorage保存 + Firestore同期 */
        const onVisibilityChange = () => {
            if (document.hidden) {
                if (localDebounceTimer) clearTimeout(localDebounceTimer);
                saveSilently();
                syncToCloud();
                usePlanStore.getState().setSaveStatus('saved');
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
                syncToCloud();
            }
        });

        return () => {
            unsubMiti();
            unsubPlan();
            if (localDebounceTimer) clearTimeout(localDebounceTimer);
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
        planStore.migrateOnLogin(
            authUser.uid,
            authUser.displayName || 'Guest',
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

    // ログイン成功時: 表が見える前にオーバーレイを表示（チラつき防止）
    const justLoggedInUser = useAuthStore((s) => s.justLoggedInUser);
    // リダイレクト認証の戻り検知（Discord/Twitter — ページロード前に即座に判定）
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

            {/* リダイレクト認証中オーバーレイ — Discord/Twitterからの戻り時、processPendingAuth完了前に表示 */}
            {isAuthRedirecting && !justLoggedInUser && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-app-bg">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 size={28} className="animate-spin text-app-text-muted" />
                        <p className="text-sm font-medium text-app-text-muted">{t('login.authenticating')}</p>
                    </div>
                </div>
            )}

            {/* ログイン成功オーバーレイ — 表の描画より先にウェルカム画面を全面表示（チラつき防止） */}
            {justLoggedInUser && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
                    <div className="flex flex-col items-center gap-5 animate-[dialogIn_300ms_cubic-bezier(0.2,0.8,0.2,1)] bg-app-bg border border-app-border rounded-2xl px-10 py-8 shadow-2xl max-w-[380px]">
                        {justLoggedInUser.photoURL ? (
                            <img src={justLoggedInUser.photoURL} alt="" className="w-16 h-16 rounded-full ring-2 ring-app-border shadow-lg" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-app-surface2 flex items-center justify-center ring-2 ring-app-border">
                                <span className="text-2xl font-bold text-app-text">{(justLoggedInUser.displayName || 'U').charAt(0).toUpperCase()}</span>
                            </div>
                        )}
                        <div className="text-center">
                            <h2 className="text-lg font-bold text-app-text mb-1" style={{ fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif" }}>
                                {t('login.success_title')}
                            </h2>
                            <p className="text-sm text-app-text-muted">
                                {t('login.welcome', { name: justLoggedInUser.displayName || 'User' })}
                            </p>
                        </div>
                        <button
                            onClick={() => { useAuthStore.getState().clearJustLoggedIn(); }}
                            className="w-full py-2.5 rounded-xl text-sm font-bold bg-app-text text-app-bg hover:opacity-80 active:scale-[0.98] transition-all cursor-pointer"
                        >
                            {t('login.start_button')}
                        </button>
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
                                <p className={`${isMobile ? 'text-sm' : 'text-base'} text-app-text font-medium tracking-[0.15em]`}>
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
                    <p className="text-[8px] text-app-text-muted tracking-wide pointer-events-auto">
                        {t('footer.copyright')} · {t('footer.disclaimer')}
                        {' · '}
                        <a href="/privacy" className="underline hover:text-app-text transition-colors">{t('footer.privacy_policy')}</a>
                        {' · '}
                        <a href="/terms" className="underline hover:text-app-text transition-colors">{t('footer.terms')}</a>
                        {' · '}
                        <a href="/commercial" className="underline hover:text-app-text transition-colors">{t('footer.commercial')}</a>
                        {' · '}
                        <a href="https://discord.gg/V288kfPFMG" target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text transition-colors">{t('footer.discord')}</a>
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