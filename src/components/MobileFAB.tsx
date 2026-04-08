import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    MoreHorizontal, X, List, Tag, Search,
    Cloud, CloudCheck, CloudUpload, CloudAlert,
    Globe, Sun, Moon,
    Rows3, AlignJustify,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/useAuthStore';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useThemeStore } from '../store/useThemeStore';
import type { ContentLanguage } from '../store/useThemeStore';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
import { SPRING, STAGGER } from '../tokens/motionTokens';

interface MobileFABProps {
    onToggleTheme: () => void;
    theme: string;
    onPhaseJump?: () => void;
    onLabelJump?: () => void;
    onMechanicSearch?: () => void;
    onToggleExpand?: () => void;
    hideEmptyRows?: boolean;
}

const LANG_CYCLE: ContentLanguage[] = ['ja', 'en', 'zh', 'ko'];

// ─── Sync ボタン内ロジック（SyncButton.tsx と同じ） ───
function useSyncState() {
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const cloudStatus = usePlanStore(s => s._cloudStatus);
    const user = useAuthStore(s => s.user);
    const profileDisplayName = useAuthStore(s => s.profileDisplayName);

    const handleSync = () => {
        if (!user) return;
        const planStore = usePlanStore.getState();
        if (planStore.currentPlanId) {
            const snapshot = useMitigationStore.getState().getSnapshot();
            planStore.updatePlan(planStore.currentPlanId, { data: snapshot });
        }
        planStore.manualSync(user.uid, profileDisplayName || 'User');
    };

    return { canSync: !!(currentPlanId && user), cloudStatus, handleSync };
}

