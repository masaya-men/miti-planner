import React, { useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Home, HelpCircle, Sun, Moon, CloudDownload,
    ChevronUp, ChevronDown,
    Users, Activity, Wand2, Star, Share2, LogIn, LogOut
} from 'lucide-react';
import clsx from 'clsx';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { useAuthStore } from '../store/useAuthStore';
import { getContentById } from '../data/contentRegistry';
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
const pillBtnActive = `bg-app-text text-app-bg border-app-text ${hoverInvert}`;

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

    // 認証状態
    const { user, signInWith, signOut } = useAuthStore();
    const [showShareMenu, setShowShareMenu] = React.useState(false);
    const [showLoginMenu, setShowLoginMenu] = React.useState(false);
    const loginBtnRef = useRef<HTMLDivElement>(null);

    // 現在開いているプラン・コンテンツ名
    const currentPlan = usePlanStore(state => state.plans.find(p => p.id === state.currentPlanId));
    const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;
    const { i18n } = useTranslation();
    // 和欧間スペース: 漢字/かな↔半角英数字の間にスペースを挿入
    const addWaEiSpace = (text: string): string =>
        text.replace(/([\u3000-\u9FFF\uF900-\uFAFF])([A-Za-z0-9])/g, '$1 $2')
            .replace(/([A-Za-z0-9])([\u3000-\u9FFF\uF900-\uFAFF])/g, '$1 $2');

    const rawContentLabel = contentDef
        ? (i18n.language.startsWith('ja') ? contentDef.name.ja : contentDef.name.en)
        : null;
    const contentLabel = rawContentLabel && i18n.language.startsWith('ja')
        ? addWaEiSpace(rawContentLabel)
        : rawContentLabel;

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
                    height: isHeaderCollapsed ? 0 : 101,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full overflow-hidden pointer-events-auto bg-glass-header shadow-sm"
                onMouseEnter={() => { clearLeaveTimer(); setIsNear(false); setIsHovered(false); }}
            >
                <motion.div
                    className="flex flex-col w-full h-[96px] pt-[5px]"
                    initial={false}
                    animate={{ y: (isNear || isHovered) ? -5 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                >
                    {/* Layer A（上段・表から遠い）: ナビ + ユーティリティ */}
                    <div className="h-12 flex items-center justify-between px-6 border-b border-app-border shrink-0">
                        <div className="flex items-center gap-3">
                            <Tooltip content={t('app.return_home')}>
                                <button
                                    onClick={() => navigate('/')}
                                    className={clsx(iconBtnBase, iconBtnDefault)}
                                >
                                    <Home size={16} className="group-hover:-translate-y-0.5 transition-transform duration-300" />
                                </button>
                            </Tooltip>

                            {/* 現在のコンテンツ名 — ヒーロー表示 */}
                            {currentPlan && (
                                <div
                                    className="flex items-baseline gap-2 min-w-0 origin-left"
                                    style={i18n.language.startsWith('ja') ? { transform: 'scaleX(0.85)' } : undefined}
                                >
                                    {contentLabel && (
                                        <span
                                            className="text-[26px] text-app-text leading-tight whitespace-nowrap"
                                            style={{
                                                fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif",
                                                fontWeight: 700,
                                                letterSpacing: i18n.language.startsWith('ja') ? '-0.02em' : '0.04em',
                                            }}
                                        >
                                            {contentLabel}
                                        </span>
                                    )}
                                    {currentPlan.title && currentPlan.title !== contentLabel && (
                                        <span className="text-[13px] text-app-text-muted tracking-wider uppercase whitespace-nowrap">
                                            {currentPlan.title}
                                        </span>
                                    )}
                                </div>
                            )}
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

                            <div className="h-5 w-[1px] bg-app-border mx-0.5 rounded-full" />

                            {/* 共有ボタン */}
                            {currentPlan && (
                                <div className="relative">
                                    <Tooltip content={t('app.share') || 'Share'}>
                                        <button
                                            onClick={() => setShowShareMenu(!showShareMenu)}
                                            className={clsx(iconBtnBase, iconBtnDefault)}
                                        >
                                            <Share2 size={16} />
                                        </button>
                                    </Tooltip>
                                    {showShareMenu && (
                                        <>
                                            <div className="fixed inset-0 z-[200]" onClick={() => setShowShareMenu(false)} />
                                            <div className="absolute right-0 top-11 z-[201] bg-app-bg border border-app-border rounded-lg shadow-lg p-2 min-w-[160px]">
                                                <button
                                                    onClick={() => {
                                                        const url = window.location.href;
                                                        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent('LoPo - FF14 軽減プランナー')}`, '_blank');
                                                        setShowShareMenu(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-[12px] text-app-text hover:bg-app-surface2 rounded transition-colors"
                                                >
                                                    X (Twitter)
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(window.location.href);
                                                        setShowShareMenu(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-[12px] text-app-text hover:bg-app-surface2 rounded transition-colors"
                                                >
                                                    {t('app.copy_link') || 'Copy Link'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ログインボタン */}
                            {user ? (
                                <Tooltip content={t('app.sign_out') || 'Sign Out'}>
                                    <button
                                        onClick={signOut}
                                        className={clsx(iconBtnBase, iconBtnDefault)}
                                    >
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                                        ) : (
                                            <LogOut size={16} />
                                        )}
                                    </button>
                                </Tooltip>
                            ) : (
                                <div className="relative" ref={loginBtnRef}>
                                    <Tooltip content={t('app.sign_in') || 'Sign In'}>
                                        <button
                                            onClick={() => setShowLoginMenu(!showLoginMenu)}
                                            className={clsx(iconBtnBase, iconBtnDefault)}
                                        >
                                            <LogIn size={16} />
                                        </button>
                                    </Tooltip>
                                </div>
                            )}
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
                                <Activity size={14} className={clsx("transition-transform duration-300 shrink-0", statusOpen ? "" : "group-hover:scale-110")} />
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
                                            ? "bg-app-text text-app-bg border-app-text animate-pulse"
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
                                <Star size={14} className={clsx("transition-transform duration-300 shrink-0", myJobHighlight ? "fill-app-bg" : "group-hover:rotate-12 group-hover:scale-110")} />
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
                                                ? "bg-app-text text-app-bg"
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
                    className="absolute bottom-0 left-0 right-0 z-50 bg-transparent pointer-events-auto"
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
                            className="absolute inset-0 bg-transparent"
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

            {/* ログインメニュー（ポータル：overflow-hiddenの外に描画） */}
            {showLoginMenu && createPortal(
                <>
                    <div className="fixed inset-0 z-[200]" onMouseDown={() => setShowLoginMenu(false)} />
                    <div
                        className="fixed z-[201] bg-app-bg border border-app-border rounded-lg shadow-lg p-2 min-w-[160px]"
                        style={{
                            top: (loginBtnRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                            right: window.innerWidth - (loginBtnRef.current?.getBoundingClientRect().right ?? 0),
                        }}
                    >
                        {([
                            { id: 'google' as const, label: 'Google', icon: <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
                            { id: 'twitter' as const, label: 'X (Twitter)', icon: <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                            { id: 'discord' as const, label: 'Discord', icon: <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/></svg> },
                        ]).map(({ id, label, icon }) => (
                            <button
                                key={id}
                                onClick={() => { signInWith(id); setShowLoginMenu(false); }}
                                className="w-full text-left px-3 py-2 text-[12px] text-app-text hover:bg-app-surface2 rounded transition-colors flex items-center gap-2 cursor-pointer"
                            >
                                {icon}
                                {label}
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </motion.div>
    );
};
