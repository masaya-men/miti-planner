import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Sun, Moon, Download, FileSpreadsheet,
    ChevronUp, ChevronDown,
    Users, Activity, LogIn,
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
import { MitigationSheet } from './MitigationSheet';
import { useProgressBarVisibility } from '../store/useProgressBarVisibility';
import { ProgressTrackingHUD } from './progress/ProgressTrackingHUD';
import { HeaderToolsMenu } from './HeaderToolsMenu';

interface ConsolidatedHeaderProps {
    onAutoPlan: () => void;
    onImportLogs: () => void;
    partySortOrder: 'light_party' | 'role';
    setPartySortOrder: (order: 'light_party' | 'role') => void;
    statusOpen: boolean;
    setStatusOpen: (open: boolean) => void;
    /** 閲覧専用モード: 部屋のコンテンツID・オーナーラベルを渡す。省略時は従来動作。 */
    viewer?: { contentId: string | null; ownerLabel: string | null };
    /**
     * 閲覧専用モード時のみ有効。ヘッダー右グループ(ShareButtons の代替)に挿入するノード。
     * 未指定(undefined)のとき従来の ShareButtons を表示。viewer が未指定のときは無視される。
     */
    viewerCluster?: React.ReactNode;
}

// ホバー: 反転（ライト→ソフトダーク / ダーク→ソフトライト）
const hoverInvert = "hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text";

// アイコン丸ボタン共通スタイル（1px border で統一）
const iconBtnBase = "group w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95";
const iconBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;

// テキスト付きピルボタン共通スタイル（1px border で統一）
const pillBtnBase = "group flex items-center gap-2 px-3.5 h-9 rounded-full border whitespace-nowrap transition-all duration-300 cursor-pointer active:scale-95";
const pillBtnDefault = `bg-transparent border-app-border text-app-text ${hoverInvert}`;
const pillBtnActive = `bg-app-toggle text-app-toggle-text border-app-toggle ${hoverInvert}`;

// #2b: ネイティブ disabled ボタンはブラウザが cursor 指定を無視するため、禁止カーソルを
// wrapper(span)側で出す。span を hover ターゲットにし、中のボタンは pointer-events-none で透過。
const NotAllowed: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => (
    <span className={clsx('inline-flex', on && 'cursor-not-allowed')}>{children}</span>
);

// SyncButton は ./SyncButton.tsx に共有コンポーネントとして切り出し済み

