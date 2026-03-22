import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Home, HelpCircle, Sun, Moon, CloudDownload,
    ChevronUp, ChevronDown,
    Users, Activity, Wand2, Star
} from 'lucide-react';
import clsx from 'clsx';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { PartyStatusPopover } from './PartyStatusPopover';
import { Tooltip } from './ui/Tooltip';

interface ConsolidatedHeaderProps {
    onAutoPlan: () => void;
    onImportLogs: () => void;
    partySortOrder: 'light_party' | 'role';
    setPartySortOrder: (order: 'light_party' | 'role') => void;
    statusOpen: boolean;
    setStatusOpen: (open: boolean) => void;
    setPartySettingsOpen: (open: boolean) => void;
}

// ホバー: 白黒反転（ライト→黒塗り白文字 / ダーク→白塗り黒文字）
const hoverInvert = "hover:bg-app-text hover:border-app-text hover:text-app-bg";

// アイコン丸ボタン共通スタイル（1px border で統一）
const iconBtnBase = "group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95";
const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

// テキスト付きピルボタン共通スタイル（1px border で統一）
const pillBtnBase = "group flex items-center gap-2 px-3.5 h-9 rounded-full border whitespace-nowrap transition-all duration-300 cursor-pointer active:scale-95";
const pillBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;
const pillBtnActive = `bg-[rgba(var(--app-accent-rgb),0.15)] border-[rgba(var(--app-accent-rgb),0.6)] text-app-accent shadow-[0_0_14px_rgba(var(--app-accent-rgb),0.35)] ${hoverInvert}`;

