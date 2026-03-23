import React, { useState, useMemo } from 'react';
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
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';
import { Tooltip } from './ui/Tooltip';
import type { MultiSelectState } from '../types/sidebarTypes';
import type { ContentLanguage } from '../store/useThemeStore';
import { usePlanStore } from '../store/usePlanStore';
import { NewPlanModal } from './NewPlanModal';
import { getTemplate } from '../data/templateLoader';
import {
    Plus,
    ChevronLeft,
    ChevronRight,
    CheckSquare,
    Square,
    Link
} from 'lucide-react';
// Plus は新規作成ボタンで使用
import clsx from 'clsx';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface SidebarProps {
    isOpen: boolean;
    onToggle?: () => void;
    onClose?: () => void;
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

const ContentTreeItem: React.FC<ContentTreeItemProps> = ({
    content, isActive, multiSelect, onToggleSelect, onSelect, highlightFirst, lang
}) => {
    const isSelected = multiSelect.selectedIds.includes(content.id);
    const isDisabled = multiSelect.isEnabled && !isSelected && multiSelect.selectedIds.length >= 10;

    const floorName = content.name[lang as ContentLanguage] || content.name.ja;
    const shortName = content.shortName[lang as ContentLanguage] || content.shortName.ja;

    const { plans, currentPlanId, updatePlan } = usePlanStore();
    const contentPlans = plans.filter(p => p.contentId === content.id);

    // プラン名インライン編集
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
            updatePlan(editingPlanId, { title: editingTitle.trim() });
        }
        setEditingPlanId(null);
    };

    return (
        <div className="w-full flex flex-col">
            {/* コンテンツ名行 */}
            <div className="w-full flex items-center group/content">
                <Tooltip content={floorName} position="right" wrapperClassName="flex-1 min-w-0">
                <button
                    onClick={() => {
                        if (multiSelect.isEnabled) {
                            if (!isDisabled) onToggleSelect(content.id);
                        } else {
                            onSelect(content);
                        }
                    }}
                    disabled={isDisabled}
                    {...(highlightFirst ? { "data-tutorial-first-item": "true" } : {})}
                    className={clsx(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 text-left group relative cursor-pointer min-h-[32px]",
                        isActive && !multiSelect.isEnabled
                            ? "bg-app-text/10 border border-app-text/20 text-app-text shadow-sm"
                            : "bg-transparent border border-transparent text-app-text hover:bg-glass-hover",
                        isDisabled && "opacity-40 cursor-not-allowed grayscale"
                    )}
                >
                    {isActive && !multiSelect.isEnabled && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-app-text rounded-full animate-in fade-in zoom-in duration-300" />
                    )}

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
                            {isSelected ? (
                                <CheckSquare size={16} className="text-app-text" />
                            ) : (
                                <Square size={16} className="text-app-text-muted/40 group-hover:text-app-text-muted" />
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

                {/* ホバーで表示される「+」ボタン（同コンテンツの新プラン作成） */}
                {isActive && !multiSelect.isEnabled && (
                    <Tooltip content={lang === 'en' ? 'New plan' : '新しい軽減表'} position="right">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(content, true);
                            }}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-all opacity-0 group-hover/content:opacity-100 shrink-0 cursor-pointer mr-1"
                        >
                            <Plus size={12} />
                        </button>
                    </Tooltip>
                )}
            </div>

            {/* サブアイテム: 保存済みプラン一覧（2件以上のとき表示） */}
            {isActive && !multiSelect.isEnabled && contentPlans.length > 1 && (
                <div className="pl-9 pr-2 py-1 flex flex-col gap-0.5 border-l-2 border-app-text/15 ml-3.5 mt-1 mb-2">
                    {contentPlans.map(plan => (
                        <div key={plan.id} className="flex items-center gap-1">
                            {editingPlanId === plan.id ? (
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
                                <button
                                    onClick={() => {
                                        const store = usePlanStore.getState();
                                        const snap = useMitigationStore.getState().getSnapshot();
                                        if (store.currentPlanId) {
                                            store.updatePlan(store.currentPlanId, { data: snap });
                                        }
                                        useMitigationStore.getState().loadSnapshot(plan.data);
                                        store.setCurrentPlanId(plan.id);
                                    }}
                                    onDoubleClick={(e) => startEditing(plan.id, plan.title, e)}
                                    className={clsx(
                                        "flex-1 text-left text-[10px] py-1 px-2 rounded-md transition-colors font-medium truncate flex items-center gap-2",
                                        currentPlanId === plan.id
                                            ? "bg-app-text/10 text-app-text font-bold"
                                            : "text-app-text hover:bg-glass-hover"
                                    )}
                                >
                                    <span className={clsx("w-1 h-1 rounded-full shrink-0", currentPlanId === plan.id ? "bg-app-text" : "bg-app-text-muted/40")} />
                                    {plan.title}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

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
}

const SeriesAccordion: React.FC<SeriesAccordionProps> = ({
    series, floors, selectedContentId, multiSelect, onToggleSelect, onSelectContent, lang, highlightFirst, showLabel
}) => {
    const hasActiveFloor = React.useMemo(() => floors.some(f => f.id === selectedContentId), [floors, selectedContentId]);
    const [isExpanded, setIsExpanded] = React.useState(true);

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
                className="w-full text-[10px] text-app-text font-bold px-2 py-1.5 truncate flex items-center gap-1.5 group/series hover:bg-glass-hover rounded-md transition-colors cursor-pointer"
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
}

const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
    level, category, selectedContentId, multiSelect, onToggleSelect, onSelectContent, highlightFirst, lang
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
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
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left cursor-pointer transition-colors duration-200",
                    isExpanded ? "bg-glass-active text-app-text" : "text-app-text hover:bg-glass-hover",
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
                    {seriesList.map(series => (
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
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// Main: Sidebar
// ─────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const { isActive: tutorialActive, currentStepIndex } = useTutorialStore();
    const lang = contentLanguage;

    const [activeLevel, setActiveLevel] = useState<ContentLevel>(100);
    const [activeCategory, setActiveCategory] = useState<ContentCategory | 'all'>('all');
    const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
    const [isNewPlanModalOpen, setIsNewPlanModalOpen] = useState(false);
    const [multiSelect, setMultiSelect] = useState<MultiSelectState>({
        isEnabled: false,
        selectedIds: []
    });

    const { plans, currentPlanId, setCurrentPlanId, updatePlan } = usePlanStore();
    const { getSnapshot, loadSnapshot } = useMitigationStore();

    const handleSelectContent = async (content: ContentDefinition, forceNew?: boolean) => {
        setSelectedContentId(content.id);
        const store = useMitigationStore.getState();
        const planStore = usePlanStore.getState();

        // 現在のプランを保存してから切り替え
        if (currentPlanId) {
            planStore.updatePlan(currentPlanId, { data: store.getSnapshot() });
        }

        // 既にこのコンテンツのプランがある場合は最新のものを開く（forceNewでない場合）
        const existingPlan = !forceNew && planStore.plans.find(p => p.contentId === content.id);
        if (existingPlan) {
            store.loadSnapshot(existingPlan.data);
            planStore.setCurrentPlanId(existingPlan.id);
            setActiveLevel(existingPlan.data.currentLevel as ContentLevel);
            return;
        }

        store.setCurrentLevel(content.level);
        store.applyDefaultStats(content.level, content.patch);
        setActiveLevel(content.level);

        const contentName = content.name[lang as ContentLanguage] || content.name.ja;

        // テンプレートを裏で読み込み → 自動でプランとして保存
        const tpl = await getTemplate(content.id);
        if (tpl) {
            const snap = store.getSnapshot();
            store.loadSnapshot({
                ...snap,
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

            // 自動でプランとして保存（テンプレートという概念をユーザーに見せない）
            const newPlanId = `plan_${Date.now()}`;
            planStore.addPlan({
                id: newPlanId,
                ownerId: 'local',
                ownerDisplayName: 'Guest',
                contentId: content.id,
                title: contentName,
                isPublic: false,
                copyCount: 0,
                useCount: 0,
                data: store.getSnapshot(),
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            planStore.setCurrentPlanId(newPlanId);
        } else {
            // テンプレートなし → 空のプランを作成して即開始
            store.loadSnapshot({
                ...store.getSnapshot(),
                timelineEvents: [],
                timelineMitigations: [],
                phases: []
            });
            const newPlanId = `plan_${Date.now()}`;
            planStore.addPlan({
                id: newPlanId,
                ownerId: 'local',
                ownerDisplayName: 'Guest',
                contentId: content.id,
                title: contentName,
                isPublic: false,
                copyCount: 0,
                useCount: 0,
                data: store.getSnapshot(),
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            planStore.setCurrentPlanId(newPlanId);
        }
        useTutorialStore.getState().completeEvent('sidebar:new-plan-clicked');
    };

    const handleLoadPlan = (planId: string) => {
        const plan = usePlanStore.getState().getPlan(planId);
        if (!plan) return;

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
    };

    const toggleMultiSelectMode = () => {
        setMultiSelect(prev => ({
            isEnabled: !prev.isEnabled,
            selectedIds: []
        }));
    };

    const toggleItemId = (id: string) => {
        setMultiSelect(prev => {
            const isSelected = prev.selectedIds.includes(id);
            if (isSelected) {
                return { ...prev, selectedIds: prev.selectedIds.filter(i => i !== id) };
            } else if (prev.selectedIds.length < 10) {
                return { ...prev, selectedIds: [...prev.selectedIds, id] };
            }
            return prev;
        });
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

    return (
        <motion.aside
            initial={false}
            animate={{ width: isOpen ? (isNear ? 312 : 300) : (isNear ? 36 : 24) }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full bg-transparent flex z-40 relative group/sidebar shadow-sm"
        >
            {/* [1] サイドバー本体 (コンテンツエリア) */}
            <motion.div
                animate={{ width: isOpen ? 276 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="h-full flex flex-col overflow-hidden"
            >
                <div className="w-[276px] flex flex-col h-full overflow-hidden">
                    {/* Header Controls area with save button instead of big new plan */}
                    <div className="p-2 border-b border-glass-border" />

                    {!multiSelect.isEnabled && (
                        <div className="px-3 pb-3 shrink-0 mt-3">
                            <div className="flex items-center mb-2 px-1">
                                <span className="text-[10px] font-black text-app-text uppercase tracking-tighter">
                                    {t('sidebar.recent_activity')}
                                </span>
                            </div>
                            <div className="space-y-1">
                                {plans.slice(0, 5).map((plan) => (
                                    <button
                                        key={plan.id}
                                        onClick={() => handleLoadPlan(plan.id)}
                                        className={clsx(
                                            "w-full flex items-center gap-2 group py-1.5 px-2 rounded-lg transition-colors border",
                                            currentPlanId === plan.id
                                                ? "bg-app-text/10 border-app-text/20"
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
                                            <p className="text-[8px] text-app-text-secondary font-medium truncate leading-tight mt-0.5">
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

                    <div className="px-3 flex items-center justify-between mb-2 shrink-0">
                        <button
                            onClick={() => {
                                setIsNewPlanModalOpen(true);
                                useTutorialStore.getState().completeEvent('sidebar:new-plan-clicked');
                            }}
                            data-tutorial="new-plan"
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black transition-all border cursor-pointer bg-glass-card text-app-text border-glass-border hover:bg-glass-hover shadow-sm"
                        >
                            <Plus size={10} />
                            {t('sidebar.new_plan').toUpperCase()}
                        </button>
                        <button
                            onClick={toggleMultiSelectMode}
                            className={clsx(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black transition-all border cursor-pointer",
                                multiSelect.isEnabled
                                    ? "bg-app-text text-app-bg border-app-text shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-glass-hover shadow-sm"
                            )}
                        >
                            {multiSelect.isEnabled ? <CheckSquare size={10} /> : <Square size={10} />}
                            {t('sidebar.multi_select_mode').toUpperCase()}
                        </button>
                    </div>

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
                                        "flex-1 py-1.5 rounded-md text-[10px] font-black transition-all duration-200 cursor-pointer",
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
                                    "whitespace-nowrap px-3 py-1.5 rounded-full text-[9px] font-black transition-all border cursor-pointer",
                                    activeCategory === 'all'
                                        ? "bg-app-text text-app-bg border-app-text shadow-md"
                                        : "bg-glass-card text-app-text border-glass-border hover:border-glass-hover"
                                )}
                            >
                                {t('ui.all').toUpperCase()}
                            </button>
                            {availableCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={clsx(
                                        "whitespace-nowrap px-3 py-1.5 rounded-full text-[9px] font-black transition-all border cursor-pointer",
                                        activeCategory === cat
                                            ? "bg-app-text text-app-bg border-app-text shadow-md"
                                            : "bg-glass-card text-app-text border-glass-border hover:border-glass-hover"
                                    )}
                                >
                                    {(CATEGORY_LABELS[cat][lang as ContentLanguage] || CATEGORY_LABELS[cat].ja).toUpperCase()}
                                </button>
                            ))}
                        </div>
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
                                />
                            ))}

                    </div>

                    {multiSelect.isEnabled && (
                        <div className="absolute bottom-4 left-3 right-3 animate-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-app-bg border border-app-text/20 rounded-2xl shadow-sm p-3 flex items-center justify-between gap-3 overflow-hidden group">
                                <div className="absolute inset-0 bg-app-text/5 animate-pulse" />
                                <div className="relative flex flex-col">
                                    <span className="text-[10px] font-bold text-app-text">
                                        {t('sidebar.selected_count', { count: multiSelect.selectedIds.length })}
                                    </span>
                                </div>
                                <div className="relative flex items-center gap-2">
                                    <button
                                        onClick={toggleMultiSelectMode}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-app-text cursor-pointer"
                                    >
                                        {t('sidebar.cancel')}
                                    </button>
                                    <button
                                        disabled={multiSelect.selectedIds.length === 0}
                                        className={clsx(
                                            "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all shadow-md cursor-pointer",
                                            multiSelect.selectedIds.length > 0
                                                ? "bg-app-text text-app-bg hover:opacity-80 active:scale-95"
                                                : "bg-glass-card text-app-text-muted border border-glass-border grayscale opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <Link size={14} />
                                        <span>{t('sidebar.share_together')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* [2] ── 近接センサー付き・究極の常設ハンドル領域 ── */}
            <div
                className="h-full w-6 z-50 flex items-center justify-center shrink-0 shadow-[inset_1px_0_0_0_rgba(255,255,255,0.05)] relative"
                onMouseEnter={() => setIsNear(true)}
                onMouseLeave={() => setIsNear(false)}
            >
                {/* 近接センサー領域 (透明) — ハンドルよりも広い反応範囲 */}
                {/* ── 修正: ヘッダー2段分(上段48px+下段48px=96px)に干渉しないよう上端をずらす ── */}
                <div
                    className="absolute top-24 bottom-0 -left-10 w-[120px] pointer-events-auto cursor-pointer"
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

                        {/* 左端の固定ライン */}
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
            </div>
            <NewPlanModal isOpen={isNewPlanModalOpen} onClose={() => setIsNewPlanModalOpen(false)} />
        </motion.aside>
    );
};