export const MobileFAB: React.FC<MobileFABProps> = ({
    onToggleTheme,
    theme,
    onPhaseJump,
    onLabelJump,
    onMechanicSearch,
    onToggleExpand,
    hideEmptyRows,
}) => {
    const { t, i18n } = useTranslation();
    const { setContentLanguage } = useThemeStore();
    const { runTransition } = useTransitionOverlay();
    const [open, setOpen] = React.useState(false);
    const { canSync, cloudStatus, handleSync } = useSyncState();

    const close = () => setOpen(false);

    // 言語サイクル: ja → en → zh → ko → ja
    const handleLanguage = () => {
        const current = i18n.language as ContentLanguage;
        const idx = LANG_CYCLE.indexOf(current);
        const next = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];
        close();
        runTransition(() => {
            i18n.changeLanguage(next);
            setContentLanguage(next);
        }, 'language');
    };

    // テーマ切替
    const handleTheme = () => {
        close();
        onToggleTheme();
    };

    // 同期
    const handleSyncClick = () => {
        if (cloudStatus === 'syncing') return;
        handleSync();
        close();
    };

    // ナビゲーションアクション
    const handlePhase = () => { close(); onPhaseJump?.(); };
    const handleLabel = () => { close(); onLabelJump?.(); };
    const handleSearch = () => { close(); onMechanicSearch?.(); };

    // Sync アイコン選択
    let SyncIcon = canSync ? CloudCheck : Cloud;
    let syncIconClass = canSync ? 'text-app-blue' : 'text-app-text-muted';
    let syncAnimate = '';
    if (canSync && cloudStatus === 'syncing') {
        SyncIcon = CloudUpload;
        syncIconClass = 'text-app-text/40';
        syncAnimate = 'animate-pulse';
    } else if (canSync && cloudStatus === 'error') {
        SyncIcon = CloudAlert;
        syncIconClass = 'text-red-400';
    }

    // FAB items
    const navItems = [
        {
            key: 'expand',
            label: hideEmptyRows ? t('app.fab_expand') : t('app.fab_collapse'),
            icon: hideEmptyRows ? <Rows3 size={20} /> : <AlignJustify size={20} />,
            onClick: () => { close(); onToggleExpand?.(); },
            accent: false,
        },
        {
            key: 'phase',
            label: t('app.fab_phase'),
            icon: <List size={20} />,
            onClick: handlePhase,
            accent: false,
        },
        {
            key: 'label',
            label: t('app.fab_label'),
            icon: <Tag size={20} />,
            onClick: handleLabel,
            accent: false,
        },
        {
            key: 'search',
            label: t('app.fab_search'),
            icon: <Search size={20} />,
            onClick: handleSearch,
            accent: false,
        },
    ];

    const settingsItems = [
        {
            key: 'sync',
            label: t('app.fab_sync'),
            icon: <SyncIcon size={20} className={clsx(syncAnimate, syncIconClass)} />,
            onClick: handleSyncClick,
            accent: true,
            disabled: canSync && cloudStatus === 'syncing',
        },
        {
            key: 'language',
            label: t('app.fab_language'),
            icon: <Globe size={20} />,
            onClick: handleLanguage,
            accent: false,
        },
        {
            key: 'theme',
            label: t('app.fab_theme'),
            icon: theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />,
            onClick: handleTheme,
            accent: false,
        },
    ];

    // アニメーション: トークン使用
    const itemVariants = {
        hidden: { opacity: 0, y: 16, scale: 0.85 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                ...SPRING.default,
                delay: i * (STAGGER.fab / 1000),
            },
        }),
        exit: (i: number) => ({
            opacity: 0,
            y: 12,
            scale: 0.85,
            transition: {
                ...SPRING.snappy,
                delay: i * 0.025,
            },
        }),
    };

    const allItems = [...navItems, 'divider' as const, ...settingsItems];

    return (
        <div className="fixed bottom-20 right-4 z-[300] md:hidden flex flex-col items-end gap-0">

            {/* 背景オーバーレイ */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="fab-overlay"
                        className="fixed inset-0 z-[-1]"
                        style={{ backgroundColor: 'var(--color-overlay)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={close}
                    />
                )}
            </AnimatePresence>

            {/* メニュー項目 */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="fab-menu"
                        className="flex flex-col items-end gap-2 mb-3"
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                    >
                        {allItems.map((item, idx) => {
                            if (item === 'divider') {
                                return (
                                    <motion.div
                                        key="divider"
                                        custom={idx}
                                        variants={itemVariants}
                                        className="w-28 h-px bg-app-border/60 my-0.5 mr-1"
                                    />
                                );
                            }
                            const isSync = item.key === 'sync';
                            return (
                                <motion.div
                                    key={item.key}
                                    custom={idx}
                                    variants={itemVariants}
                                    className="flex items-center gap-2.5"
                                >
                                    {/* ラベル（ボタンの左） */}
                                    <span className="text-[13px] font-semibold text-white/90 bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1 select-none whitespace-nowrap shadow-md">
                                        {item.label}
                                    </span>

                                    {/* ボタン */}
                                    <button
                                        onClick={item.onClick}
                                        disabled={'disabled' in item ? Boolean(item.disabled) : false}
                                        className={clsx(
                                            "flex items-center justify-center border",
                                            "shadow-lg active:scale-90 transition-transform duration-100",
                                            "disabled:pointer-events-none disabled:opacity-40",
                                            isSync
                                                ? "bg-app-blue/12 border-app-blue/20 text-app-blue"
                                                : "text-app-text"
                                        )}
                                        style={{
                                            width: MOBILE_TOKENS.fab.itemSize,
                                            height: MOBILE_TOKENS.fab.itemSize,
                                            borderRadius: MOBILE_TOKENS.fab.radius,
                                            ...(!isSync ? {
                                                backgroundColor: 'var(--color-fab-bg)',
                                                borderColor: 'var(--color-fab-border)',
                                            } : {}),
                                        }}
                                    >
                                        {item.icon}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* メインFABボタン */}
            <motion.button
                onClick={() => setOpen(prev => !prev)}
                className="flex items-center justify-center border text-app-text shadow-xl active:scale-90 transition-all duration-200"
                style={{
                    width: MOBILE_TOKENS.fab.size,
                    height: MOBILE_TOKENS.fab.size,
                    borderRadius: MOBILE_TOKENS.fab.radius,
                    backgroundColor: 'var(--color-fab-bg)',
                    borderColor: 'var(--color-fab-border)',
                }}
                whileTap={{ scale: 0.88 }}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {open ? (
                        <motion.span
                            key="close"
                            initial={{ rotate: -45, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 45, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <X size={22} />
                        </motion.span>
                    ) : (
                        <motion.span
                            key="open"
                            initial={{ rotate: 45, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -45, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <MoreHorizontal size={22} />
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
};