export const ConsolidatedHeader: React.FC<ConsolidatedHeaderProps> = ({
    onAutoPlan,
    onImportLogs,
    partySortOrder,
    setPartySortOrder,
    statusOpen,
    setStatusOpen,
    viewer,
    viewerCluster,
}) => {
    /** 閲覧専用モード: Task 3 でボタン無効化に再利用 */
    const readOnly = viewer != null;
    // 進捗HUD表示フラグ（B1ストア購読）
    const progressBarVisible = useProgressBarVisibility(s => s.visible);
    const { t } = useTranslation();
    const { theme, setTheme, contentLanguage } = useThemeStore();
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
    // viewer モード時: コンテンツ情報を部屋の contentId から取得（usePlanStore 非依存）
    const contentDef = readOnly
        ? (viewer!.contentId ? getContentById(viewer!.contentId) : null)
        : (currentPlan?.contentId ? getContentById(currentPlan.contentId) : null);
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

    const [isMitiSheetOpen, setIsMitiSheetOpen] = useState(false);
    const currentContentId = readOnly
        ? (viewer!.contentId ?? null)
        : (currentPlan?.contentId ?? null);

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

                            {/* viewer モード: 部屋の contentId からコンテンツ名を表示（ownerLabel があればタイトルも） */}
                            {readOnly && (contentLabel || viewer!.ownerLabel) && (
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
                                    {viewer!.ownerLabel && viewer!.ownerLabel !== contentLabel && (
                                        <div
                                            className="text-app-xl text-app-text tracking-wider uppercase"
                                            style={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                flex: '1 1 0%',
                                                minWidth: 0,
                                            }}
                                        >
                                            {viewer!.ownerLabel}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* 通常モード: usePlanStore の currentPlan からコンテンツ名・タイトルを表示 */}
                            {!readOnly && currentPlan && (
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
                            {/* viewer モード: 共同編集中クラスタを ShareButtons の代わりに表示 */}
                            {readOnly && viewerCluster != null && (
                                <>{viewerCluster}</>
                            )}
                            {/* 共有ボタン: 通常モードのみ */}
                            {!readOnly && currentPlan && (
                                <ShareButtons contentLabel={contentLabel} currentPlan={currentPlan} />
                            )}

                            <div className="h-5 w-px shrink-0 dark:bg-app-text/25 bg-app-text/25 mx-0.5 rounded-full" />

                            {/* チュートリアル: viewer(ジョイナー)では無関係なので非表示(#2a/#2c) */}
                            {!readOnly && (
                                <>
                                    <TutorialMenu btnClassName={clsx(pillBtnBase, pillBtnDefault)} />
                                    <div className="h-5 w-px shrink-0 dark:bg-app-text/25 bg-app-text/25 mx-0.5 rounded-full" />
                                </>
                            )}

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
                            <NotAllowed on={readOnly}>
                                <button
                                    data-tutorial="party-comp"
                                    disabled={readOnly}
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('timeline:party-settings', { detail: { open: true } }));
                                        useTutorialStore.getState().completeEvent('party:opened');
                                    }}
                                    className={clsx(pillBtnBase, pillBtnDefault, readOnly && 'opacity-50 pointer-events-none')}
                                >
                                    <Users size={14} className="group-hover:scale-110 transition-transform duration-300 shrink-0" />
                                    <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('party.comp_short')}</span>
                                </button>
                            </NotAllowed>

                            {/* Status */}
                            <NotAllowed on={readOnly}>
                                <button
                                    disabled={readOnly}
                                    onClick={() => {
                                        setStatusOpen(!statusOpen);
                                        // (チュートリアルイベント削除済み)
                                    }}
                                    className={clsx(pillBtnBase, statusOpen ? pillBtnActive : pillBtnDefault, readOnly && 'opacity-50 pointer-events-none')}
                                >
                                    <Activity size={14} className={clsx("transition-transform duration-300 shrink-0", statusOpen ? "" : "group-hover:scale-110")} />
                                    <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('settings.config_short')}</span>
                                </button>
                            </NotAllowed>

                            {/* Import（アイコンのみ・定番DLアイコンに統一） */}
                            <Tooltip
                                wrapperClassName={clsx(readOnly && 'cursor-not-allowed')}
                                content={<span><span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 800, fontSize: '1.1em', letterSpacing: '0.02em' }}>FF Logs</span> {t('fflogs.tooltip_generate')}</span>}
                            >
                                <button
                                    disabled={readOnly}
                                    onClick={onImportLogs}
                                    className={clsx(
                                        iconBtnBase,
                                        readOnly
                                            ? `${iconBtnDefault} opacity-50 pointer-events-none`
                                            : needsImport
                                                ? "bg-app-toggle text-app-toggle-text border-app-toggle animate-pulse"
                                                : iconBtnDefault
                                    )}
                                >
                                    <Download size={16} className="group-hover:translate-y-0.5 transition-transform duration-300" />
                                </button>
                            </Tooltip>

                            {/* スプシ取り込み */}
                            <Tooltip
                                wrapperClassName={clsx(readOnly && 'cursor-not-allowed')}
                                content={t('sheetImport.btn')}
                            >
                                <button
                                    disabled={readOnly}
                                    onClick={() => window.dispatchEvent(new CustomEvent('timeline:spreadsheet-import'))}
                                    className={clsx(
                                        iconBtnBase,
                                        readOnly
                                            ? `${iconBtnDefault} opacity-50 pointer-events-none`
                                            : iconBtnDefault
                                    )}
                                >
                                    <FileSpreadsheet size={16} className="group-hover:scale-110 transition-transform duration-300" />
                                </button>
                            </Tooltip>

                            {/* ⋯ その他: あまり使わない操作 (自動組み立て/MYジョブハイライト/進捗バー表示) を集約 */}
                            <HeaderToolsMenu
                                btnClassName={clsx(iconBtnBase, iconBtnDefault)}
                                onAutoPlan={onAutoPlan}
                                readOnly={readOnly}
                            />
                        </div>

                        {/* 中央: 進捗HUD（表示フラグON時のみ） */}
                        {progressBarVisible && (
                            <div className="flex-1 flex items-center justify-center min-w-0 px-3 overflow-visible">
                                <div className="w-full max-w-[640px]">
                                    <ProgressTrackingHUD />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-1.5">
                            {/* Popular Plans — みんなの軽減表ボトムシートを開く */}
                            <Tooltip wrapperClassName={clsx(readOnly && 'cursor-not-allowed')} content={t('popular.open_popular_tooltip')}>
                                <button
                                    disabled={readOnly}
                                    onClick={() => setIsMitiSheetOpen(true)}
                                    className={clsx(pillBtnBase, pillBtnDefault, readOnly && 'opacity-50 pointer-events-none')}
                                >
                                    <span className="text-app-base font-black uppercase tracking-[0.1em]">{t('popular.open_popular')}</span>
                                </button>
                            </Tooltip>

                            {/* 自動組み立て / MYジョブハイライト / 進捗バー表示 は「⋯ その他」メニューへ集約済み */}

                            <div className="h-5 w-px shrink-0 dark:bg-app-text/25 bg-app-text/25 mx-0.5 rounded-full" />

                            {/* Sort */}
                            <span className="text-app-base font-black text-app-text uppercase tracking-[0.15em]">{t('ui.sort')}</span>
                            {/* #2b: 外 span=禁止カーソル(hover ターゲット) / 内 span=pointer-events-none(透過) */}
                            <span className={clsx(readOnly && 'cursor-not-allowed')}>
                            <span className={clsx(readOnly && 'pointer-events-none opacity-50')}>
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
                            </span>
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* [2] ── 常設ハンドル領域 ── */}
            {/* data-progress-drawer-anchor: 記録ドロワーがこの領域の下端1px線を上辺として密着配置するためのアンカー */}
            <div data-progress-drawer-anchor className="w-full relative shrink-0" style={{ height: '24px' }}>
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
                    <Tooltip content={!isHeaderCollapsed ? t('sidebar.collapse_header') : t('sidebar.expand_header')} position="bottom" wrapperClassName={clsx("w-full h-full", readOnly && "cursor-not-allowed")}>
                    <button
                        disabled={readOnly}
                        onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        className={clsx(
                            "relative w-full h-full overflow-hidden group/btn outline-none",
                            readOnly
                                ? "pointer-events-none"
                                : "cursor-pointer hover:bg-app-surface2 active:bg-app-surface2 transition-colors duration-200"
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

            <MitigationSheet
                isOpen={isMitiSheetOpen}
                onClose={() => setIsMitiSheetOpen(false)}
                currentContentId={currentContentId}
            />
        </motion.div>
    );
};
