import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/useTutorialStore';
import { useMitigationStore } from '../store/useMitigationStore';
import {
    CATEGORY_LABELS,
    getContentBySeries,
    getCategoriesByLevel,
    getSeriesByLevel,
    getProjectLabel,
    getContentById,
} from '../data/contentRegistry';
import type { ContentLevel, ContentCategory, ContentDefinition, SavedPlan } from '../types';
import { Tooltip } from './ui/Tooltip';
import type { MultiSelectState } from '../types/sidebarTypes';
import type { ContentLanguage } from '../store/useThemeStore';
import { usePlanStore } from '../store/usePlanStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../store/useAuthStore';
import { PLAN_LIMITS } from '../types/firebase';
import { NewPlanModal } from './NewPlanModal';
import { ShareModal } from './ShareModal';
import { getTemplate } from '../data/templateLoader';
import { createTutorialEvents, TUTORIAL_PLAN_TITLE } from '../data/tutorialTemplate';
import i18n from '../i18n';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import {
    Plus,
    ChevronLeft,
    ChevronRight,
    CheckSquare,
    Square,
    Share2,
    Trash2,
    X,
    Pencil,
    Copy,
    MoreVertical,
    Download,
} from 'lucide-react';
// Plus は新規作成ボタンで使用
import clsx from 'clsx';
import { showToast } from './Toast';
import { exportPlanToCSV } from '../utils/csvExporter';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface SidebarProps {
    isOpen: boolean;
    onToggle?: () => void;
    onClose?: () => void;
    /** モバイルのボトムシート内で使う場合trueにすると、幅100%・ハンドル非表示になる */
    fullWidth?: boolean;
}

const LEVEL_TIERS: ContentLevel[] = [100, 90, 80, 70];

// ─────────────────────────────────────────────
// Sub-component: ContentTreeItem
// ─────────────────────────────────────────────

interface ContentTreeItemProps {
    content: ContentDefinition;
    isActive: boolean;
    multiSelect: MultiSelectState;
    onToggleSelect: (id: string) => void;
    onSelect: (content: ContentDefinition, forceNew?: boolean) => void;
    highlightFirst?: boolean;
    lang: ContentLanguage;
}