export const ConsolidatedHeader: React.FC<ConsolidatedHeaderProps> = ({
    onAutoPlan,
    onImportLogs,
    partySortOrder,
    setPartySortOrder,
    statusOpen,
    setStatusOpen,
    setPartySettingsOpen
}) => {
    const { t } = useTranslation();
    const { theme, setTheme } = useThemeStore();
    const { myJobHighlight, setMyJobHighlight } = useMitigationStore();
    const navigate = useNavigate();
    const {
        isHeaderCollapsed, setIsHeaderCollapsed
    } = useContext(MobileTriggersContext);

    const timelineEvents = useMitigationStore(state => state.timelineEvents);
    const needsImport = timelineEvents?.length === 0;

    // ── Sidebar.tsx パターンの近接・ホバーState ──
    const [isNear, setIsNear] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);

    const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearLeaveTimer = () => {
        if (leaveTimerRef.current) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = null;
        }
    };

    const handleLeave = (e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const isMovingUp = e.clientY < rect.top;
        if (isMovingUp) {
            clearLeaveTimer();
            setIsNear(false);
            setIsHovered(false);
        } else {
            clearLeaveTimer();
            leaveTimerRef.current = setTimeout(() => {
                setIsNear(false);
                setIsHovered(false);
            }, 80);
        }
    };

    return (

        <motion.div
            className="absolute top-0 left-0 w-full z-[100] flex flex-col pointer-events-none"
            initial={false}
        >
            {/* [1] ── ヘッダー本体コンテナ ── */}
            <motion.div
                initial={false}
                animate={{
                    height: isHeaderCollapsed ? 0 : 96,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full overflow-hidden pointer-events-auto bg-glass-header shadow-sm"
                onMouseEnter={() => { clearLeaveTimer(); setIsNear(false); setIsHovered(false); }}
            >
                <motion.div
                    className="flex flex-col w-full h-[96px]"
                    initial={false}
                    animate={{ y: (isNear || isHovered) ? -5 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                >
                    {/* Layer A（上段・表から遠い）: ナビ + ユーティリティ */}
                    <div className="h-12 flex items-center justify-between pl-12 pr-6 border-b border-app-border shrink-0">
                        <div className="flex items-center gap-2">
                            <Tooltip content={t('app.return_home')}>
                                <button
                                    onClick={() => navigate('/')}
                                    className={clsx(iconBtnBase, iconBtnDefault)}
                                >
                                    <Home size={16} className="group-hover:-translate-y-0.5 transition-transform duration-300" />
                                </button>
                            </Tooltip>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {/* Tutorial */}
                            <button
                                onClick={() => {
                                    const path = window.location.pathname;
                                    if (path === '/' || path === '') {
                                        useTutorialStore.getState().startTutorial();
                                    } else {
                                        useTutorialStore.getState().startFromStep(1);
                                    }
                                }}
                                className={clsx(pillBtnBase, pillBtnDefault)}
                            >
                                <HelpCircle size={14} className="group-hover:rotate-12 transition-transform duration-300 shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-[0.1em]">{t('app.view_tutorial')}</span>
                            </button>

                            <div className="h-5 w-[1px] bg-app-border mx-0.5 rounded-full" />

                            {/* Theme toggle */}
                            <Tooltip content={theme === 'dark' ? t('app.toggle_theme_light') : t('app.toggle_theme_dark')}>
                                <button
                                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                    className={clsx(iconBtnBase, iconBtnDefault)}
                                >
                                    {theme === 'dark'
                                        ? <Sun size={16} className="group-hover:rotate-90 transition-transform duration-500" />
                                        : <Moon size={16} className="group-hover:-rotate-12 transition-transform duration-300" />
                                    }
                                </button>
                            </Tooltip>

                            <LanguageSwitcher />
                        </div>
                    </div>

                    {/* Layer B（下段・表に近い）: ツールボタン群 */}
                    <div className="h-12 flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-1.5">
                            {/* Party Comp */}
                            <button
                                data-tutorial="party-comp"
                                onClick={() => {
                                    setPartySettingsOpen(true);
                                    useTutorialStore.getState().completeEvent('party-settings:opened');
                                }}
                                className={clsx(pillBtnBase, pillBtnDefault)}
                            >
                                <Users size={14} className="group-hover:scale-110 transition-transform duration-300 shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-[0.1em]">{t('party.comp_short')}</span>
                            </button>

                            {/* Status */}
                            <button
                                onClick={() => {
                                    setStatusOpen(!statusOpen);
                                    if (!statusOpen) useTutorialStore.getState().completeEvent('status:opened');
                                }}
                                className={clsx(pillBtnBase, statusOpen ? pillBtnActive : pillBtnDefault)}
                            >
                                <Activity size={14} className={clsx("transition-transform duration-300 shrink-0", statusOpen ? "drop-shadow-[0_0_6px_rgba(var(--app-accent-rgb),0.5)]" : "group-hover:scale-110")} />
                                <span className="text-[10px] font-black uppercase tracking-[0.1em]">{t('settings.config_short')}</span>
                            </button>

                            {/* Auto Plan */}
                            <button
                                onClick={onAutoPlan}
                                className={clsx(pillBtnBase, pillBtnDefault)}
                            >
                                <Wand2 size={14} className="group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300 shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-[0.1em]">{t('mitigation.auto_plan')}</span>
                            </button>

                            {/* Import（アイコンのみ） */}
                            <Tooltip content={t('timeline.import_fflogs')}>
                                <button
                                    onClick={onImportLogs}
                                    className={clsx(
                                        iconBtnBase,
                                        needsImport
                                            ? "bg-[rgba(var(--app-accent-rgb),0.15)] border-[rgba(var(--app-accent-rgb),0.6)] text-app-accent shadow-[0_0_20px_rgba(var(--app-accent-rgb),0.25)] animate-pulse"
                                            : iconBtnDefault
                                    )}
                                >
                                    <CloudDownload size={16} className="group-hover:translate-y-0.5 transition-transform duration-300" />
                                </button>
                            </Tooltip>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {/* My Job Highlight */}
                            <button
                                data-tutorial="my-job-highlight-btn"
                                onClick={() => {
                                    setMyJobHighlight(!myJobHighlight);
                                    useTutorialStore.getState().completeEvent('tutorial:my-job-highlight-toggled');
                                }}
                                className={clsx(pillBtnBase, myJobHighlight ? pillBtnActive : pillBtnDefault)}
                            >
                                <Star size={14} className={clsx("transition-transform duration-300 shrink-0", myJobHighlight ? "fill-app-accent drop-shadow-[0_0_6px_rgba(var(--app-accent-rgb),0.5)]" : "group-hover:rotate-12 group-hover:scale-110")} />
                                <span className="text-[10px] font-black uppercase tracking-[0.1em]">{t('ui.highlight_my_job')}</span>
                            </button>

                            <div className="h-5 w-[1px] bg-app-border mx-0.5 rounded-full" />

                            {/* Sort */}
                            <span className="text-[10px] font-black text-app-text uppercase tracking-[0.15em]">{t('ui.sort')}</span>
                            <div className="flex h-9 rounded-full p-[3px] border border-app-border">
                                {(['light_party', 'role'] as const).map((order) => (
                                    <button
                                        key={order}
                                        onClick={() => setPartySortOrder(order)}
                                        className={clsx(
                                            "px-3 h-full rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer",
                                            partySortOrder === order
                                                ? "bg-[rgba(var(--app-accent-rgb),0.15)] text-app-accent shadow-[0_0_12px_rgba(var(--app-accent-rgb),0.3)] drop-shadow-[0_0_4px_rgba(var(--app-accent-rgb),0.4)]"
                                                : "text-app-text"
                                        )}
                                    >
                                        {order === 'light_party' ? t('ui.sort_light_party') : t('ui.sort_role')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            {/* [2] ── 近接センサー付き・究極の常設ハンドル領域 ── */}
            <div className="w-full relative shrink-0" style={{ height: '24px' }}>
                {/* 近接センサー：ハンドルの下側にのみ配置（上のボタン誤操作防止） */}
                <div
                    className="absolute top-[24px] left-0 right-0 h-3 pointer-events-auto z-30"
                    onMouseEnter={() => { clearLeaveTimer(); setIsNear(true); }}
                    onMouseLeave={(e) => handleLeave(e)}
                />

                {/* ハンドル本体 */}
                <motion.div
                    className="absolute bottom-0 left-0 right-0 z-50 bg-glass-header dark:bg-glass-header bg-white pointer-events-auto"
                    initial={false}
                    animate={{ height: (isNear || isHovered) ? 36 : 24 }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                >
                    <Tooltip content={!isHeaderCollapsed ? t('sidebar.close_menu') : t('sidebar.open_menu')} position="bottom" wrapperClassName="w-full h-full">
                    <button
                        onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                        onMouseEnter={() => { clearLeaveTimer(); setIsNear(true); setIsHovered(true); }}
                        onMouseLeave={(e) => handleLeave(e)}
                        className={clsx(
                            "relative w-full h-full cursor-pointer overflow-hidden group/btn",
                            "hover:bg-app-surface2 active:bg-app-surface2 transition-colors duration-200"
                        )}
                    >
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent"
                            animate={{ opacity: isNear ? 0.5 : 0.1 }}
                            transition={{ duration: 0.15 }}
                        />

                        <div className={clsx(
                            "absolute inset-x-0 top-0 h-[1px] transition-colors duration-200",
                            isHeaderCollapsed
                                ? "bg-app-border"
                                : "bg-app-border group-hover/btn:bg-app-text-muted"
                        )} />

                        <div className={clsx(
                            "absolute inset-x-0 bottom-0 h-[1px] transition-all duration-200",
                            isHeaderCollapsed
                                ? "bg-app-border"
                                : "bg-glass-border"
                        )} />

                        <div className="relative flex items-center justify-center h-full">
                            <motion.div
                                className="flex items-center justify-center"
                                animate={{
                                    y: isHovered
                                        ? (isHeaderCollapsed ? [2, -2, 2] : [-2, 2, -2])
                                        : 0,
                                    scale: isHovered ? 1.8 : 1
                                }}
                                transition={{
                                    y: isHovered
                                        ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" }
                                        : { duration: 0.2 },
                                    scale: { duration: 0.2 }
                                }}
                            >
                                {isHeaderCollapsed ? (
                                    <ChevronDown
                                        size={18}
                                        className="text-app-text-muted"
                                    />
                                ) : (
                                    <ChevronUp
                                        size={18}
                                        className={clsx(
                                            "transition-all duration-200",
                                            isNear
                                                ? "text-app-text-sec"
                                                : "text-app-text-muted group-hover/btn:text-app-text-sec"
                                        )}
                                    />
                                )}
                            </motion.div>
                        </div>
                    </button>
                    </Tooltip>
                </motion.div>
            </div>

            <PartyStatusPopover isOpen={statusOpen} onClose={() => setStatusOpen(false)} />
        </motion.div>
    );
};
