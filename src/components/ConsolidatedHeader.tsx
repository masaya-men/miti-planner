import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Sun, Moon, FileDown,
    ChevronUp, ChevronDown,
    Users, Activity, Wand2, Star, LogIn, Crown,
} from 'lucide-react';
import clsx from 'clsx';
import { LoPoButton } from './LoPoButton';
import { TutorialMenu } from './tutorial/TutorialMenu';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';

import { usePlanStore } from '../store/usePlanStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { useAuthStore } from '../store/useAuthStore';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { PartyStatusPopover } from './PartyStatusPopover';
import { LoginModal } from './LoginModal';
import { Tooltip } from './ui/Tooltip';
import { ShareButtons } from './ShareButtons';
import { SyncButton } from './SyncButton';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import { SegmentButton } from './ui/SegmentButton';

interface ConsolidatedHeaderProps {
    onAutoPlan: () => void;
    onImportLogs: () => void;
    partySortOrder: 'light_party' | 'role';
    setPartySortOrder: (order: 'light_party' | 'role') => void;
    statusOpen: boolean;
    setStatusOpen: (open: boolean) => void;
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

// SyncButton は ./SyncButton.tsx に共有コンポーネントとして切り出し済み

export const ConsolidatedHeader: React.FC<ConsolidatedHeaderProps> = ({
    onAutoPlan,
    onImportLogs,
    partySortOrder,
    setPartySortOrder,
    statusOpen,
    setStatusOpen,
}) => {
    const { t } = useTranslation();
    const { theme, setTheme, contentLanguage } = useThemeStore();
    const myJobHighlight = useMitigationStore(s => s.myJobHighlight);
    const setMyJobHighlight = useMitigationStore(s => s.setMyJobHighlight);
    const { runTransition } = useTransitionOverlay();
    const navigate = useNavigate();
    const {
        isHeaderCollapsed, setIsHeaderCollapsed, isSidebarOpen
    } = useContext(MobileTriggersContext);

    const timelineEvents = useMitigationStore(state => state.timelineEvents);
    const needsImport = timelineEvents?.length === 0;

    // ヘッダーのプラン名インライン編集
    const [editingHeaderTitle, setEditingHeaderTitle] = React.useState(false);
    const [headerTitleDraft, setHeaderTitleDraft] = React.useState('');
    const headerTitleInputRef = React.useRef<HTMLInputElement>(null);

    const startHeaderEdit = () => {
        if (!currentPlan) return;
        setHeaderTitleDraft(currentPlan.title);
        setEditingHeaderTitle(true);
        setTimeout(() => headerTitleInputRef.current?.select(), 0);
    };

    const finishHeaderEdit = () => {
        if (editingHeaderTitle && headerTitleDraft.trim() && currentPlan) {
            usePlanStore.getState().updatePlan(currentPlan.id, { title: headerTitleDraft.trim() });
        }
        setEditingHeaderTitle(false);
    };

    // 認証状態
    const { user } = useAuthStore();
    const profileDisplayName = useAuthStore(s => s.profileDisplayName);
    const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);
    const [showLoginModal, setShowLoginModal] = React.useState(false);

    // ログイン成功時: LoginModalを自動で閉じる（ウェルカム表示はLayout.tsxで一括管理）
    const justLoggedIn = useAuthStore((s) => s.justLoggedInUser);
    React.useEffect(() => {
        if (justLoggedIn) setShowLoginModal(false);
    }, [justLoggedIn]);

    // 現在開いているプラン・コンテンツ名
    const currentPlan = usePlanStore(state => state.plans.find(p => p.id === state.currentPlanId));
    const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;
    const { i18n } = useTranslation();
    // 和欧間スペース: 漢字/かな↔半角英数字の間にスペースを挿入
    const addWaEiSpace = (text: string): string =>
        text.replace(/([\u3000-\u9FFF\uF900-\uFAFF])([A-Za-z0-9])/g, '$1 $2')
            .replace(/([A-Za-z0-9])([\u3000-\u9FFF\uF900-\uFAFF])/g, '$1 $2');

