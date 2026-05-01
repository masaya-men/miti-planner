import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    MoreHorizontal, X, List, Tag, Search,
    Cloud, CloudCheck, CloudUpload, CloudAlert,
    Globe, Sun, Moon,
    Rows3, AlignJustify, PictureInPicture2,
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

const LANG_LABELS: Record<ContentLanguage, string> = {
    ja: '日',
    en: 'EN',
    zh: '中',
    ko: '한',
};

// 言語チップレイアウト定数 — 「言語」ラベルの左に一直線
const LANG_CHIP_SIZE = 42;
const LANG_CHIP_GAP = 8;
// 表示順序（左から: 日 EN 中 한→ 右端が現在地に近い）
const LANG_DISPLAY_ORDER: ContentLanguage[] = ['ja', 'en', 'zh', 'ko'];

// i番目のチップのx位置（Globeボタン中心基準、左方向=負）
// Globeボタン(44px) + gap(10px) + ラベル幅(≈50px) + gap(12px) + チップ列
function langChipX(i: number): number {
    const labelOffset = -(MOBILE_TOKENS.fab.itemSize / 2 + 10 + 50 + 12);
    return labelOffset - (LANG_DISPLAY_ORDER.length - 1 - i) * (LANG_CHIP_SIZE + LANG_CHIP_GAP) - LANG_CHIP_SIZE / 2;
}

// 言語チップのアニメーション variants
const langChipVariants = {
    hidden: {
        x: 0,
        scale: 0,
        opacity: 0,
    },
    visible: (custom: { i: number; targetX: number }) => ({
        x: custom.targetX,
        scale: 1,
        opacity: 1,
        transition: {
            ...SPRING.bouncy,
            delay: custom.i * 0.05,
        },
    }),
    exit: (custom: { i: number; lang: ContentLanguage; selectedLang: ContentLanguage | null }) => {
        const isSelected = custom.selectedLang === custom.lang;
        if (isSelected) {
            return {
                x: 0,
                scale: 0,
                opacity: 0,
                transition: {
                    duration: 0.2,
                    ease: 'easeIn' as const,
                },
            };
        }
        const totalChips = LANG_DISPLAY_ORDER.length;
        return {
            x: 0,
            scale: 0,
            opacity: 0,
            transition: {
                ...SPRING.snappy,
                delay: (totalChips - 1 - custom.i) * 0.04,
            },
        };
    },
    tap: {
        scale: 1.3,
        transition: { duration: 0.1 },
    },
};

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
    const [langOpen, setLangOpen] = React.useState(false);
    const [selectedLang, setSelectedLang] = React.useState<ContentLanguage | null>(null);
    const langTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const { canSync, cloudStatus, handleSync } = useSyncState();

    // 言語切替タイマーのクリーンアップ
    React.useEffect(() => {
        return () => {
            if (langTimerRef.current) {
                clearTimeout(langTimerRef.current);
            }
        };
    }, []);

    const close = () => {
        setLangOpen(false);
        setOpen(false);
    };

    // 言語円弧セレクターのトグル
    const handleLanguageToggle = () => {
        setLangOpen(prev => !prev);
    };

    // 言語選択実行（選択チップをscale 1.3→吸い込み、他は逆staggerで中心へ）
    const handleLanguageSelect = (lang: ContentLanguage) => {
        const current = i18n.language as ContentLanguage;
        if (lang === current) {
            setLangOpen(false);
            return;
        }
        setSelectedLang(lang);
        // 吸い込みアニメーション完了を待ってからトランジション実行
        const exitDuration = LANG_DISPLAY_ORDER.length * 0.04 + 0.2; // stagger + base
        langTimerRef.current = setTimeout(() => {
            setLangOpen(false);
            setSelectedLang(null);
            close();
            runTransition(() => {
                i18n.changeLanguage(lang);
                setContentLanguage(lang);
            }, 'language');
        }, exitDuration * 1000);
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
        {
            key: 'cueSheet',
            label: t('app.fab_cue_sheet'),
            icon: <PictureInPicture2 size={20} />,
            onClick: () => { close(); window.dispatchEvent(new Event('mobile:open-cue-sheet')); },
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
            onClick: handleLanguageToggle,
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
                            const isLang = item.key === 'language';
                            return (
                                <motion.div
                                    key={item.key}
                                    custom={idx}
                                    variants={itemVariants}
                                    className="flex items-center gap-2.5"
                                    style={isLang ? { position: 'relative' } : undefined}
                                >
                                    {/* ラベル（ボタンの左） */}
                                    <span className="text-[13px] font-semibold text-white/90 bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1 select-none whitespace-nowrap shadow-md">
                                        {item.label}
                                    </span>

                                    {/* ボタン */}
                                    {isLang ? (
                                        <motion.button
                                            onClick={item.onClick}
                                            className={clsx(
                                                "flex items-center justify-center border",
                                                "shadow-lg active:scale-90 transition-transform duration-100",
                                                "text-app-text"
                                            )}
                                            style={{
                                                width: MOBILE_TOKENS.fab.itemSize,
                                                height: MOBILE_TOKENS.fab.itemSize,
                                                borderRadius: MOBILE_TOKENS.fab.radius,
                                                backgroundColor: 'var(--color-fab-bg)',
                                                borderColor: 'var(--color-fab-border)',
                                            }}
                                            animate={langOpen ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                                            whileTap={{ scale: 0.9 }}
                                            transition={{ duration: 0.12 }}
                                        >
                                            {item.icon}
                                        </motion.button>
                                    ) : (
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
                                    )}

                                    {/* 言語チップ — 「言語」ラベルの左に一直線展開 */}
                                    {isLang && (
                                        <AnimatePresence>
                                            {langOpen && LANG_DISPLAY_ORDER.map((lang: ContentLanguage, i: number) => (
                                                <motion.button
                                                    key={lang}
                                                    custom={{ i, lang, selectedLang, targetX: langChipX(i) }}
                                                    variants={langChipVariants}
                                                    initial="hidden"
                                                    animate="visible"
                                                    exit="exit"
                                                    whileTap="tap"
                                                    onClick={() => handleLanguageSelect(lang)}
                                                    className={clsx(
                                                        "absolute flex items-center justify-center rounded-full",
                                                        "font-semibold text-[13px] shadow-lg select-none",
                                                        lang === (i18n.language as ContentLanguage)
                                                            ? "bg-app-blue text-white shadow-app-blue/30"
                                                            : "bg-black/70 text-white/90 backdrop-blur-sm"
                                                    )}
                                                    style={{
                                                        width: LANG_CHIP_SIZE,
                                                        height: LANG_CHIP_SIZE,
                                                        right: (MOBILE_TOKENS.fab.itemSize - LANG_CHIP_SIZE) / 2,
                                                        top: (MOBILE_TOKENS.fab.itemSize - LANG_CHIP_SIZE) / 2,
                                                    }}
                                                >
                                                    {LANG_LABELS[lang]}
                                                </motion.button>
                                            ))}
                                        </AnimatePresence>
                                    )}
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
