import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { useMitigationStore } from '../store/useMitigationStore';
import {
    CATEGORY_LABELS,
    getContentBySeries,
    getCategoriesByLevel,
    getSeriesByLevel,
    getProjectLabel,
    getContentById,
} from '../data/contentRegistry';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';
import { Tooltip } from './ui/Tooltip';
import type { MultiSelectState } from '../types/sidebarTypes';
import type { ContentLanguage } from '../store/useThemeStore';
import { usePlanStore } from '../store/usePlanStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../store/useAuthStore';
import { PLAN_LIMITS } from '../types/firebase';
import { NewPlanModal } from './NewPlanModal';
import { ShareModal } from './ShareModal';
import { LoginModal } from './LoginModal';
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
    HardDrive,
    Download,
} from 'lucide-react';
// Plus は新規作成ボタンで使用
import clsx from 'clsx';
import { showToast } from './Toast';
import { BackupExportModal } from './BackupExportModal';
import { BackupRestoreModal } from './BackupRestoreModal';

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

    // プランが存在するコンテンツはデフォルト展開、クリックでトグル
    const [isExpanded, setIsExpanded] = React.useState(contentPlans.length > 0);

    // プランが0→1件になったら自動展開
    const prevPlanCount = React.useRef(contentPlans.length);
    React.useEffect(() => {
        if (prevPlanCount.current === 0 && contentPlans.length > 0) {
            setIsExpanded(true);
        }
        prevPlanCount.current = contentPlans.length;
    }, [contentPlans.length]);

    // プラン名インライン編集
    const [editingPlanId, setEditingPlanId] = React.useState<string | null>(null);
    const [editingTitle, setEditingTitle] = React.useState('');
    const editInputRef = React.useRef<HTMLInputElement>(null);

    // 削除確認ステート
    const [confirmDeletePlanId, setConfirmDeletePlanId] = React.useState<string | null>(null);

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




    return (
        <div className="w-full flex flex-col" data-content-id={content.id}>
            {/* コンテンツ名行 */}
            <div className="w-full flex items-center group/content">
                <Tooltip content={floorName} position="right" wrapperClassName="flex-1 min-w-0">
                    <button
                        onClick={() => {
                            // チュートリアル中はプラン有無に関わらず新規作成フローへ
                            if (useTutorialStore.getState().isActive) {
                                onSelect(content);
                                return;
                            }
                            if (multiSelect.isEnabled) {
                                if (contentPlans.length === 0) {
                                    // プラン0件 → 選択不可
                                } else {
                                    // コンテンツ内の全プランをトグル
                                    const planIds = contentPlans.map(p => p.id);
                                    const allSelected = planIds.every(id => multiSelect.selectedIds.includes(id));
                                    if (allSelected) {
                                        planIds.forEach(id => onToggleSelect(id));
                                    } else {
                                        planIds.filter(id => !multiSelect.selectedIds.includes(id)).forEach(id => onToggleSelect(id));
                                    }
                                    if (!allSelected) setIsExpanded(true);
                                }
                            } else if (contentPlans.length > 0) {
                                // プランあり → サブアイテムをトグル展開
                                setIsExpanded(v => !v);
                            } else {
                                // プランなし → 新規プラン作成
                                onSelect(content);
                            }
                        }}
                        disabled={isDisabled}
                        {...(highlightFirst ? { "data-tutorial-first-item": "true" } : {})}
                        className={clsx(
                            "sidebar-item w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 text-left group relative cursor-pointer min-h-[32px] active:scale-[0.98]",
                            isActive && !multiSelect.isEnabled
                                ? "text-app-text"
                                : "bg-transparent text-app-text hover:bg-glass-hover",
                            isDisabled && "opacity-40 cursor-not-allowed grayscale",
                            isUnavailable && "opacity-20 pointer-events-none"
                        )}
                    >

                        <div className="shrink-0 flex items-center justify-center">
                            <div className={clsx(
                                "w-8 h-9 rounded flex flex-col items-center justify-center font-black text-app-base shrink-0",
                                isActive && !multiSelect.isEnabled
                                    ? "bg-app-text text-app-bg"
                                    : "bg-glass-card text-app-text group-hover:bg-glass-hover"
                            )}>
                                <span className="leading-none">{shortName.split('\n')[0]}</span>
                                {shortName.split('\n')[1] && (
                                    <span className="text-app-sm leading-none mt-0.5">{shortName.split('\n')[1]}</span>
                                )}
                            </div>
                        </div>

                        {multiSelect.isEnabled && (
                            <div className="flex items-center gap-1.5 shrink-0 transition-all duration-300 animate-in fade-in slide-in-from-left-2 self-center">
                                {(() => {
                                    if (contentPlans.length === 0) {
                                        return <Square size={16} className="text-app-text-muted/20" />;
                                    }
                                    const selectedCount = contentPlans.filter(p => multiSelect.selectedIds.includes(p.id)).length;
                                    const allSelected = selectedCount === contentPlans.length;
                                    return (
                                        <>
                                            {allSelected ? (
                                                <CheckSquare size={16} className="text-app-text" />
                                            ) : selectedCount > 0 ? (
                                                <CheckSquare size={16} className="text-app-text opacity-50" />
                                            ) : (
                                                <Square size={16} className="text-app-text-muted/40 group-hover:text-app-text-muted" />
                                            )}
                                            {contentPlans.length > 1 && selectedCount > 0 && (
                                                <span className="text-app-xs font-bold text-app-text-muted">
                                                    {selectedCount}/{contentPlans.length}
                                                </span>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* プランありシェブロン（展開インジケーター兼プラン存在表示） */}
                        {contentPlans.length > 0 && !multiSelect.isEnabled && (
                            <ChevronRight
                                size={12}
                                className="shrink-0 text-app-text-muted transition-transform duration-200"
                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            />
                        )}

                        {/* クリック領域を維持するための flex-1 スペーサー */}
                        <div className="flex-1 min-w-0" />
                    </button>
                </Tooltip>

                {/* ホバーの+ボタンは廃止 → サブアイテム末尾の+行に移動 */}
            </div>

            {/* サブアイテム: 保存済みプラン一覧 */}
            {contentPlans.length >= 1 && (isExpanded || multiSelect.isEnabled) && (
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
                                            "sidebar-item flex-1 text-left text-app-base py-1 px-2 rounded-md transition-colors font-medium truncate flex items-center gap-2 cursor-pointer active:scale-[0.98]",
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
                                        className="flex-1 text-app-base py-1 px-2 rounded-md bg-app-bg border border-app-text/30 text-app-text font-medium outline-none"
                                    />
                                ) : (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        className={clsx(
                                            "sidebar-item flex-1 min-w-0 text-left text-app-base py-1 px-2 rounded-md transition-colors font-medium flex items-center gap-2 cursor-pointer active:scale-[0.98] group/plan",
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
                                            {/* 削除ボタン（2段階確認） */}
                                            <Tooltip content={confirmDeletePlanId === plan.id ? t('sidebar.delete_single_confirm_click') : t('sidebar.delete_single')}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirmDeletePlanId === plan.id) {
                                                        const ps = usePlanStore.getState();
                                                        const authUser = useAuthStore.getState().user;
                                                        if (authUser) {
                                                            ps.deleteFromFirestore(plan.id, authUser.uid, plan.contentId);
                                                        } else {
                                                            ps.deletePlan(plan.id);
                                                        }
                                                        setConfirmDeletePlanId(null);
                                                    } else {
                                                        setConfirmDeletePlanId(plan.id);
                                                        setTimeout(() => setConfirmDeletePlanId(null), 3000);
                                                    }
                                                }}
                                                className={clsx(
                                                    "shrink-0 rounded flex items-center justify-center transition-colors cursor-pointer",
                                                    confirmDeletePlanId === plan.id
                                                        ? "text-red-500 bg-red-500/10 px-2 py-0.5 gap-1"
                                                        : "text-app-text-muted hover:text-red-500 hover:bg-red-500/10 w-5 h-5"
                                                )}
                                            >
                                                <Trash2 size={9} />
                                                {confirmDeletePlanId === plan.id && (
                                                    <span className="text-[10px] font-bold whitespace-nowrap">{t('sidebar.delete_single')}</span>
                                                )}
                                            </button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {/* 「+」行 — 同コンテンツに新しいプランを追加 */}
                    {isActive && !multiSelect.isEnabled && (
                        contentPlans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT ? (
                            <div className="flex-1 text-app-base py-1 px-2 font-medium flex items-center gap-2 text-app-text-muted/40">
                                {t('sidebar.plan_limit', { current: contentPlans.length, max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT })}
                            </div>
                        ) : (
                            <button
                                onClick={() => onSelect(content, true)}
                                className="flex-1 text-left text-app-base py-1 px-2 rounded-md transition-colors font-medium flex items-center gap-2 text-app-text-muted hover:text-app-text hover:bg-glass-hover cursor-pointer active:scale-[0.98]"
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
    onToggleSeriesSelect?: (floorIds: string[]) => void;
    onSelectContent: (content: ContentDefinition, forceNew?: boolean) => void;
    lang: ContentLanguage;
    highlightFirst?: boolean;
    showLabel: boolean;
    defaultExpanded?: boolean;
}

const SeriesAccordion: React.FC<SeriesAccordionProps> = ({
    series, floors, selectedContentId, multiSelect, onToggleSelect, onToggleSeriesSelect, onSelectContent, lang, highlightFirst, showLabel, defaultExpanded = true
}) => {
    const hasActiveFloor = React.useMemo(() => floors.some(f => f.id === selectedContentId), [floors, selectedContentId]);
    const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
    const plans = usePlanStore(s => s.plans);

    React.useEffect(() => {
        if (hasActiveFloor) {
            setIsExpanded(true);
        }
    }, [hasActiveFloor]);

    const seriesName = series.name[lang as ContentLanguage] || series.name.ja;

    // シリーズ一括選択: 共有=各層の1番目、削除=全プラン
    const seriesPlanIds = React.useMemo(() => {
        if (multiSelect.mode === 'delete') {
            // 削除モード: シリーズ内の全プランを対象
            return floors.flatMap(floor => plans.filter(p => p.contentId === floor.id).map(p => p.id));
        }
        // 共有モード: 各層の1番目のプランのみ
        return floors
            .map(floor => {
                const floorPlans = plans.filter(p => p.contentId === floor.id);
                return floorPlans.length > 0 ? floorPlans[0].id : null;
            })
            .filter((id): id is string => id !== null);
    }, [floors, plans, multiSelect.mode]);

    // シリーズ内の選択状態: 全選択/一部/なし
    const selectedCount = React.useMemo(() =>
        seriesPlanIds.filter(id => multiSelect.selectedIds.includes(id)).length
        , [seriesPlanIds, multiSelect.selectedIds]);
    const isAllSelected = seriesPlanIds.length > 0 && selectedCount === seriesPlanIds.length;
    const isSomeSelected = selectedCount > 0 && !isAllSelected;

    const handleSeriesCheckbox = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onToggleSeriesSelect && seriesPlanIds.length > 0) {
            onToggleSeriesSelect(seriesPlanIds);
            // チェック時に展開する
            if (!isAllSelected) {
                setIsExpanded(true);
            }
        }
    };

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
                onClick={multiSelect.isEnabled && seriesPlanIds.length > 0 ? handleSeriesCheckbox : () => setIsExpanded(!isExpanded)}
                className="sidebar-item w-full text-app-lg text-app-text font-bold px-2 py-1.5 truncate flex items-center gap-1.5 group/series hover:bg-glass-hover rounded-md transition-colors cursor-pointer active:scale-[0.98]"
            >
                {multiSelect.isEnabled && seriesPlanIds.length > 0 ? (
                    <div className={clsx(
                        "shrink-0 transition-colors",
                        isAllSelected || isSomeSelected ? "text-app-text" : "text-app-text-muted/40 group-hover/series:text-app-text-muted"
                    )}>
                        {isAllSelected ? (
                            <CheckSquare size={14} />
                        ) : isSomeSelected ? (
                            <CheckSquare size={14} className="opacity-50" />
                        ) : (
                            <Square size={14} />
                        )}
                    </div>
                ) : (
                    <div className="transition-transform duration-200 shrink-0" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                        <ChevronRight size={10} className="text-app-text-muted" />
                    </div>
                )}
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
    onToggleSeriesSelect?: (floorIds: string[]) => void;
    onSelectContent: (content: ContentDefinition, forceNew?: boolean) => void;
    highlightFirst?: boolean;
    lang: ContentLanguage;
    defaultExpanded?: boolean;
}


const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
    level, category, selectedContentId, multiSelect, onToggleSelect, onToggleSeriesSelect, onSelectContent, highlightFirst, lang, defaultExpanded = false
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
                    "sidebar-item w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer transition-colors duration-200 active:scale-[0.98]",
                    "text-app-text hover:bg-glass-hover",
                    "font-bold text-app-lg tracking-widest uppercase"
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
                            onToggleSeriesSelect={onToggleSeriesSelect}
                            onSelectContent={onSelectContent}
                            lang={lang}
                            highlightFirst={highlightFirst}
                            showLabel={seriesList.length > 1 || category === 'ultimate'}
                            defaultExpanded={category === 'ultimate' || idx === 0}
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
                <span className="font-bold text-app-base tracking-widest uppercase text-app-text-muted">
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
                                    "sidebar-item w-full text-left text-app-base py-1 px-2 rounded-md transition-colors font-medium truncate flex items-center gap-2 cursor-pointer active:scale-[0.98]",
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
                                className="flex-1 text-app-base py-1 px-2 rounded-md bg-app-bg border border-app-text/30 text-app-text font-medium outline-none w-full"
                            />
                        );
                    }

                    return (
                        <button
                            key={plan.id}
                            onClick={() => onLoadPlan(plan.id)}
                            className={clsx(
                                "sidebar-item w-full text-left text-app-base py-1 px-2 rounded-md transition-colors font-medium truncate flex items-center gap-2 cursor-pointer active:scale-[0.98] relative",
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

    // 現在のプランからレベル・カテゴリ・選択アイテムを初期化
    const [selectedContentId, setSelectedContentId] = useState<string | null>(() => {
        const planStore = usePlanStore.getState();
        if (planStore.currentPlanId) {
            const currentPlan = planStore.plans.find(p => p.id === planStore.currentPlanId);
            return currentPlan?.contentId ?? null;
        }
        return null;
    });
    const [activeLevel, setActiveLevel] = useState<ContentLevel>(() => {
        if (selectedContentId) {
            const content = getContentById(selectedContentId);
            if (content) return content.level;
        }
        return 100;
    });
    const [activeCategory, setActiveCategory] = useState<ContentCategory | 'all'>(() => {
        if (selectedContentId) {
            const content = getContentById(selectedContentId);
            if (content) return content.category;
        }
        return 'all';
    });
    const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
    const [backupExportOpen, setBackupExportOpen] = useState(false);
    const [backupRestoreOpen, setBackupRestoreOpen] = useState(false);
    // チュートリアル戻るボタン用: ストアからモーダルを閉じるカスタムイベント
    React.useEffect(() => {
        const handleClose = () => setIsNewPlanModalOpen(false);
        window.addEventListener('tutorial:close-new-plan-modal', handleClose);
        return () => window.removeEventListener('tutorial:close-new-plan-modal', handleClose);
    }, []);

    // チュートリアル開始時に最新レベルを自動選択
    React.useEffect(() => {
        if (tutorialActive) {
            setActiveLevel(LEVEL_TIERS[0]);
            setActiveCategory('all');
        }
    }, [tutorialActive]);

    // チュートリアル復帰時にサイドバーのレベル・カテゴリを同期
    React.useEffect(() => {
        const handleRestored = (e: Event) => {
            const { contentId } = (e as CustomEvent).detail ?? {};
            if (contentId) {
                const c = getContentById(contentId);
                if (c) {
                    setActiveLevel(c.level);
                    setActiveCategory(c.category);
                    setSelectedContentId(contentId);
                }
            }
        };
        window.addEventListener('tutorial:plan-restored', handleRestored);
        return () => window.removeEventListener('tutorial:plan-restored', handleRestored);
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
    const user = useAuthStore(s => s.user);
    const [showLoginModal, setShowLoginModal] = useState(false);
    // ローディング状態（テンプレート読み込み・プラン切替中）

    const { plans, currentPlanId, setCurrentPlanId, updatePlan } = usePlanStore(
        useShallow(s => ({ plans: s.plans, currentPlanId: s.currentPlanId, setCurrentPlanId: s.setCurrentPlanId, updatePlan: s.updatePlan }))
    );
    const { getSnapshot, loadSnapshot } = useMitigationStore();

    // currentPlanIdが変わったらselectedContentIdも追従する（タブ復帰・プラン切替時）
    // プラン未選択時（全削除後・初回起動）はデフォルト状態にリセット
    React.useEffect(() => {
        if (currentPlanId) {
            const plan = plans.find(p => p.id === currentPlanId);
            if (plan?.contentId) {
                setSelectedContentId(plan.contentId);
            }
        } else {
            setActiveLevel(LEVEL_TIERS[0]);
            setActiveCategory('all');
            setSelectedContentId(null);
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
        if (existingPlans.length >= 1) {
            // プランあり → サブアイテム展開のみ（プラン読込はサブアイテムから）
            return;
        }

        const store = useMitigationStore.getState();

        // 現在のプランを保存してから切り替え
        if (currentPlanId) {
            planStore.updatePlan(currentPlanId, { data: store.getSnapshot() });
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
            setActiveCategory(content.category);

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
                // テンプレートを裏で読み込み → 自動でプランとして保存
                const tpl = await getTemplate(content.id);
                if (tpl) {
                    const snap = store.getSnapshot();
                    // ラベル変換: TemplateData.labels → Label[]
                    const labels = tpl.labels
                        ? tpl.labels.map(l => ({
                            id: crypto.randomUUID(),
                            name: l.name,
                            startTime: l.startTimeSec,
                            ...(l.endTimeSec !== undefined ? { endTime: l.endTimeSec } : {}),
                        }))
                        : undefined;
                    store.loadSnapshot({
                        ...snap,
                        timelineMitigations: [],
                        timelineEvents: tpl.timelineEvents,
                        phases: tpl.phases ? tpl.phases
                            .filter(p => p.startTimeSec >= 0)
                            .map((p, i) => ({
                                id: `phase_${p.id}`,
                                name: p.name
                                    ? (typeof p.name === 'string'
                                        ? { ja: p.name, en: '' }
                                        : {
                                            ja: p.name.ja || `Phase ${i + 1}`,
                                            en: p.name.en || `Phase ${i + 1}`,
                                            ...(p.name.zh ? { zh: p.name.zh } : {}),
                                            ...(p.name.ko ? { ko: p.name.ko } : {}),
                                        })
                                    : { ja: `Phase ${i + 1}`, en: `Phase ${i + 1}` },
                                startTime: p.startTimeSec,
                            })) : [],
                        ...(labels ? { labels } : {}),
                    });
                } else {
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

            // チュートリアル: トランジション完了後にステップ進行（ローディング中にカード移動が見えない問題を回避）
            setTimeout(() => {
                useTutorialStore.getState().completeEvent('content:selected');
            }, 800);
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
            const c = plan.contentId ? getContentById(plan.contentId) : undefined;
            const newLevel = (c?.level ?? plan.level ?? plan.data.currentLevel ?? activeLevel) as ContentLevel;
            const newCategory = c?.category ?? 'custom';
            setActiveLevel(newLevel);
            setActiveCategory(newCategory);
            useMitigationStore.getState().setCurrentLevel(newLevel);
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

    // シリーズ一括選択: 全選択済みなら全解除、それ以外なら未選択分を追加
    const toggleSeriesSelect = (planIds: string[]) => {
        setMultiSelect(prev => {
            const allSelected = planIds.every(id => prev.selectedIds.includes(id));
            if (allSelected) {
                // 全解除
                return { ...prev, selectedIds: prev.selectedIds.filter(id => !planIds.includes(id)) };
            } else {
                // 未選択分を追加（共有モード時は10件制限を考慮）
                const toAdd = planIds.filter(id => !prev.selectedIds.includes(id));
                const newIds = [...prev.selectedIds];
                for (const id of toAdd) {
                    if (prev.mode === 'delete' || newIds.length < 10) {
                        newIds.push(id);
                    }
                }
                return { ...prev, selectedIds: newIds };
            }
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

    // チュートリアルのステップ1（コンテンツ選択）でサイドバーの最初のアイテムをハイライト
    const tutorialStep = useTutorialStore(s => s.getCurrentStep());
    const isTutorialContentSelect = tutorialStep?.id === 'main-1-content';

    const [isHovered, setIsHovered] = useState(false);

    return (<>
        <motion.aside
            initial={false}
            animate={{ width: fullWidth ? '100%' : isOpen ? 300 : 24 }}
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

                    <div className="border-b border-glass-border mx-3 mb-2 mt-3" />
                    <div className="px-3 shrink-0 mb-3">
                        <div className="flex items-center bg-glass-card/80 rounded-lg p-0.5 border border-glass-border shadow-sm">
                            {LEVEL_TIERS.map((level, i) => (
                                <React.Fragment key={level}>
                                    {i > 0 && <div className="w-px h-3 bg-app-text/15 shrink-0" />}
                                    <button
                                        onClick={() => {
                                            setActiveLevel(level);
                                            useMitigationStore.getState().setCurrentLevel(level);
                                        }}
                                        className={clsx(
                                            "flex-1 py-1.5 rounded-md text-app-base font-black transition-all duration-200 cursor-pointer active:scale-95",
                                            activeLevel === level
                                                ? "bg-app-text text-app-bg shadow-lg scale-[1.02] z-10"
                                                : "text-app-text hover:bg-glass-hover"
                                        )}
                                    >
                                        {level}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        <div className="border-b border-glass-border my-2" />

                        <div
                            className="flex items-center bg-glass-card/80 rounded-lg p-0.5 border border-glass-border shadow-sm overflow-x-auto custom-scrollbar-thin"
                            onWheel={(e) => {
                                if (e.deltaY !== 0) {
                                    e.currentTarget.scrollLeft += e.deltaY;
                                    e.preventDefault();
                                }
                            }}
                        >
                            <button
                                onClick={() => setActiveCategory('all')}
                                className={clsx(
                                    "flex-1 min-w-fit whitespace-nowrap px-3 py-1.5 rounded-md text-app-base font-black transition-all duration-200 cursor-pointer active:scale-95",
                                    activeCategory === 'all'
                                        ? "bg-app-text text-app-bg shadow-lg"
                                        : "text-app-text hover:bg-glass-hover"
                                )}
                            >
                                {t('ui.all').toUpperCase()}
                            </button>
                            {availableCategories.map(cat => (
                                <React.Fragment key={cat}>
                                    <div className="w-px h-3 bg-app-text/15 shrink-0" />
                                    <button
                                        onClick={() => setActiveCategory(cat)}
                                        className={clsx(
                                            "flex-1 min-w-fit whitespace-nowrap px-3 py-1.5 rounded-md text-app-base font-black transition-all duration-200 cursor-pointer active:scale-95",
                                            activeCategory === cat
                                                ? "bg-app-text text-app-bg shadow-lg"
                                                : "text-app-text hover:bg-glass-hover"
                                        )}
                                    >
                                        {(CATEGORY_LABELS[cat][lang as ContentLanguage] || CATEGORY_LABELS[cat].ja).toUpperCase()}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        <div className="border-b border-glass-border my-2" />

                        <div className="flex items-center gap-1 flex-wrap">
                        <button
                            onClick={() => {
                                setIsNewPlanModalOpen(true);
                                // create-plan チュートリアルトリガー（初回のみ）
                                const tutState = useTutorialStore.getState();
                                if (!tutState.completed['create-plan'] && !tutState.isActive) {
                                    tutState.startTutorial('create-plan');
                                }
                            }}
                            data-tutorial="new-plan-btn"
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-app-base font-black transition-all duration-300 border cursor-pointer bg-glass-card text-app-text border-glass-border hover:bg-app-text hover:border-app-text hover:text-app-bg active:scale-95 shadow-sm"
                        >
                            <Plus size={12} />
                            {t('sidebar.new_plan').toUpperCase()}
                        </button>
                        <button
                            onClick={() => toggleMultiSelectMode('share')}
                            className={clsx(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-app-base font-black transition-all duration-300 border cursor-pointer active:scale-95",
                                multiSelect.isEnabled && multiSelect.mode === 'share'
                                    ? "bg-app-text text-app-bg border-app-text shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-app-text hover:border-app-text hover:text-app-bg shadow-sm"
                            )}
                        >
                            {multiSelect.isEnabled && multiSelect.mode === 'share' ? <CheckSquare size={12} /> : <Square size={12} />}
                            {t('sidebar.multi_select_mode').toUpperCase()}
                        </button>
                        {/* 選択削除ボタン — 押すと削除用選択モードに入る */}
                        <button
                            onClick={() => toggleMultiSelectMode('delete')}
                            className={clsx(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-app-base font-black transition-all duration-300 border cursor-pointer active:scale-95 shadow-sm",
                                multiSelect.isEnabled && multiSelect.mode === 'delete'
                                    ? "bg-app-text text-app-bg border-app-text shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-app-text hover:border-app-text hover:text-app-bg"
                            )}
                        >
                            <Trash2 size={12} />
                            {t('sidebar.select_delete').toUpperCase()}
                        </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
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
                                    onToggleSeriesSelect={toggleSeriesSelect}
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
                                    // レベルフィルタ: p.level（不変）を優先、なければコンテンツ定義、最後にdata.currentLevel
                                    const planLevel = p.level ?? (p.contentId ? getContentById(p.contentId)?.level : undefined) ?? p.data.currentLevel;
                                    if (Number(planLevel) !== Number(activeLevel)) return false;
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
                            multiSelect.isEnabled && !bundleModalOpen
                                ? "opacity-100 translate-x-[-50%] translate-y-0 pointer-events-auto"
                                : "opacity-0 translate-x-[-50%] translate-y-10 pointer-events-none"
                        )}
                            ref={floatingBarRef}
                        >
                            {/* 選択件数 */}
                            <span className={clsx(
                                "text-app-md font-black text-app-text whitespace-nowrap min-w-[72px] text-center",
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
                                className="py-1.5 px-4 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                            >
                                {t('sidebar.cancel')}
                            </button>
                            {/* アクションボタン */}
                            {multiSelect.mode === 'share' ? (
                                <button
                                    onClick={handleShareBundle}
                                    disabled={multiSelect.selectedIds.length === 0}
                                    className={clsx(
                                        "flex items-center gap-2 py-1.5 px-4 rounded-lg text-app-md font-black transition-all cursor-pointer whitespace-nowrap",
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
                                        "flex items-center gap-2 py-1.5 px-4 rounded-lg text-app-md font-black transition-all cursor-pointer whitespace-nowrap",
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

                    {/* バックアップ/復元ボタン */}
                    {!multiSelect.isEnabled && (
                        <div className="shrink-0 px-3 pt-1 pb-0">
                            <div className="border-t border-glass-border w-full mb-1" />
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setBackupExportOpen(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-app-sm text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                >
                                    <HardDrive size={11} />
                                    {isOpen ? t('backup.backup_button') : null}
                                </button>
                                <button
                                    onClick={() => setBackupRestoreOpen(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-app-sm text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
                                >
                                    <Download size={11} />
                                    {isOpen ? t('backup.restore_button') : null}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Ko-fi 支援リンク — サイドバー最下部 */}
                    {!multiSelect.isEnabled && (
                        <div className="shrink-0 flex flex-col items-center py-2">
                            <div className="border-t border-glass-border w-full mb-2" />
                            <a
                                href="https://ko-fi.com/lopoly"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-app-sm text-app-text-muted hover:text-app-text transition-colors font-scale-exclude"
                            >
                                {isOpen ? <>☕ {t('footer.support')}</> : '☕'}
                            </a>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* [2] ── 常設ハンドル領域 ── */}
            {fullWidth ? null : <div
                className="h-full w-6 z-50 flex items-center justify-center shrink-0 relative"
            >
                {/* 左端の固定ライン — チュートリアル中もハンドルが非表示でも常に表示 */}
                {tutorialActive && currentStepIndex <= 2 && (
                    <div className="absolute inset-y-0 left-0 w-[1px] bg-app-border z-50" />
                )}

                <div
                    className={clsx(
                        "absolute left-0 h-full w-6 bg-glass-header z-50",
                        tutorialActive && currentStepIndex <= 2 ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
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
                                            "text-app-text-muted group-hover/btn:text-app-text-sec",
                                            isHovered && "text-app-text-sec"
                                        )}
                                    />
                                </motion.div>
                            </div>

                            {/* 右端の境界線 */}
                            <div className={clsx(
                                "absolute right-0 top-0 bottom-0 w-[1px] transition-all duration-200",
                                isOpen ? "bg-glass-border" : "bg-app-border",
                                "group-hover/btn:bg-app-text-muted"
                            )} />
                        </button>
                    </Tooltip>
                </div>
            </div>}
            <NewPlanModal isOpen={isNewPlanModalOpen} onClose={(created) => {
                setIsNewPlanModalOpen(false);
                if (created) {
                    setSelectedContentId(created.contentId);
                    const newLevel = created.level as ContentLevel;
                    setActiveLevel(newLevel);
                    useMitigationStore.getState().setCurrentLevel(newLevel);
                    setActiveCategory(created.category);
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
                            <h3 className="text-app-2xl font-bold text-app-text">
                                {t('sidebar.name_dialog_title')}
                            </h3>
                            <p className="text-app-md text-app-text-muted mt-1">
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
                                className="w-full px-4 py-3 bg-app-surface2 border border-app-border rounded-xl text-app-2xl text-app-text font-bold outline-none focus:border-app-text/40 transition-colors"
                            />
                        </div>
                        <div className="px-5 pb-4 flex flex-col gap-3">
                            {!user && (
                                <p className="text-app-base text-app-text-muted text-center leading-relaxed">
                                    {t('new_plan.guest_hint_short')
                                        .split(/<\/?login>/)
                                        .map((part, i) =>
                                            i === 1 ? (
                                                <button
                                                    key="login"
                                                    onClick={() => setShowLoginModal(true)}
                                                    className="underline hover:text-app-text transition-colors cursor-pointer"
                                                >
                                                    {part}
                                                </button>
                                            ) : (
                                                <span key={i}>{part}</span>
                                            )
                                        )}
                                </p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelNewPlan}
                                    className="flex-1 py-2.5 rounded-xl border border-app-border text-app-lg font-bold text-app-text hover:bg-app-surface2 transition-colors cursor-pointer"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleConfirmNewPlan}
                                    disabled={!pendingPlanName.trim()}
                                    className={clsx(
                                        "flex-[2] py-2.5 rounded-xl text-app-lg font-bold transition-all cursor-pointer",
                                        pendingPlanName.trim()
                                            ? "bg-app-text text-app-bg hover:opacity-80 active:scale-[0.98]"
                                            : "bg-app-surface2 text-app-text-muted cursor-not-allowed"
                                    )}
                                >
                                    {t('sidebar.create_plan_button')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
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
                            <h2 className="text-app-xl font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
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
                            <p className="text-app-xl font-bold text-app-text text-center">
                                {t('sidebar.delete_confirm', { count: multiSelect.selectedIds.length })}
                            </p>
                            <p className="text-app-md text-app-text-muted text-center">
                                {t('sidebar.delete_warning')}
                            </p>
                        </div>

                        {/* フッター */}
                        <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex gap-4">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-app-md font-black text-app-text hover:bg-glass-hover transition-all cursor-pointer uppercase tracking-widest active:scale-95"
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
                                className="flex-[2] py-3.5 rounded-2xl text-app-md font-black bg-app-red text-white hover:bg-app-red-hover transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95"
                            >
                                {t('sidebar.delete')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </motion.aside>
            <BackupExportModal isOpen={backupExportOpen} onClose={() => setBackupExportOpen(false)} />
            <BackupRestoreModal isOpen={backupRestoreOpen} onClose={() => setBackupRestoreOpen(false)} />
    </>);
};