    const rawContentLabel = contentDef
        ? getPhaseName(contentDef.name, contentLanguage)
        : null;
    const contentLabel = rawContentLabel && contentLanguage === 'ja'
        ? addWaEiSpace(rawContentLabel)
        : rawContentLabel;

    const [isHovered, setIsHovered] = React.useState(false);

    return (

        <motion.div
            className="absolute top-0 w-full z-[100] flex flex-col pointer-events-none"
            style={{ left: '-1px', width: 'calc(100% + 1px)' }}
            initial={false}
        >
            {/* [1] ── ヘッダー本体コンテナ ── */}
            <motion.div
                initial={false}
                animate={{
                    height: isHeaderCollapsed ? 0 : 101,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
                className="w-full overflow-hidden pointer-events-auto glass-tier3 glass-frame glass-border-b-0 glass-border-l-0 glass-shadow-none"
            >
                <div
                    className="flex flex-col w-full h-[96px] pt-[5px]"
                >
                    {/* Layer A（上段）: 左=ナビ+タイトル / 右=共有+チュートリアル+設定（固定） */}
                    <div className="h-12 flex items-center px-6 border-b border-app-border shrink-0 overflow-x-hidden overflow-y-visible">
                        {/* ── 左グループ（余ったスペースを使う） ── */}
                        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                            <Tooltip content={t('app.return_home')}>
                                <div className="shrink-0">
                                    <LoPoButton size="sm" onClick={() => navigate('/')} />
                                </div>
                            </Tooltip>

                            {currentPlan && (
                                <div className="flex items-baseline gap-2" style={{ minWidth: 0, overflow: 'hidden', flex: '1 1 0%' }}>
                                    {contentLabel && (
                                        <span
                                            className={clsx(
                                                "text-app-text leading-tight whitespace-nowrap shrink-0",
                                                i18n.language.startsWith('ja') ? "text-app-4xl" : "text-app-5xl"
                                            )}
                                            style={{
                                                fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif",
                                                fontWeight: 700,
                                                letterSpacing: i18n.language.startsWith('ja') ? '-0.02em' : '0.04em',
                                                ...(i18n.language.startsWith('ja') ? { transform: 'scaleY(1.18)', transformOrigin: 'center' } : {}),
                                            }}
                                        >
                                            {contentLabel}
                                        </span>
                                    )}
                                    {currentPlan.title && currentPlan.title !== contentLabel && (
                                        editingHeaderTitle ? (
                                            <input
                                                ref={headerTitleInputRef}
                                                autoFocus
                                                value={headerTitleDraft}
                                                onChange={e => setHeaderTitleDraft(e.target.value)}
                                                onBlur={finishHeaderEdit}
                                                onKeyDown={e => { if (e.key === 'Enter') finishHeaderEdit(); if (e.key === 'Escape') setEditingHeaderTitle(false); }}
                                                className="text-[16px] md:text-app-xl text-app-text tracking-wider uppercase min-w-0 bg-transparent border-b border-app-text/30 outline-none font-inherit"
                                                style={{ fontFamily: 'inherit', fontWeight: 'inherit', flex: '1 1 0%' }}
                                            />
                                        ) : (
                                            <div
                                                className="text-app-xl text-app-text tracking-wider uppercase cursor-pointer hover:border-b hover:border-app-text/20"
                                                style={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    flex: '1 1 0%',
                                                    minWidth: 0,
                                                }}
                                                onDoubleClick={startHeaderEdit}
                                            >
                                                {currentPlan.title}
                                            </div>
                                        )
                                    )}
                                    {/* 保存インジケータ — プラン名の直後に表示（フォーカスモード時は右パネルに移動するため非表示） */}
                                    {!isHeaderCollapsed && <SyncButton size={16} className="px-1.5 py-1" showLabel />}
                                </div>
                            )}
                        </div>

                        {/* ── 右グループ（固定位置・絶対に動かない） ── */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-3">
                            {/* 共有ボタン */}
                            {currentPlan && (
                                <ShareButtons contentLabel={contentLabel} currentPlan={currentPlan} />
                            )}

                            <div className="h-5 w-[1px] dark:bg-app-text/25 bg-app-text mx-0.5 rounded-full" />

                            {/* チュートリアル */}
                            <TutorialMenu btnClassName={clsx(pillBtnBase, pillBtnDefault)} />

                            <div className="h-5 w-[1px] dark:bg-app-text/25 bg-app-text mx-0.5 rounded-full" />

                            {/* テーマ切替（チュートリアル中も常に操作可能） */}
                            <Tooltip content={theme === 'dark' ? t('app.toggle_theme_light') : t('app.toggle_theme_dark')}>
                                <button
                                    data-tutorial-always
                                    onClick={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
                                    className={clsx(iconBtnBase, iconBtnDefault)}
                                >
                                    {theme === 'dark'
                                        ? <Sun size={16} className="group-hover:rotate-90 transition-transform duration-500" />
                                        : <Moon size={16} className="group-hover:-rotate-12 transition-transform duration-300" />
                                    }
                                </button>
                            </Tooltip>

                            {/* 言語切替 */}
                            <LanguageSwitcher />

                            {/* ログイン */}
                            <Tooltip content={user ? (profileDisplayName || 'Account') : t('app.sign_in') || 'Sign In'}>
                                <button
                                    onClick={() => setShowLoginModal(true)}
                                    className={clsx(iconBtnBase, iconBtnDefault)}
                                >
                                    {profileAvatarUrl ? (
                                        <img src={profileAvatarUrl} alt="" className="w-6 h-6 rounded-full" />
                                    ) : user ? (
                                        <div className="w-6 h-6 rounded-full bg-app-text/15 flex items-center justify-center">
                                            <span className="text-app-base font-black text-app-text">{(profileDisplayName || 'U').charAt(0).toUpperCase()}</span>
                                        </div>
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
                                    window.dispatchEvent(new CustomEvent('timeline:party-settings', { detail: { open: true } }));
                                    useTutorialStore.getState().completeEvent('party:opened');
                                }}
                                className={clsx(pillBtnBase, pillBtnDefault)}
                            >
                                <Users size={14} className="group-hover:scale-110 transition-transform duration-300 shrink-0" />
                                <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('party.comp_short')}</span>
                            </button>

                            {/* Status */}
                            <button
                                onClick={() => {
                                    setStatusOpen(!statusOpen);
                                    // (チュートリアルイベント削除済み)
                                }}
                                className={clsx(pillBtnBase, statusOpen ? pillBtnActive : pillBtnDefault)}
                            >
                                <Activity size={14} className={clsx("transition-transform duration-300 shrink-0", statusOpen ? "" : "group-hover:scale-110")} />
                                <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('settings.config_short')}</span>
                            </button>

                            {/* Auto Plan */}
                            <button
                                onClick={onAutoPlan}
                                className={clsx(pillBtnBase, pillBtnDefault)}
                            >
                                <Wand2 size={14} className="group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300 shrink-0" />
                                <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('mitigation.auto_plan')}</span>
                            </button>

                            {/* Import（アイコンのみ） */}
                            <Tooltip content={<span><span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: '1.1em', letterSpacing: '0.02em' }}>FF Logs</span> {t('fflogs.tooltip_generate')}</span>}>
                                <button
                                    onClick={onImportLogs}
                                    className={clsx(
                                        iconBtnBase,
                                        needsImport
                                            ? "bg-app-text text-app-bg border-app-text animate-pulse"
                                            : iconBtnDefault
                                    )}
                                >
                                    <FileDown size={16} className="group-hover:translate-y-0.5 transition-transform duration-300" />
                                </button>
                            </Tooltip>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {/* Popular Plans — 別タブで /popular を開く */}
                            <button
                                onClick={() => window.open('/popular', '_blank')}
                                className={clsx(pillBtnBase, pillBtnDefault)}
                            >
                                <Crown size={14} className="shrink-0 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />
                                <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('popular.open_popular')}</span>
                            </button>

                            {/* My Job Highlight */}
                            <button
                                data-tutorial="my-job-highlight-btn"
                                onClick={() => {
                                    setMyJobHighlight(!myJobHighlight);
                                    // (チュートリアルイベント削除済み)
                                }}
                                className={clsx(pillBtnBase, myJobHighlight ? pillBtnActive : pillBtnDefault)}
                            >
                                <Star size={14} className={clsx("transition-transform duration-300 shrink-0", myJobHighlight ? "fill-current" : "group-hover:rotate-12 group-hover:scale-110")} />
                                <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('ui.highlight_my_job')}</span>
                            </button>

                            <div className="h-5 w-[1px] dark:bg-app-text/25 bg-app-text mx-0.5 rounded-full" />

                            {/* Sort */}
                            <span className="text-app-base font-black text-app-text uppercase tracking-[0.15em]">{t('ui.sort')}</span>
                            <SegmentButton
                                options={[
                                    { value: 'light_party', label: t('ui.sort_light_party') },
                                    { value: 'role', label: t('ui.sort_role') },
                                ]}
                                value={partySortOrder}
                                onChange={setPartySortOrder}
                                size="sm"
                                pill
                            />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* [2] ── 常設ハンドル領域 ── */}
            <div className="w-full relative shrink-0" style={{ height: '24px' }}>
                {/* ハンドル本体 */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-[25px] z-50 pointer-events-auto glass-tier3 glass-frame glass-border-t-0 glass-border-b-0 glass-border-l-0 glass-border-r-0 glass-shadow-none"
                >
                    {/* ヘッダー折りたたみ時: 同期ボタンをハンドル左端に表示
                         PCフォーカスモード時（header collapsed + sidebar closed）は右パネルに表示するため非表示 */}
                    {isHeaderCollapsed && (
                        <div className={clsx(
                            "absolute left-1.5 top-0 bottom-0 flex items-center z-10 pointer-events-auto",
                            !isSidebarOpen && "md:hidden"
                        )}>
                            <SyncButton />
                        </div>
                    )}
                    <Tooltip content={!isHeaderCollapsed ? t('sidebar.collapse_header') : t('sidebar.expand_header')} position="bottom" wrapperClassName="w-full h-full">
                    <button
                        onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        className={clsx(
                            "relative w-full h-full cursor-pointer overflow-hidden group/btn outline-none",
                            "hover:bg-app-surface2 active:bg-app-surface2 transition-colors duration-200"
                        )}
                    >
                        {/* 上端の固定ライン */}
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-app-border group-hover/btn:bg-app-text-muted transition-colors duration-200" />
                        {/* 下端の固定ライン */}
                        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-app-border group-hover/btn:bg-app-text-muted transition-colors duration-200" />

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
                                        className={clsx("transition-all duration-200", isHovered ? "text-app-text-sec" : "text-app-text-muted group-hover/btn:text-app-text-sec")}
                                    />
                                ) : (
                                    <ChevronUp
                                        size={18}
                                        className={clsx("transition-all duration-200", isHovered ? "text-app-text-sec" : "text-app-text-muted group-hover/btn:text-app-text-sec")}
                                    />
                                )}
                            </motion.div>
                        </div>
                    </button>
                    </Tooltip>
                </div>
            </div>

            <PartyStatusPopover isOpen={statusOpen} onClose={() => setStatusOpen(false)} />

            {/* ログインモーダル */}
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
        </motion.div>
    );
};