const ContentTreeItem = React.memo<ContentTreeItemProps>(({
    content, isActive, multiSelect, onToggleSelect, onSelect, highlightFirst, lang
}) => {
    const { t } = useTranslation();
    const { plans, currentPlanId, updatePlan } = usePlanStore(
        useShallow(s => ({ plans: s.plans, currentPlanId: s.currentPlanId, updatePlan: s.updatePlan }))
    );
    const { runTransition } = useTransitionOverlay();
    const contentPlans = plans.filter(p => p.contentId === content.id);
    // 複数選択モード: プラン単位で選択する
    const hasSelectedPlan = multiSelect.isEnabled && contentPlans.some(p => multiSelect.selectedIds.includes(p.id));
    // 共有モードのみ10件制限、削除モードは無制限
    const isDisabled = multiSelect.isEnabled && multiSelect.mode === 'share' && !hasSelectedPlan && multiSelect.selectedIds.length >= 10;

    const floorName = content.name[lang as ContentLanguage] || content.name.ja;
    const shortName = content.shortName[lang as ContentLanguage] || content.shortName.ja;
    // 選択モード中にプラン0件のコンテンツは選択不可
    const hasNoPlans = contentPlans.length === 0;
    const isUnavailable = multiSelect.isEnabled && hasNoPlans;

    // プラン名インライン編集
    const [editingPlanId, setEditingPlanId] = React.useState<string | null>(null);
    const [editingTitle, setEditingTitle] = React.useState('');
    const editInputRef = React.useRef<HTMLInputElement>(null);

    // ⋮メニュー
    const [menuPlanId, setMenuPlanId] = React.useState<string | null>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const [menuPos, setMenuPos] = React.useState<{ top: number; right: number } | null>(null);

    // 削除確認ステート
    const [confirmDeletePlanId, setConfirmDeletePlanId] = React.useState<string | null>(null);
    const [deleteAnimating, setDeleteAnimating] = React.useState(false);

    // タッチデバイス判定（クリック/タップの文言切り替え用）
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const startEditing = (planId: string, title: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPlanId(planId);
        setEditingTitle(title);
        setTimeout(() => editInputRef.current?.select(), 0);
    };

    const finishEditing = () => {
        if (editingPlanId && editingTitle.trim()) {
            updatePlan(editingPlanId, { title: editingTitle.trim() });
        }
        setEditingPlanId(null);
    };

    // ⋮メニュー外クリックで閉じる（Portal対応: menuRef + data属性で除外判定）
    React.useEffect(() => {
        if (!menuPlanId) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (menuRef.current?.contains(target)) return;
            if (target.closest?.('[data-menu-trigger]')) return;
            setMenuPlanId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuPlanId]);

    // ⋮メニュー: Escapeで閉じる
    React.useEffect(() => {
        if (!menuPlanId) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setMenuPlanId(null);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [menuPlanId]);

    // メニューが閉じたら削除確認もリセット
    React.useEffect(() => {
        if (!menuPlanId) { setConfirmDeletePlanId(null); setMenuPos(null); setDeleteAnimating(false); }
    }, [menuPlanId]);

    // CSV機能が有効になったら `_` を外して復活させる
    const _handleCSVExport = (plan: SavedPlan) => {
        const lang = (i18n.language?.startsWith('ja') ? 'ja' : 'en') as 'ja' | 'en';
        exportPlanToCSV(
            plan.title,
            plan.data.timelineEvents || [],
            plan.data.timelineMitigations || [],
            plan.data.partyMembers || [],
            lang,
        );
        setMenuPlanId(null);
        showToast(t('sidebar.csv_exported', 'CSV をダウンロードしました'));
    };
    void _handleCSVExport; // TypeScript unused抑制



    return (
        <div className="w-full flex flex-col" data-content-id={content.id}>
            {/* コンテンツ名行 */}
            <div className="w-full flex items-center group/content">
                <Tooltip content={floorName} position="right" wrapperClassName="flex-1 min-w-0">
                <button
                    onClick={() => {
                        if (multiSelect.isEnabled) {
                            if (contentPlans.length === 1 && !isDisabled) {
                                // プラン1件 → そのプランIDをトグル
                                onToggleSelect(contentPlans[0].id);
                            } else if (contentPlans.length === 0) {
                                // プラン0件 → 選択不可（まだ開いてないコンテンツ）
                            } else {
                                // プラン2件以上 → コンテンツを開いてサブアイテム表示
                                onSelect(content);
                            }
                        } else {
                            onSelect(content);
                        }
                    }}
                    disabled={isDisabled}
                    {...(highlightFirst ? { "data-tutorial-first-item": "true" } : {})}
                    className={clsx(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 text-left group relative cursor-pointer min-h-[32px] active:scale-[0.98]",
                        isActive && !multiSelect.isEnabled
                            ? "text-app-text"
                            : "bg-transparent text-app-text hover:bg-glass-hover",
                        isDisabled && "opacity-40 cursor-not-allowed grayscale",
                        isUnavailable && "opacity-20 pointer-events-none"
                    )}
                >

                    <div className="w-6 shrink-0 flex items-center justify-center">
                        <div className="relative flex flex-col items-center shrink-0 w-6">
                            <div className={clsx(
                                "w-6 h-6 rounded flex items-center justify-center font-black text-[9px] shrink-0",
                                isActive && !multiSelect.isEnabled
                                    ? "bg-app-text text-app-bg"
                                    : "bg-glass-card text-app-text group-hover:bg-glass-hover"
                            )}>
                                {shortName.split('\n')[0]}
                            </div>
                            {shortName.split('\n')[1] && (
                                <span className="text-[7px] text-app-text-muted/60 font-bold leading-none mt-0.5">
                                    {shortName.split('\n')[1]}
                                </span>
                            )}
                        </div>
                    </div>

                    {multiSelect.isEnabled && (
                        <div className="flex items-center justify-center shrink-0 transition-all duration-300 animate-in fade-in slide-in-from-left-2 self-center">
                            {contentPlans.length <= 1 ? (
                                // 0〜1件: コンテンツ行にチェックボックス
                                contentPlans.length === 1 && multiSelect.selectedIds.includes(contentPlans[0].id)
                                    ? <CheckSquare size={16} className="text-app-text" />
                                    : contentPlans.length === 0
                                        ? <Square size={16} className="text-app-text-muted/20" />
                                        : <Square size={16} className="text-app-text-muted/40 group-hover:text-app-text-muted" />
                            ) : (
                                // 2件以上: 選択数表示
                                <span className="text-[9px] font-bold text-app-text-muted">
                                    {contentPlans.filter(p => multiSelect.selectedIds.includes(p.id)).length > 0
                                        ? `${contentPlans.filter(p => multiSelect.selectedIds.includes(p.id)).length}/${contentPlans.length}`
                                        : `${contentPlans.length}件`
                                    }
                                </span>
                            )}
                        </div>
                    )}

                    <div className={clsx(
                        "flex-1 min-w-0 flex flex-col justify-center",
                        isActive && !multiSelect.isEnabled ? "font-bold" : "font-medium"
                    )}>
                        <div className="truncate leading-tight text-[11px] text-inherit">
                            {floorName}
                        </div>
                    </div>
                </button>
                </Tooltip>

                {/* ホバーの+ボタンは廃止 → サブアイテム末尾の+行に移動 */}
            </div>

            {/* サブアイテム: 保存済みプラン一覧 */}
            {/* 通常モード: アクティブかつ1件以上で展開 / 複数選択モード: プランがあれば常に展開 */}
            {contentPlans.length >= 1 && (isActive || multiSelect.isEnabled) && (
                <div className="pl-9 pr-2 py-1 flex flex-col gap-0.5 border-l-2 border-app-text/15 ml-3.5 mt-1 mb-2">
                    {contentPlans.map(plan => {
                        const isPlanSelected = multiSelect.selectedIds.includes(plan.id);
                        const isPlanDisabled = multiSelect.isEnabled && multiSelect.mode === 'share' && !isPlanSelected && multiSelect.selectedIds.length >= 10;

                        return (
                            <div key={plan.id} className="flex items-center gap-1 w-full">
                                {multiSelect.isEnabled ? (
                                    // 複数選択モード: チェックボックス付きプラン行
                                    <button
                                        onClick={() => { if (!isPlanDisabled) onToggleSelect(plan.id); }}
                                        disabled={isPlanDisabled}
                                        className={clsx(
                                            "flex-1 text-left text-[10px] py-1 px-2 rounded-md transition-colors font-medium truncate flex items-center gap-2 cursor-pointer active:scale-[0.98]",
                                            isPlanSelected
                                                ? "bg-app-text/10 text-app-text font-bold"
                                                : "text-app-text hover:bg-glass-hover",
                                            isPlanDisabled && "opacity-40 cursor-not-allowed"
                                        )}
                                    >
                                        {isPlanSelected
                                            ? <CheckSquare size={12} className="text-app-text shrink-0" />
                                            : <Square size={12} className="text-app-text-muted/40 shrink-0" />
                                        }
                                        {plan.title}
                                    </button>
                                ) : editingPlanId === plan.id ? (
                                    <input
                                        ref={editInputRef}
                                        autoFocus
                                        value={editingTitle}
                                        onChange={e => setEditingTitle(e.target.value)}
                                        onBlur={finishEditing}
                                        onKeyDown={e => { if (e.key === 'Enter') finishEditing(); if (e.key === 'Escape') setEditingPlanId(null); }}
                                        className="flex-1 text-[10px] py-1 px-2 rounded-md bg-app-bg border border-app-text/30 text-app-text font-medium outline-none"
                                    />
                                ) : (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        className={clsx(
                                            "flex-1 min-w-0 text-left text-[10px] py-1 px-2 rounded-md transition-colors font-medium flex items-center gap-2 cursor-pointer active:scale-[0.98] group/plan",
                                            currentPlanId === plan.id
                                                ? "bg-app-text/10 text-app-text font-bold"
                                                : "text-app-text hover:bg-glass-hover",
                                            "relative"
                                        )}
                                        onClick={() => {
                                            if (currentPlanId === plan.id) return;
                                            runTransition(() => {
                                                const store = usePlanStore.getState();
                                                const snap = useMitigationStore.getState().getSnapshot();
                                                if (store.currentPlanId) {
                                                    store.updatePlan(store.currentPlanId, { data: snap });
                                                }
                                                useMitigationStore.getState().loadSnapshot(plan.data);
                                                store.setCurrentPlanId(plan.id);
                                            }, 'plan');
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                e.currentTarget.click();
                                            }
                                        }}
                                    >
                                        {currentPlanId === plan.id && (
                                            <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-app-text" />
                                        )}
                                        <span className={clsx("w-1 h-1 rounded-full shrink-0", currentPlanId === plan.id ? "bg-app-text" : "bg-app-text-muted/40")} />
                                        <Tooltip content={plan.title} position="top" wrapperClassName="flex-1 min-w-0 !w-auto !justify-start">
                                            <span className="block truncate text-left">{plan.title}</span>
                                        </Tooltip>
                                        <div className={clsx(
                                            "flex items-center shrink-0 transition-opacity duration-150",
                                            currentPlanId === plan.id
                                                ? "opacity-100"
                                                : "opacity-0 group-hover/plan:opacity-100"
                                        )}>
                                            <Tooltip content={t('sidebar.duplicate_plan')}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newPlan = usePlanStore.getState().duplicatePlan(plan.id);
                                                        if (!newPlan) {
                                                            showToast(t('sidebar.duplicate_limit_reached'), 'error');
                                                        }
                                                    }}
                                                    className="ml-auto shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                                >
                                                    <Copy size={9} />
                                                </button>
                                            </Tooltip>
                                            <Tooltip content={t('app.rename')}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); startEditing(plan.id, plan.title, e); }}
                                                    className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                                >
                                                    <Pencil size={9} />
                                                </button>
                                            </Tooltip>
                                            {/* ⋮ メニュー */}
                                            <div>
                                                <button
                                                    data-menu-trigger
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (menuPlanId === plan.id) {
                                                            setMenuPlanId(null);
                                                        } else {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                                            setMenuPlanId(plan.id);
                                                        }
                                                    }}
                                                    className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                                >
                                                    <MoreVertical size={9} />
                                                </button>
                                                {menuPlanId === plan.id && menuPos && createPortal(
                                                    <div
                                                        ref={menuRef}
                                                        className="fixed z-[99999] min-w-[140px] py-1 bg-app-bg border border-app-border rounded-lg shadow-lg"
                                                        style={{ top: menuPos.top, right: menuPos.right }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    >
                                                        <button
                                                            disabled
                                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-app-text-muted/40 cursor-not-allowed"
                                                        >
                                                            <Download size={11} />
                                                            {t('sidebar.export_csv')}
                                                        </button>
                                                        <div className="border-t border-app-border my-1" />
                                                        {confirmDeletePlanId === plan.id ? (
                                                            deleteAnimating ? (
                                                                <div className="w-full flex items-center justify-center py-1.5">
                                                                    <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        usePlanStore.getState().deletePlan(plan.id);
                                                                        setMenuPlanId(null);
                                                                        setConfirmDeletePlanId(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer rounded-sm"
                                                                >
                                                                    <Trash2 size={11} />
                                                                    {t(isTouchDevice ? 'sidebar.delete_single_confirm_tap' : 'sidebar.delete_single_confirm_click')}
                                                                </button>
                                                            )
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    setDeleteAnimating(true);
                                                                    setConfirmDeletePlanId(plan.id);
                                                                    setTimeout(() => setDeleteAnimating(false), 400);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                            >
                                                                <Trash2 size={11} />
                                                                {t('sidebar.delete_single')}
                                                            </button>
                                                        )}
                                                    </div>,
                                                    document.body
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {/* 「+」行 — 同コンテンツに新しいプランを追加 */}
                    {isActive && !multiSelect.isEnabled && (
                        contentPlans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT ? (
                            <div className="flex-1 text-[10px] py-1 px-2 font-medium flex items-center gap-2 text-app-text-muted/40">
                                {t('sidebar.plan_limit', { current: contentPlans.length, max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT })}
                            </div>
                        ) : (
                            <button
                                onClick={() => onSelect(content, true)}
                                className="flex-1 text-left text-[10px] py-1 px-2 rounded-md transition-colors font-medium flex items-center gap-2 text-app-text-muted hover:text-app-text hover:bg-glass-hover cursor-pointer active:scale-[0.98]"
                            >
                                <Plus size={10} className="shrink-0" />
                                {t('sidebar.add_plan')}
                            </button>
                        )
                    )}
                </div>
            )}
        </div>
    );
});
ContentTreeItem.displayName = 'ContentTreeItem';

// ─────────────────────────────────────────────
// Sub-component: SeriesAccordion
// ─────────────────────────────────────────────

interface SeriesAccordionProps {
    series: any;
    floors: ContentDefinition[];
    selectedContentId: string | null;
    multiSelect: MultiSelectState;
    onToggleSelect: (id: string) => void;
    onSelectContent: (content: ContentDefinition, forceNew?: boolean) => void;
    lang: ContentLanguage;
    highlightFirst?: boolean;
    showLabel: boolean;
    defaultExpanded?: boolean;
}

const SeriesAccordion: React.FC<SeriesAccordionProps> = ({
    series, floors, selectedContentId, multiSelect, onToggleSelect, onSelectContent, lang, highlightFirst, showLabel, defaultExpanded = true
}) => {
    const hasActiveFloor = React.useMemo(() => floors.some(f => f.id === selectedContentId), [floors, selectedContentId]);
    const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

    React.useEffect(() => {
        if (hasActiveFloor) {
            setIsExpanded(true);
        }
    }, [hasActiveFloor]);

    const seriesName = series.name[lang as ContentLanguage] || series.name.ja;

    if (!showLabel) {
        return (
            <div className="space-y-0.5">
                {floors.map((floor, idx) => (
                    <ContentTreeItem
                        key={floor.id}
                        content={floor}
                        isActive={floor.id === selectedContentId}
                        multiSelect={multiSelect}
                        onToggleSelect={onToggleSelect}
                        onSelect={onSelectContent}
                        lang={lang}
                        highlightFirst={highlightFirst && idx === 0}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="mb-1">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full text-[10px] text-app-text font-bold px-2 py-1.5 truncate flex items-center gap-1.5 group/series hover:bg-glass-hover rounded-md transition-colors cursor-pointer active:scale-[0.98]"
            >
                <div className="transition-transform duration-200 shrink-0" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    <ChevronRight size={10} className="text-app-text-muted" />
                </div>
                <span className={clsx("flex-1 text-left truncate", "text-app-text")}>
                    {seriesName}
                </span>
            </button>
            {isExpanded && (
                <div className="space-y-0.5 mt-0.5 animate-in fade-in slide-in-from-left-1 duration-200">
                    {floors.map((floor, idx) => (
                        <ContentTreeItem
                            key={floor.id}
                            content={floor}
                            isActive={floor.id === selectedContentId}
                            multiSelect={multiSelect}
                            onToggleSelect={onToggleSelect}
                            onSelect={onSelectContent}
                            lang={lang}
                            highlightFirst={highlightFirst && idx === 0}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// Sub-component: CategoryAccordion
// ─────────────────────────────────────────────

interface CategoryAccordionProps {
    level: ContentLevel;
    category: ContentCategory;
    selectedContentId: string | null;
    multiSelect: MultiSelectState;
    onToggleSelect: (id: string) => void;
    onSelectContent: (content: ContentDefinition, forceNew?: boolean) => void;
    highlightFirst?: boolean;
    lang: ContentLanguage;
    defaultExpanded?: boolean;
}

const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
    level, category, selectedContentId, multiSelect, onToggleSelect, onSelectContent, highlightFirst, lang, defaultExpanded = false
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const projectLabel = getProjectLabel(level, category);
    const categoryLabel = projectLabel
        ? `${CATEGORY_LABELS[category][lang as ContentLanguage] || CATEGORY_LABELS[category].ja}：${projectLabel[lang as ContentLanguage] || projectLabel.ja}`
        : CATEGORY_LABELS[category][lang as ContentLanguage] || CATEGORY_LABELS[category].ja;
    const seriesList = getSeriesByLevel(level).filter(s => s.category === category);
    if (seriesList.length === 0) return null;

    return (
        <div className="mb-2">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={clsx(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer transition-colors duration-200 active:scale-[0.98]",
                    "text-app-text hover:bg-glass-hover",
                    "font-bold text-[10px] tracking-widest uppercase"
                )}
                data-tutorial="sidebar-category"
            >
                <div className="transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    <ChevronRight size={12} />
                </div>
                <span>{categoryLabel}</span>
            </button>

            {isExpanded && (
                <div className="ml-3 mt-1 space-y-0.5 border-l border-glass-border pl-2 animate-in fade-in slide-in-from-left-1 duration-200">
                    {seriesList.map((series, idx) => (
                        <SeriesAccordion
                            key={series.id}
                            series={series}
                            floors={getContentBySeries(series.id)}
                            selectedContentId={selectedContentId}
                            multiSelect={multiSelect}
                            onToggleSelect={onToggleSelect}
                            onSelectContent={onSelectContent}
                            lang={lang}
                            highlightFirst={highlightFirst}
                            showLabel={seriesList.length > 1}
                            defaultExpanded={idx === 0}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// Sub-component: FreePlanSection
// ダンジョン・レイド・その他のフリープラン表示
// ─────────────────────────────────────────────

interface FreePlanSectionProps {
    label: string;
    plans: import('../types').SavedPlan[];
    currentPlanId: string | null;
    multiSelect: MultiSelectState;
    onToggleSelect: (id: string) => void;
    onLoadPlan: (id: string) => void;
    onUpdatePlan: (id: string, data: Partial<import('../types').SavedPlan>) => void;
}

const FreePlanSection: React.FC<FreePlanSectionProps> = ({
    label, plans: catPlans, currentPlanId, multiSelect, onToggleSelect, onLoadPlan, onUpdatePlan
}) => {
    const { t } = useTranslation();
    const [editingPlanId, setEditingPlanId] = React.useState<string | null>(null);
    const [editingTitle, setEditingTitle] = React.useState('');
    const editInputRef = React.useRef<HTMLInputElement>(null);

    const startEditing = (planId: string, title: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPlanId(planId);
        setEditingTitle(title);
        setTimeout(() => editInputRef.current?.select(), 0);
    };
    const finishEditing = () => {
        if (editingPlanId && editingTitle.trim()) {
            onUpdatePlan(editingPlanId, { title: editingTitle.trim() });
        }
        setEditingPlanId(null);
    };

    return (
        <div className="mb-2 mt-2">
            <div className="px-2 py-1.5">
                <span className="font-bold text-[10px] tracking-widest uppercase text-app-text-muted">
                    {label}
                </span>
            </div>
            <div className="ml-3 mt-1 space-y-0.5 border-l border-glass-border pl-2">
                {catPlans.map(plan => {
                    const isPlanSelected = multiSelect.isEnabled && multiSelect.selectedIds.includes(plan.id);
                    const isPlanDisabled = multiSelect.isEnabled && multiSelect.mode === 'share' && !isPlanSelected && multiSelect.selectedIds.length >= 10;

                    if (multiSelect.isEnabled) {
                        return (
                            <button
                                key={plan.id}
                                onClick={() => { if (!isPlanDisabled) onToggleSelect(plan.id); }}
                                disabled={isPlanDisabled}
                                className={clsx(
                                    "w-full text-left text-[10px] py-1 px-2 rounded-md transition-colors font-medium truncate flex items-center gap-2 cursor-pointer active:scale-[0.98]",
                                    isPlanSelected ? "bg-app-text/10 text-app-text font-bold" : "text-app-text hover:bg-glass-hover",
                                    isPlanDisabled && "opacity-40 cursor-not-allowed"
                                )}
                            >
                                {isPlanSelected
                                    ? <CheckSquare size={12} className="text-app-text shrink-0" />
                                    : <Square size={12} className="text-app-text-muted/40 shrink-0" />}
                                {plan.title}
                            </button>
                        );
                    }

                    if (editingPlanId === plan.id) {
                        return (
                            <input
                                key={plan.id}
                                ref={editInputRef}
                                autoFocus
                                value={editingTitle}
                                onChange={e => setEditingTitle(e.target.value)}
                                onBlur={finishEditing}
                                onKeyDown={e => { if (e.key === 'Enter') finishEditing(); if (e.key === 'Escape') setEditingPlanId(null); }}
                                className="flex-1 text-[10px] py-1 px-2 rounded-md bg-app-bg border border-app-text/30 text-app-text font-medium outline-none w-full"
                            />
                        );
                    }

                    return (
                        <button
                            key={plan.id}
                            onClick={() => onLoadPlan(plan.id)}
                            className={clsx(
                                "w-full text-left text-[10px] py-1 px-2 rounded-md transition-colors font-medium truncate flex items-center gap-2 cursor-pointer active:scale-[0.98] relative",
                                currentPlanId === plan.id ? "text-app-text font-bold" : "text-app-text hover:bg-glass-hover"
                            )}
                        >
                            {currentPlanId === plan.id && (
                                <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-app-text" />
                            )}
                            <span className={clsx("w-1 h-1 rounded-full shrink-0", currentPlanId === plan.id ? "bg-app-text" : "bg-app-text-muted/40")} />
                            {plan.title}
                            {currentPlanId === plan.id && (
                                <Tooltip content={t('app.rename')}>
                                    <button
                                        onClick={(e) => startEditing(plan.id, plan.title, e)}
                                        className="ml-auto shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                    >
                                        <Pencil size={9} />
                                    </button>
                                </Tooltip>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Main: Sidebar
// ─────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onClose, fullWidth }) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const { isActive: tutorialActive, currentStepIndex } = useTutorialStore();
    const { runTransition } = useTransitionOverlay();
    const lang = contentLanguage;

    const [activeLevel, setActiveLevel] = useState<ContentLevel>(100);
    const [activeCategory, setActiveCategory] = useState<ContentCategory | 'all'>('all');
    // 現在開いているプランのcontentIdで初期化（タブ復帰時にサイドバーが展開されるように）
    const [selectedContentId, setSelectedContentId] = useState<string | null>(() => {
        const planStore = usePlanStore.getState();
        if (planStore.currentPlanId) {
            const currentPlan = planStore.plans.find(p => p.id === planStore.currentPlanId);
            return currentPlan?.contentId ?? null;
        }
        return null;
    });
    const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
    // チュートリアル戻るボタン用: ストアからモーダルを閉じるカスタムイベント
    React.useEffect(() => {
        const handleClose = () => setIsNewPlanModalOpen(false);
        window.addEventListener('tutorial:close-new-plan-modal', handleClose);
        return () => window.removeEventListener('tutorial:close-new-plan-modal', handleClose);
    }, []);
    const [multiSelect, setMultiSelect] = useState<MultiSelectState>({
        isEnabled: false,
        selectedIds: [],
        mode: 'share',
    });
    // 削除確認モーダル
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    // フローティングアクションバーの視線誘導アニメーション
    const floatingBarRef = useRef<HTMLDivElement>(null);
    const [floatingBarFlash, setFloatingBarFlash] = useState(false);
    const prevSelectedCount = useRef(multiSelect.selectedIds.length);
    React.useEffect(() => {
        const count = multiSelect.selectedIds.length;
        if (count !== prevSelectedCount.current && count > 0) {
            // ボーダーフラッシュ
            setFloatingBarFlash(true);
            const el = floatingBarRef.current;
            if (el) {
                el.style.borderColor = 'var(--color-app-text, #e8e8e8)';
                el.style.boxShadow = '0 8px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08)';
                setTimeout(() => {
                    el.style.borderColor = '';
                    el.style.boxShadow = '';
                }, 300);
            }
            setTimeout(() => setFloatingBarFlash(false), 350);
        }
        prevSelectedCount.current = count;
    }, [multiSelect.selectedIds.length]);

    // 名前入力ダイアログ用ステート
    const [pendingContent, setPendingContent] = useState<ContentDefinition | null>(null);
    const [pendingPlanName, setPendingPlanName] = useState('');
    // ローディング状態（テンプレート読み込み・プラン切替中）

    const { plans, currentPlanId, setCurrentPlanId, updatePlan } = usePlanStore(
        useShallow(s => ({ plans: s.plans, currentPlanId: s.currentPlanId, setCurrentPlanId: s.setCurrentPlanId, updatePlan: s.updatePlan }))
    );
    const { getSnapshot, loadSnapshot } = useMitigationStore();

    // currentPlanIdが変わったらselectedContentIdも追従する（タブ復帰・プラン切替時）
    React.useEffect(() => {
        if (currentPlanId) {
            const plan = plans.find(p => p.id === currentPlanId);
            if (plan?.contentId) {
                setSelectedContentId(plan.contentId);
            }
        }
    }, [currentPlanId, plans]);

    // コンテンツクリック → 既存プランがあればそれを開く、なければ名前入力ダイアログを表示
    const handleSelectContent = (content: ContentDefinition, forceNew?: boolean) => {
        setSelectedContentId(content.id);

        // 既にこのコンテンツのプランがある場合
        // （forceNew または チュートリアル中は既存プランを無視し、新規チュートリアルプランを作成する）
        const isTutorial = useTutorialStore.getState().isActive;
        const planStore = usePlanStore.getState();
        const existingPlans = !forceNew && !isTutorial
            ? planStore.plans.filter(p => p.contentId === content.id)
            : [];
        if (existingPlans.length >= 2) {
            // 複数プランあり → サブアイテム展開のみ（ユーザーが選ぶ）
            return;
        }

        const store = useMitigationStore.getState();

        // 現在のプランを保存してから切り替え
        if (currentPlanId) {
            planStore.updatePlan(currentPlanId, { data: store.getSnapshot() });
        }

        if (existingPlans.length === 1) {
            // 1件だけ → そのまま開く
            const plan = existingPlans[0];
            runTransition(() => {
                store.loadSnapshot(plan.data);
                planStore.setCurrentPlanId(plan.id);
                setActiveLevel(plan.data.currentLevel as ContentLevel);
            }, 'plan');
            // スマホのみメニューを閉じる（PCはユーザーが自分で閉じる体験を残す）
            if (fullWidth) onClose?.();
            return;
        }

        // 件数制限チェック（チュートリアル中はスキップ）
        if (!useTutorialStore.getState().isActive) {
            const totalCount = planStore.plans.length;
            const contentCount = planStore.plans.filter(p => p.contentId === content.id).length;
            if (totalCount >= PLAN_LIMITS.MAX_TOTAL_PLANS) {
                alert(t('new_plan.plan_limit_total', { max: PLAN_LIMITS.MAX_TOTAL_PLANS }));
                return;
            }
            if (contentCount >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) {
                alert(t('new_plan.plan_limit_per_content', { max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT }));
                return;
            }
        }

        // 新規作成
        const defaultName = content.shortName.en || content.shortName.ja;

        // チュートリアル中はダイアログをスキップ、専用プラン名で自動作成
        if (useTutorialStore.getState().isActive) {
            const lang = i18n.language?.startsWith('ja') ? 'ja' : 'en';
            const tutorialName = `${defaultName}_${TUTORIAL_PLAN_TITLE[lang]}`;
            createPlanDirectly(content, tutorialName, true);
            return;
        }

        // 通常: 名前入力ダイアログを表示
        setPendingContent(content);
        setPendingPlanName(defaultName);
    };

    // テンプレート読み込み → プラン保存（共通ロジック）
    // isTutorial: trueの場合、テンプレートの代わりにTUTORIAL_EVENTSをロード
    const createPlanDirectly = (content: ContentDefinition, planTitle: string, isTutorial?: boolean) => {
        runTransition(async () => {
            const store = useMitigationStore.getState();
            const planStore = usePlanStore.getState();

            store.setCurrentLevel(content.level);
            store.applyDefaultStats(content.level, content.patch);
            // 新しいコンテンツを開くので軽減・パーティをクリア
            store.clearAllMitigations();
            // パーティ構成もリセット（前のプランのジョブが引き継がれないように）
            store.updatePartyBulk(
                store.partyMembers.map(m => ({ memberId: m.id, jobId: null }))
            );
            store.setMyMemberId(null);
            setActiveLevel(content.level);

            if (isTutorial) {
                // チュートリアル: 実際のステータスからダメージを動的計算
                const members = store.partyMembers;
                const tankHp = members.find(m => m.role === 'tank')?.stats.hp ?? 100000;
                const otherHp = members.find(m => m.role === 'healer')?.stats.hp ?? 80000;
                const snap = store.getSnapshot();
                store.loadSnapshot({
                    ...snap,
                    timelineMitigations: [],
                    timelineEvents: createTutorialEvents(otherHp, tankHp),
                    phases: [],
                });
            } else {
                // 通常: テンプレートを裏で読み込み → 自動でプランとして保存
                const tpl = await getTemplate(content.id);
                if (tpl) {
                    // リセットされた初期状態にテンプレートのイベントを合成
                    const snap = store.getSnapshot();
                    store.loadSnapshot({
                        ...snap,
                        timelineMitigations: [],
                        timelineEvents: tpl.timelineEvents,
                        phases: tpl.phases ? tpl.phases
                            .filter(p => p.startTimeSec >= 0)
                            .map((p, i, arr) => {
                                const nextStart = arr[i + 1]?.startTimeSec;
                                const maxTime = Math.max(...tpl.timelineEvents.map(e => e.time), 0);
                                return {
                                    id: `phase_${p.id}`,
                                    name: p.name ? `Phase ${i + 1}\n${p.name}` : `Phase ${i + 1}`,
                                    endTime: nextStart !== undefined ? nextStart : maxTime + 10
                                };
                            }) : []
                    });
                } else {
                    // テンプレートなし → 空のプランで即開始
                    store.loadSnapshot({
                        ...store.getSnapshot(),
                        timelineEvents: [],
                        timelineMitigations: [],
                        phases: []
                    });
                }
            }

            const newPlanId = `plan_${Date.now()}`;
            planStore.addPlan({
                id: newPlanId,
                ownerId: 'local',
                ownerDisplayName: 'Guest',
                contentId: content.id,
                title: planTitle,
                isPublic: false,
                copyCount: 0,
                useCount: 0,
                data: store.getSnapshot(),
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            planStore.setCurrentPlanId(newPlanId);

            // チュートリアル: テンプレートなしでもプラン作成完了を通知
            useTutorialStore.getState().completeEvent('timeline:events-loaded');
        }, 'plan');
    };

    // ダイアログから呼ばれるラッパー
    const handleConfirmNewPlan = () => {
        if (!pendingContent || !pendingPlanName.trim()) return;
        createPlanDirectly(pendingContent, pendingPlanName.trim());
        setPendingContent(null);
        setPendingPlanName('');
        // スマホのみメニューを閉じる
        if (fullWidth) onClose?.();
    };

    const handleCancelNewPlan = () => {
        setPendingContent(null);
        setPendingPlanName('');
    };

    const handleLoadPlan = (planId: string) => {
        const plan = usePlanStore.getState().getPlan(planId);
        if (!plan || currentPlanId === planId) return;

        runTransition(() => {
            // Save current session before switching
            if (currentPlanId) {
                const snapshot = getSnapshot();
                updatePlan(currentPlanId, { data: snapshot });
            }

            // Load new plan
            loadSnapshot(plan.data);
            setCurrentPlanId(planId);
            setSelectedContentId(plan.contentId);
            setActiveLevel(plan.data.currentLevel as ContentLevel);
        }, 'plan');
    };

    const toggleMultiSelectMode = (mode: 'share' | 'delete' = 'share') => {
        setMultiSelect(prev => {
            if (prev.isEnabled && prev.mode === mode) {
                // 同じモードを再度押した → オフにする
                return { isEnabled: false, selectedIds: [], mode: 'share' };
            }
            // オフ→オン or 別モードに切り替え
            return { isEnabled: true, selectedIds: [], mode };
        });
    };

    const toggleItemId = (id: string) => {
        setMultiSelect(prev => {
            const isSelected = prev.selectedIds.includes(id);
            if (isSelected) {
                return { ...prev, selectedIds: prev.selectedIds.filter(i => i !== id) };
            } else if (prev.mode === 'delete' || prev.selectedIds.length < 10) {
                return { ...prev, selectedIds: [...prev.selectedIds, id] };
            }
            return prev;
        });
    };

    // まとめて共有（バンドル） → モーダル経由
    const [bundleModalOpen, setBundleModalOpen] = useState(false);
    const [bundlePlansForModal, setBundlePlansForModal] = useState<{ contentId: string | null; title: string; planData: any }[]>([]);

    const handleShareBundle = () => {
        if (multiSelect.selectedIds.length === 0) return;

        // 現在のプランを保存
        const planStore = usePlanStore.getState();
        const mitiStore = useMitigationStore.getState();
        if (currentPlanId) {
            planStore.updatePlan(currentPlanId, { data: mitiStore.getSnapshot() });
        }

        // 選択されたプランIDからデータを収集
        const bundlePlans = multiSelect.selectedIds
            .map(planId => {
                const plan = planStore.plans.find(p => p.id === planId);
                if (!plan) return null;
                return {
                    contentId: plan.contentId,
                    title: plan.title,
                    planData: plan.data,
                };
            })
            .filter(Boolean) as { contentId: string | null; title: string; planData: any }[];

        if (bundlePlans.length === 0) {
            showToast(t('app.share_no_plans') || 'プランがありません');
            return;
        }

        setBundlePlansForModal(bundlePlans);
        setBundleModalOpen(true);
    };

    const availableCategories = useMemo(() => getCategoriesByLevel(activeLevel), [activeLevel]);

    useMemo(() => {
        if (activeCategory !== 'all' && !availableCategories.includes(activeCategory)) {
            setActiveCategory('all');
        }
    }, [availableCategories, activeCategory]);

    const isTutorialContentSelect = tutorialActive && TUTORIAL_STEPS[currentStepIndex]?.id === 'content-select';

    // Proximity and hover state for the handle
    const [isNear, setIsNear] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    return (<>
        <motion.aside
            initial={false}
            animate={{ width: fullWidth ? '100%' : isOpen ? (isNear ? 312 : 300) : (isNear ? 36 : 24) }}
            transition={fullWidth ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
            className={clsx("h-full flex z-40 relative group/sidebar glass-tier3 glass-frame glass-border-t-0 glass-border-r-0 glass-shadow-none", !fullWidth && "shadow-sm")}
            style={fullWidth ? { width: '100%', minWidth: '100%' } : undefined}
        >
            {/* [1] サイドバー本体 (コンテンツエリア) */}
            <motion.div
                animate={{ width: fullWidth ? '100%' : isOpen ? 276 : 0 }}
                transition={fullWidth ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
                className="h-full flex flex-col overflow-hidden"
                style={fullWidth ? { width: '100%', minWidth: '100%' } : undefined}
            >
                <div className={clsx(fullWidth ? "w-full" : "w-[276px]", "flex flex-col h-full overflow-hidden")}>
                    {/* Header Controls area with save button instead of big new plan */}
                    <div className="p-2 border-b border-glass-border" />

                    {!multiSelect.isEnabled && plans.length > 0 && (
                        <div className="pb-2 shrink-0 mt-3">
                            <div className="flex items-center mb-2 px-4">
                                <span className="text-[10px] font-black text-app-text uppercase tracking-tighter">
                                    {t('sidebar.recent_activity')}
                                </span>
                            </div>
                            <div className="space-y-1 max-h-[84px] overflow-y-auto px-3 custom-scrollbar">
                                {plans.slice(0, 5).map((plan) => (
                                    <button
                                        key={plan.id}
                                        onClick={() => handleLoadPlan(plan.id)}
                                        className={clsx(
                                            "w-full flex items-center gap-2 group py-1.5 px-2 rounded-lg transition-colors border cursor-pointer active:scale-[0.98]",
                                            currentPlanId === plan.id
                                                ? "bg-transparent border-transparent"
                                                : "bg-transparent border-transparent hover:bg-glass-active"
                                        )}
                                    >
                                        <div className="min-w-0">
                                            <p className={clsx(
                                                "text-[9.5px] font-black truncate leading-tight",
                                                currentPlanId === plan.id ? "text-app-text" : "text-app-text"
                                            )}>
                                                {plan.title}
                                            </p>
                                            <p className="text-[8px] text-app-text-sec font-medium truncate leading-tight mt-0.5">
                                                {plan.contentId && getContentById(plan.contentId)?.name[lang as ContentLanguage]}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                                {plans.length === 0 && (
                                    <div className="px-2 py-4 border border-dashed border-glass-border rounded-lg text-center">
                                        <p className="text-[9px] text-white/20 italic">No plans yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="px-3 space-y-2 shrink-0 mb-3">
                        <div className="flex gap-1 bg-glass-card/80 rounded-lg p-0.5 border border-glass-border shadow-sm">
                            {LEVEL_TIERS.map(level => (
                                <button
                                    key={level}
                                    onClick={() => {
                                        setActiveLevel(level);
                                        useMitigationStore.getState().setCurrentLevel(level);
                                    }}
                                    className={clsx(
                                        "flex-1 py-1.5 rounded-md text-[10px] font-black transition-all duration-200 cursor-pointer active:scale-95",
                                        activeLevel === level
                                            ? "bg-app-text text-app-bg shadow-lg scale-[1.02] z-10"
                                            : "text-app-text hover:bg-glass-hover"
                                    )}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-1 overflow-x-auto no-scrollbar scroll-smooth pb-1">
                            <button
                                onClick={() => setActiveCategory('all')}
                                className={clsx(
                                    "whitespace-nowrap px-3 py-1.5 rounded-full text-[9px] font-black transition-all duration-300 border cursor-pointer active:scale-95",
                                    activeCategory === 'all'
                                        ? "bg-app-text text-app-bg border-app-text shadow-md"
                                        : "bg-glass-card text-app-text border-glass-border hover:bg-app-text hover:border-app-text hover:text-app-bg"
                                )}
                            >
                                {t('ui.all').toUpperCase()}
                            </button>
                            {availableCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={clsx(
                                        "whitespace-nowrap px-3 py-1.5 rounded-full text-[9px] font-black transition-all duration-300 border cursor-pointer active:scale-95",
                                        activeCategory === cat
                                            ? "bg-app-text text-app-bg border-app-text shadow-md"
                                            : "bg-glass-card text-app-text border-glass-border hover:bg-app-text hover:border-app-text hover:text-app-bg"
                                    )}
                                >
                                    {(CATEGORY_LABELS[cat][lang as ContentLanguage] || CATEGORY_LABELS[cat].ja).toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-3 flex items-center gap-1 mb-2 shrink-0 flex-wrap">
                        <button
                            onClick={() => {
                                setIsNewPlanModalOpen(true);
                                useTutorialStore.getState().completeEvent('sidebar:new-plan-clicked');
                            }}
                            data-tutorial="new-plan"
                            className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-black transition-all duration-300 border cursor-pointer bg-glass-card text-app-text border-glass-border hover:bg-app-text hover:border-app-text hover:text-app-bg active:scale-95 shadow-sm"
                        >
                            <Plus size={10} />
                            {t('sidebar.new_plan').toUpperCase()}
                        </button>
                        <button
                            onClick={() => toggleMultiSelectMode('share')}
                            className={clsx(
                                "flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-black transition-all duration-300 border cursor-pointer active:scale-95",
                                multiSelect.isEnabled && multiSelect.mode === 'share'
                                    ? "bg-app-text text-app-bg border-app-text shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-app-text hover:border-app-text hover:text-app-bg shadow-sm"
                            )}
                        >
                            {multiSelect.isEnabled && multiSelect.mode === 'share' ? <CheckSquare size={10} /> : <Square size={10} />}
                            {t('sidebar.multi_select_mode').toUpperCase()}
                        </button>
                        {/* 選択削除ボタン — 押すと削除用選択モードに入る */}
                        <button
                            onClick={() => toggleMultiSelectMode('delete')}
                            className={clsx(
                                "flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-black transition-all duration-300 border cursor-pointer active:scale-95 shadow-sm",
                                multiSelect.isEnabled && multiSelect.mode === 'delete'
                                    ? "bg-app-text text-app-bg border-app-text shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-app-text hover:border-app-text hover:text-app-bg"
                            )}
                        >
                            <Trash2 size={10} />
                            {t('sidebar.select_delete').toUpperCase()}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 pb-20 space-y-1 custom-scrollbar">
                        {availableCategories
                            .filter(c => activeCategory === 'all' || activeCategory === c)
                            .map(category => (
                                <CategoryAccordion
                                    key={`${activeLevel}-${category}`}
                                    level={activeLevel}
                                    category={category}
                                    selectedContentId={selectedContentId}
                                    multiSelect={multiSelect}
                                    onToggleSelect={toggleItemId}
                                    onSelectContent={handleSelectContent}
                                    lang={lang}
                                    highlightFirst={isTutorialContentSelect && category === availableCategories[0]}
                                    defaultExpanded={category === 'savage' || category === 'ultimate'}
                                />
                            ))}

                        {/* カテゴリ付きフリープラン（ダンジョン・レイド・その他） */}
                        {(['dungeon', 'raid', 'custom'] as const)
                            .filter(cat => activeCategory === 'all' || activeCategory === cat)
                            .map(cat => {
                            // categoryフィールドで振り分け。contentIdがcontents.jsonに存在しないプランも対象
                            const catPlans = plans.filter(p => {
                                if (p.data.currentLevel !== activeLevel) return false;
                                // categoryフィールドがある場合はそれで判定
                                if (p.category) return p.category === cat;
                                // 旧プラン互換: contentIdがnullで categoryもない → customに振り分け
                                if (p.contentId === null && cat === 'custom') return true;
                                // contentIdがあるがcontents.jsonに未登録 → customに振り分け
                                if (p.contentId && !getContentById(p.contentId) && cat === 'custom') return true;
                                return false;
                            });
                            if (catPlans.length === 0) return null;
                            const catLabel = CATEGORY_LABELS[cat][lang as ContentLanguage] || CATEGORY_LABELS[cat].ja;
                            return (
                                <FreePlanSection
                                    key={cat}
                                    label={catLabel}
                                    plans={catPlans}
                                    currentPlanId={currentPlanId}
                                    multiSelect={multiSelect}
                                    onToggleSelect={toggleItemId}
                                    onLoadPlan={handleLoadPlan}
                                    onUpdatePlan={updatePlan}
                                />
                            );
                        })}
                    </div>

                    {/* フローティングアクションバー — 画面下部中央（createPortalでbody直下） */}
                    {createPortal(
                        <div className={clsx(
                            "fixed bottom-6 left-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5",
                            "bg-app-bg border border-app-text/15 rounded-2xl",
                            "shadow-[0_8px_32px_rgba(0,0,0,.6)]",
                            "transition-all duration-300",
                            multiSelect.isEnabled
                                ? "opacity-100 translate-x-[-50%] translate-y-0 pointer-events-auto"
                                : "opacity-0 translate-x-[-50%] translate-y-10 pointer-events-none"
                        )}
                            ref={floatingBarRef}
                        >
                            {/* 選択件数 */}
                            <span className={clsx(
                                "text-[11px] font-black text-app-text whitespace-nowrap min-w-[72px] text-center",
                                floatingBarFlash && "animate-[floatingCountBounce_.3s_cubic-bezier(.34,1.56,.64,1)]"
                            )}
                                key={multiSelect.selectedIds.length}
                            >
                                {multiSelect.mode === 'delete'
                                    ? t('sidebar.selected_count_simple', { count: multiSelect.selectedIds.length })
                                    : t('sidebar.selected_count', { count: multiSelect.selectedIds.length })
                                }
                            </span>
                            <div className="w-px h-5 bg-app-text/10 shrink-0" />
                            {/* キャンセル */}
                            <button
                                onClick={() => setMultiSelect({ isEnabled: false, selectedIds: [], mode: 'share' })}
                                className="py-1.5 px-4 rounded-lg text-[11px] font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                            >
                                {t('sidebar.cancel')}
                            </button>
                            {/* アクションボタン */}
                            {multiSelect.mode === 'share' ? (
                                <button
                                    onClick={handleShareBundle}
                                    disabled={multiSelect.selectedIds.length === 0}
                                    className={clsx(
                                        "flex items-center gap-2 py-1.5 px-4 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap",
                                        multiSelect.selectedIds.length > 0
                                            ? "bg-app-blue text-white hover:bg-app-blue-hover active:scale-95"
                                            : "bg-app-blue-dim text-app-text-muted opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <Share2 size={13} />
                                    <span>{t('sidebar.share_together')}</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (multiSelect.selectedIds.length === 0) return;
                                        setShowDeleteConfirm(true);
                                    }}
                                    disabled={multiSelect.selectedIds.length === 0}
                                    className={clsx(
                                        "flex items-center gap-2 py-1.5 px-4 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap",
                                        multiSelect.selectedIds.length > 0
                                            ? "bg-app-red text-white hover:bg-app-red-hover active:scale-95"
                                            : "bg-app-red-dim text-app-text-muted opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <Trash2 size={13} />
                                    <span>{t('sidebar.delete')}</span>
                                </button>
                            )}
                        </div>,
                        document.body
                    )}

                    {/* Ko-fi 支援リンク — サイドバー最下部に控えめ配置 */}
                    {!multiSelect.isEnabled && (
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                            <a
                                href="https://ko-fi.com/lopoly"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-app-text-muted hover:text-app-text transition-colors"
                            >
                                {isOpen ? <>☕ {t('footer.support')}</> : '☕'}
                            </a>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* [2] ── 近接センサー付き・究極の常設ハンドル領域 ── */}
            {fullWidth ? null : <div
                className="h-full w-6 z-50 flex items-center justify-center shrink-0 relative"
                onMouseEnter={() => setIsNear(true)}
                onMouseLeave={() => setIsNear(false)}
            >
                {/* 近接センサー領域 (透明) — ハンドルよりも広い反応範囲 */}
                {/* ── 修正: サイドバーコンテンツのボタンに干渉しないよう、左側の張り出しを抑える ── */}
                <div
                    className="absolute top-24 bottom-0 -left-1 w-[60px] pointer-events-auto cursor-pointer"
                    onMouseEnter={() => setIsNear(true)}
                />

                <motion.div
                    className={clsx(
                        "absolute left-0 h-full bg-glass-header z-50",
                        tutorialActive && currentStepIndex <= 2 ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                    initial={false}
                    animate={{ width: isNear ? 36 : 24 }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                >
                    <Tooltip content={isOpen ? t('sidebar.close_menu') : t('sidebar.open_menu')} position="right" wrapperClassName="w-full h-full">
                    <button
                        onClick={() => onToggle?.()}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        className={clsx(
                            "relative w-full h-full cursor-pointer overflow-hidden group/btn",
                            "hover:bg-app-surface2 active:bg-app-surface2 transition-colors duration-200"
                        )}
                    >
                        {/* 迫り出し感のある背景 — 透明化 */}
                        <motion.div
                            className="absolute inset-0 bg-transparent"
                            animate={{ opacity: isNear ? 0.5 : 0.1 }}
                            transition={{ duration: 0.15 }}
                        />

                        {/* 左端の固定ライン（右端はサイドバーのglass-tier3 borderが担当） */}
                        <div className="absolute inset-y-0 left-0 w-[1px] bg-app-border group-hover/btn:bg-app-text-muted transition-colors duration-200" />

                        <div className="relative flex items-center justify-center h-full">
                            <motion.div
                                className="flex items-center justify-center"
                                animate={{
                                    rotate: isOpen ? 0 : 180,
                                    x: isHovered ? (isOpen ? [-2, 2, -2] : [2, -2, 2]) : 0,
                                    scale: isHovered ? 1.8 : 1
                                }}
                                transition={{
                                    rotate: { type: "spring", stiffness: 260, damping: 20 },
                                    x: isHovered ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : { duration: 0.2 },
                                    scale: { duration: 0.2 }
                                }}
                            >
                                <ChevronLeft
                                    size={18}
                                    className={clsx(
                                        "transition-all duration-200",
                                        isOpen
                                            ? "text-app-text-muted group-hover/btn:text-app-text-sec"
                                            : "text-app-text-muted",
                                        isHovered && "text-app-text-sec"
                                    )}
                                />
                            </motion.div>
                        </div>

                        {/* 右端の境界線 (拡張に合わせて移動) */}
                        <div className={clsx(
                            "absolute right-0 top-0 bottom-0 w-[1px] transition-all duration-200",
                            isOpen ? "bg-glass-border" : "bg-app-border"
                        )} />
                    </button>
                    </Tooltip>
                </motion.div>
            </div>}
            <NewPlanModal isOpen={isNewPlanModalOpen} onClose={(created) => {
                setIsNewPlanModalOpen(false);
                // チュートリアル: モーダルを閉じたことを通知
                useTutorialStore.getState().completeEvent('tutorial:new-plan-modal-closed');
                if (created) {
                    setSelectedContentId(created.contentId);
                    setActiveLevel(created.level);
                    // 作成されたコンテンツが見える位置までスクロール
                    setTimeout(() => {
                        const el = document.querySelector(`[data-content-id="${created.contentId}"]`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 200);
                }
            }} />
            <ShareModal
                isOpen={bundleModalOpen}
                onClose={() => {
                    setBundleModalOpen(false);
                    setMultiSelect({ isEnabled: false, selectedIds: [] });
                }}
                contentLabel={null}
                currentPlan={undefined}
                bundlePlans={bundlePlansForModal}
            />

            {/* 名前入力ダイアログ — createPortalでbodyに配置（motion.aside内のtransformでfixedが効かない問題を回避） */}
            {pendingContent && createPortal(
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
                    onClick={handleCancelNewPlan}
                >
                    <div
                        className="relative bg-app-bg border border-app-border rounded-2xl shadow-2xl w-[360px] max-w-[90vw] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-app-border">
                            <h3 className="text-sm font-bold text-app-text">
                                {t('sidebar.name_dialog_title')}
                            </h3>
                            <p className="text-[11px] text-app-text-muted mt-1">
                                {t('sidebar.name_dialog_desc')}
                            </p>
                        </div>
                        <div className="px-5 py-4">
                            <input
                                autoFocus
                                type="text"
                                value={pendingPlanName}
                                onChange={e => setPendingPlanName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && pendingPlanName.trim()) handleConfirmNewPlan();
                                    if (e.key === 'Escape') handleCancelNewPlan();
                                }}
                                onFocus={e => e.target.select()}
                                className="w-full px-4 py-3 bg-app-surface2 border border-app-border rounded-xl text-sm text-app-text font-bold outline-none focus:border-app-text/40 transition-colors"
                            />
                        </div>
                        <div className="px-5 pb-4 flex gap-2">
                            <button
                                onClick={handleCancelNewPlan}
                                className="flex-1 py-2.5 rounded-xl border border-app-border text-xs font-bold text-app-text hover:bg-app-surface2 transition-colors cursor-pointer"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleConfirmNewPlan}
                                disabled={!pendingPlanName.trim()}
                                className={clsx(
                                    "flex-[2] py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                                    pendingPlanName.trim()
                                        ? "bg-app-text text-app-bg hover:opacity-80 active:scale-[0.98]"
                                        : "bg-app-surface2 text-app-text-muted cursor-not-allowed"
                                )}
                            >
                                {t('sidebar.create_plan_button')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* 削除確認モーダル — NewPlanModalと同じ温度感 */}
            {showDeleteConfirm && createPortal(
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <div
                        className="relative w-full max-w-[400px] glass-tier3 rounded-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ヘッダー */}
                        <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                            <h2 className="text-[13px] font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                                <span className="w-1.5 h-4 bg-app-text rounded-full" />
                                {t('sidebar.delete_confirm_title')}
                            </h2>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="p-2 rounded-full text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* 本文 */}
                        <div className="p-6 space-y-3">
                            <p className="text-[13px] font-bold text-app-text text-center">
                                {t('sidebar.delete_confirm', { count: multiSelect.selectedIds.length })}
                            </p>
                            <p className="text-[11px] text-app-text-muted text-center">
                                {t('sidebar.delete_warning')}
                            </p>
                        </div>

                        {/* フッター */}
                        <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex gap-4">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-[11px] font-black text-app-text hover:bg-glass-hover transition-all cursor-pointer uppercase tracking-widest active:scale-95"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    const planStore = usePlanStore.getState();
                                    const authUser = useAuthStore.getState().user;
                                    for (const id of multiSelect.selectedIds) {
                                        const plan = planStore.plans.find(p => p.id === id);
                                        if (authUser) {
                                            // ログイン中: Firestoreから即時削除
                                            planStore.deleteFromFirestore(id, authUser.uid, plan?.contentId || null);
                                        } else {
                                            planStore.deletePlan(id);
                                        }
                                    }
                                    setMultiSelect({ isEnabled: false, selectedIds: [], mode: 'share' });
                                    setShowDeleteConfirm(false);
                                }}
                                className="flex-[2] py-3.5 rounded-2xl text-[11px] font-black bg-app-red text-white hover:bg-app-red-hover transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95"
                            >
                                {t('sidebar.delete')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </motion.aside>
    </>);
};
