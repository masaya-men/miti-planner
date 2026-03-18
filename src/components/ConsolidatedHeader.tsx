import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Home, HelpCircle, Sun, Moon, CloudDownload,
    ChevronUp, ChevronDown
} from 'lucide-react';
import clsx from 'clsx';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { PartyStatusPopover } from './PartyStatusPopover';

interface ConsolidatedHeaderProps {
    onAutoPlan: () => void;
    onImportLogs: () => void;
    partySortOrder: 'light_party' | 'role';
    setPartySortOrder: (order: 'light_party' | 'role') => void;
    statusOpen: boolean;
    setStatusOpen: (open: boolean) => void;
    setPartySettingsOpen: (open: boolean) => void;
}

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

    // マウスが離れた方向を判定してリセット方法を切り替える
    // e.clientY がハンドルより上側（ヘッダーエリア方向）なら即リセット
    // 下側（表エリア方向）なら80ms遅延してリセット
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
            {/* [1] ── ヘッダー本体コンテナ (height アニメーション) ── */}
            <motion.div
                initial={false}
                animate={{
                    height: isHeaderCollapsed ? 0 : 96,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full overflow-hidden pointer-events-auto bg-glass-header backdrop-blur-xl shadow-2xl flex flex-col"
                onMouseEnter={() => { clearLeaveTimer(); setIsNear(false); setIsHovered(false); }}
            >
                <motion.div
                    className="flex flex-col w-full"
                    initial={false}
                    animate={{ y: (isNear || isHovered) ? -5 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                >
                    {/* Layer A: App Controls (h-12 = 48px) */}
                    <div className="h-12 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate('/')}
                                className="p-2 rounded-lg text-app-text-muted hover:text-app-accent hover:bg-white/5 transition-all duration-200 cursor-pointer active:scale-95 group"
                                title={t('app.return_home')}
                            >
                                <Home size={18} className="group-hover:scale-110 transition-transform" />
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    const path = window.location.pathname;
                                    if (path === '/' || path === '') {
                                        useTutorialStore.getState().startTutorial();
                                    } else {
                                        useTutorialStore.getState().startFromStep(1);
                                    }
                                }}
                                className="relative px-3 py-1 bg-app-accent/10 hover:bg-app-accent/20 border border-app-accent/20 rounded-full text-app-accent flex items-center gap-2 transition-all duration-200 cursor-pointer active:scale-95 group"
                            >
                                <HelpCircle size={14} className="group-hover:rotate-12 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-wider">{t('app.view_tutorial')}</span>
                            </button>

                            <div className="h-4 w-[1px] bg-white/10 mx-1" />

                            <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className="relative p-1.5 w-8 h-8 rounded-lg text-app-text-muted hover:text-app-text hover:bg-white/5 flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-200"
                            >
                                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                            <LanguageSwitcher />
                        </div>
                    </div>

                    {/* Layer B: Timeline Tools (h-12 = 48px) */}
                    <div className="h-12 flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-1.5 px-3">
                            <button
                                data-tutorial="party-comp"
                                onClick={() => {
                                    setPartySettingsOpen(true);
                                    useTutorialStore.getState().completeEvent('party-settings:opened');
                                }}
                                className="flex items-center gap-2 px-3 h-7 rounded-md text-app-text-secondary group/btn relative overflow-hidden cursor-pointer bg-glass-card hover:bg-glass-hover border border-glass-border transition-all duration-300"
                            >
                                <span className="font-black text-[10px] uppercase tracking-[0.1em]">{t('party.comp_short')}</span>
                            </button>

                            <button
                                onClick={() => {
                                    setStatusOpen(!statusOpen);
                                    if (!statusOpen) useTutorialStore.getState().completeEvent('status:opened');
                                }}
                                className={clsx(
                                    "flex items-center gap-2 px-3 h-7 rounded-md transition-all duration-300 relative overflow-hidden group/btn cursor-pointer border",
                                    statusOpen
                                        ? "bg-[rgba(var(--app-accent-rgb),0.15)] border-[rgba(var(--app-accent-rgb),0.6)] shadow-[0_0_14px_rgba(var(--app-accent-rgb),0.35),inset_0_1px_0_rgba(var(--app-accent-rgb),0.45)]"
                                        : "bg-glass-card border-glass-border hover:bg-glass-hover"
                                )}
                            >
                                <span className={clsx("font-black text-[10px] uppercase tracking-[0.1em]", statusOpen ? "text-app-accent drop-shadow-[0_0_6px_rgba(var(--app-accent-rgb),0.5)]" : "text-app-text-secondary group-hover/btn:text-app-text")}>{t('settings.config_short')}</span>
                            </button>

                            <button
                                onClick={onAutoPlan}
                                className="flex items-center gap-2 px-3 h-7 rounded-md transition-all duration-300 cursor-pointer text-app-text-secondary hover:text-app-text bg-glass-card hover:bg-glass-hover border border-glass-border group/btn"
                            >
                                <span className="text-[10px] font-black uppercase tracking-[0.1em]">{t('mitigation.auto_plan')}</span>
                            </button>

                            <button
                                onClick={onImportLogs}
                                className="flex items-center gap-1.5 px-3 h-7 rounded-md transition-all duration-300 cursor-pointer text-app-text-secondary hover:text-app-text bg-glass-card hover:bg-glass-hover border border-glass-border group/btn"
                            >
                                <CloudDownload size={12} className="group-hover/btn:-translate-y-0.5 transition-transform shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-[0.1em]">{t('timeline.import_fflogs')}</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5 px-3">
                            <button
                                data-tutorial="my-job-highlight-btn"
                                onClick={() => {
                                    setMyJobHighlight(!myJobHighlight);
                                    useTutorialStore.getState().completeEvent('tutorial:my-job-highlight-toggled');
                                }}
                                className={clsx(
                                    "flex items-center gap-3 px-3 h-7 rounded-md transition-all duration-300 relative overflow-hidden group/btn cursor-pointer border",
                                    myJobHighlight
                                        ? "bg-[rgba(var(--app-accent-rgb),0.15)] border-[rgba(var(--app-accent-rgb),0.6)] shadow-[0_0_14px_rgba(var(--app-accent-rgb),0.35),inset_0_1px_0_rgba(var(--app-accent-rgb),0.45)]"
                                        : "bg-glass-card border-glass-border hover:bg-glass-hover"
                                )}
                            >
                                <span className={clsx("font-black text-[10px] uppercase tracking-[0.1em]", myJobHighlight ? "text-app-accent drop-shadow-[0_0_6px_rgba(var(--app-accent-rgb),0.5)]" : "text-app-text-secondary group-hover/btn:text-app-text")}>{t('ui.highlight_my_job')}</span>
                            </button>

                            <div className="h-4 w-[1px] bg-white/10 mx-1" />

                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-app-text-secondary uppercase tracking-[0.15em]">{t('ui.sort')}</span>
                                <div className="flex h-7 bg-white/5 rounded-md p-0.5 border border-glass-border">
                                    {(['light_party', 'role'] as const).map((order) => (
                                        <button
                                            key={order}
                                            onClick={() => setPartySortOrder(order)}
                                            className={clsx(
                                                "px-2 h-full rounded-sm text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                                partySortOrder === order
                                                    ? "bg-[rgba(var(--app-accent-rgb),0.2)] text-app-accent border border-[rgba(var(--app-accent-rgb),0.5)] shadow-[0_0_8px_rgba(var(--app-accent-rgb),0.25)] drop-shadow-[0_0_4px_rgba(var(--app-accent-rgb),0.4)]"
                                                    : "text-app-text-secondary hover:text-app-text"
                                            )}
                                        >
                                            {order === 'light_party' ? t('ui.sort_light_party') : t('ui.sort_role')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            {/* [2] ── 近接センサー付き・究極の常設ハンドル領域 ── */}
            <div className="w-full relative shrink-0" style={{ height: '28px' }}>
                {/* 近接センサー：ハンドルの下側にのみ配置（上のボタン誤操作防止） */}
                <div
                    className="absolute top-[28px] left-0 right-0 h-3 pointer-events-auto z-30"
                    onMouseEnter={() => { clearLeaveTimer(); setIsNear(true); }}
                    onMouseLeave={(e) => handleLeave(e)}
                />

                {/* ハンドル本体：Sidebar の縦ストリップを横に転換した設計 */}
                <motion.div
                    className="absolute bottom-0 left-0 right-0 z-50 bg-glass-header dark:bg-glass-header bg-white backdrop-blur-3xl pointer-events-auto"
                    initial={false}
                    animate={{ height: (isNear || isHovered) ? 36 : 24 }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                >
                    <button
                        onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                        onMouseEnter={() => { clearLeaveTimer(); setIsNear(true); setIsHovered(true); }}
                        onMouseLeave={(e) => handleLeave(e)}
                        className={clsx(
                            "relative w-full h-full cursor-pointer overflow-hidden group/btn",
                            "hover:bg-app-accent/[0.12] active:bg-app-accent/[0.2] transition-colors duration-200"
                        )}
                        title={!isHeaderCollapsed ? t('sidebar.close_menu') : t('sidebar.open_menu')}
                    >
                        {/* 迫り出し感のある背景グラデ（Sidebar 準拠） */}
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-b from-transparent via-app-accent/[0.08] to-transparent"
                            animate={{ opacity: isNear ? 0.3 : 0.1 }}
                            transition={{ duration: 0.15 }}
                        />

                        {/* 上端の固定ライン（Sidebar の左端ラインと同じ役割） */}
                        <div className={clsx(
                            "absolute inset-x-0 top-0 h-[1px] transition-colors duration-200",
                            isHeaderCollapsed
                                ? "bg-app-accent/30 shadow-[0_0_10px_rgba(var(--app-accent-rgb),0.3)]"
                                : "bg-app-accent/40 group-hover/btn:bg-app-accent/70"
                        )} />

                        {/* 下端の境界線（Sidebar の右端ラインと同じ役割） */}
                        <div className={clsx(
                            "absolute inset-x-0 bottom-0 h-[1px] transition-all duration-200",
                            isHeaderCollapsed
                                ? "bg-app-accent/30 shadow-[0_0_10px_rgba(var(--app-accent-rgb),0.3)]"
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
                                        className="text-app-accent drop-shadow-[0_0_12px_rgba(var(--app-accent-rgb),0.5)]"
                                    />
                                ) : (
                                    <ChevronUp
                                        size={18}
                                        className={clsx(
                                            "transition-all duration-200",
                                            isNear
                                                ? "text-app-accent drop-shadow-[0_0_12px_rgba(var(--app-accent-rgb),0.5)]"
                                                : "text-app-text-muted group-hover/btn:text-app-accent"
                                        )}
                                    />
                                )}
                            </motion.div>
                        </div>
                    </button>
                </motion.div>
            </div>

            <PartyStatusPopover isOpen={statusOpen} onClose={() => setStatusOpen(false)} />
        </motion.div>
    );
};
