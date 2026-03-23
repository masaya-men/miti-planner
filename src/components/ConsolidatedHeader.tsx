import React, { useContext } from 'react';
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
import { LoginModal } from './LoginModal';
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
    const { user, justLoggedInUser } = useAuthStore();
    const [showShareMenu, setShowShareMenu] = React.useState(false);
    const [showLoginModal, setShowLoginModal] = React.useState(false);

    // ログイン成功時にモーダルを自動表示
    React.useEffect(() => {
        if (justLoggedInUser) setShowLoginModal(true);
    }, [justLoggedInUser]);

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

                            {/* ログイン / アカウントメニュー */}
                            <Tooltip content={user ? (user.displayName || 'Account') : t('app.sign_in') || 'Sign In'}>
                                <button
                                    onClick={() => setShowLoginModal(true)}
                                    className={clsx(iconBtnBase, iconBtnDefault)}
                                >
                                    {user?.photoURL ? (
                                        <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                                    ) : user ? (
                                        <LogOut size={16} />
                                    ) : (
                                        <LogIn size={16} />
                                    )}
                                </button>
                            </Tooltip>
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

            {/* ログインモーダル */}
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
        </motion.div>
    );
};
