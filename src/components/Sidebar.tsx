import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from '../data/contentRegistry';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';
import type { MultiSelectState } from '../types/sidebarTypes';
import type { ContentLanguage } from '../store/useThemeStore';
import { MOCK_RECENT_PLANS } from '../data/sidebarMockData';
import {
    Plus,
    ChevronLeft,
    ChevronRight,
    CheckSquare,
    Square,
    Link
} from 'lucide-react';
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
    onSelect: (content: ContentDefinition) => void;
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

    // 軽減プランのリスト（将来的に Store から取得する形へ移行可能）
    const plans = [{ id: content.id, name: floorName }];

    return (
        <div className="w-full flex flex-col">
            {plans.map((plan, index) => {
                const isFirst = index === 0;
                const isPlanActive = isActive && isFirst;

                return (
                    <button
                        key={plan.id}
                        onClick={() => {
                            if (multiSelect.isEnabled) {
                                if (!isDisabled && isFirst) onToggleSelect(content.id);
                            } else {
                                onSelect(content);
                            }
                        }}
                        disabled={isDisabled}
                        title={plan.name}
                        {...(highlightFirst && isFirst ? { "data-tutorial-first-item": "true" } : {})}
                        className={clsx(
                            "w-full flex items-center gap-2.5 px-2.5 py-1 rounded-lg transition-all duration-200 text-left group relative active:scale-[0.98] cursor-pointer min-h-[32px]",
                            isPlanActive && !multiSelect.isEnabled
                                ? "bg-app-accent-dim border border-app-border-accent/30 text-app-accent shadow-sm"
                                : "bg-transparent border border-transparent text-app-text-muted hover:bg-glass-hover hover:text-app-text",
                            isDisabled && "opacity-40 cursor-not-allowed grayscale"
                        )}
                    >
                        {isPlanActive && !multiSelect.isEnabled && (
                            <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-app-accent rounded-full animate-in fade-in zoom-in duration-300" />
                        )}

                        <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                            {isFirst ? (
                                (() => {
                                    const [main, ...subs] = shortName.split('\n');
                                    const isFloorActive = isActive && !multiSelect.isEnabled;
                                    return (
                                        <div className="relative flex flex-col items-center shrink-0 w-6 h-6">
                                            <div className={clsx(
                                                "w-6 h-6 rounded flex items-center justify-center font-black text-[9px] shrink-0",
                                                isFloorActive 
                                                    ? "bg-app-accent/20 text-app-accent-bold"
                                                    : "bg-glass-card text-app-text-muted group-hover:bg-glass-hover group-hover:text-app-text"
                                            )}>
                                                {main}
                                            </div>
                                            {subs.length > 0 && (
                                                <div className={clsx(
                                                    "absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[6px] font-bold leading-none whitespace-nowrap overflow-visible pointer-events-none drop-shadow-sm",
                                                    isFloorActive ? "text-app-accent-bold" : "text-app-text-muted/90"
                                                )}>
                                                    {subs.join(' ')}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            ) : null}
                        </div>

                        {isFirst && multiSelect.isEnabled && (
                            <div className="flex items-center justify-center shrink-0 transition-all duration-300 animate-in fade-in slide-in-from-left-2 self-center">
                                {isSelected ? (
                                    <CheckSquare size={16} className="text-app-accent" />
                                ) : (
                                    <Square size={16} className="text-app-text-muted/40 group-hover:text-app-text-muted" />
                                )}
                            </div>
                        )}

                        <div className={clsx(
                            "flex-1 min-w-0 flex flex-col justify-center",
                            isPlanActive && !multiSelect.isEnabled ? "font-bold" : "font-medium"
                        )}>
                            <div className={clsx(
                                "truncate leading-tight text-[9px]",
                                isPlanActive && !multiSelect.isEnabled ? "text-app-accent-bold" : "text-inherit"
                            )}>
                                {plan.name}
                            </div>
                        </div>

                        {isPlanActive && !multiSelect.isEnabled && <ChevronRight size={14} className="text-app-accent/70 shrink-0 self-center" />}
                    </button>
                );
            })}
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
    onSelectContent: (content: ContentDefinition) => void;
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
                className="w-full text-[10px] text-app-text-secondary font-bold px-2 py-1.5 truncate flex items-center gap-1.5 group/series hover:bg-glass-hover rounded-md transition-colors cursor-pointer"
            >
                <div className="transition-transform duration-200 shrink-0" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    <ChevronRight size={10} className="text-app-text-muted" />
                </div>
                <span className={clsx("flex-1 text-left truncate", isExpanded ? "text-app-text" : "text-app-text-secondary")}>
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
    onSelectContent: (content: ContentDefinition) => void;
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
                    isExpanded ? "bg-glass-active text-app-text" : "text-app-text-secondary hover:text-app-text hover:bg-glass-hover",
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

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onClose }) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const { isActive: tutorialActive, currentStepIndex } = useTutorialStore();
    const lang = contentLanguage;

    const [activeLevel, setActiveLevel] = useState<ContentLevel>(100);
    const [activeCategory, setActiveCategory] = useState<ContentCategory | 'all'>('all');
    const [selectedContentId, setSelectedContentId] = useState<string | null>(null);

    const [multiSelect, setMultiSelect] = useState<MultiSelectState>({
        isEnabled: false,
        selectedIds: []
    });

    const handleSelectContent = (content: ContentDefinition) => {
        setSelectedContentId(content.id);
        const store = useMitigationStore.getState();
        store.setCurrentLevel(content.level);
        store.applyDefaultStats(content.level, content.patch);
        setActiveLevel(content.level);
        useTutorialStore.getState().completeEvent('timeline:events-loaded');
        if (tutorialActive) {
            useTutorialStore.getState().completeEvent('sidebar:content-selected');
        }
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
            animate={{ width: isOpen ? 300 : 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full bg-glass-header backdrop-blur-3xl flex z-40 relative group/sidebar shadow-2xl"
        >
            {/* [1] サイドバー本体 (コンテンツエリア) */}
            <motion.div 
                animate={{ width: isOpen ? 276 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="h-full flex flex-col overflow-hidden"
            >
                {/* ... existing content ... */}
                <div className="w-[276px] flex flex-col h-full overflow-hidden">
                    <div className="p-3 border-b border-glass-border shrink-0">
                        <button
                            onClick={() => useTutorialStore.getState().completeEvent('sidebar:new-plan-clicked')}
                            className={clsx(
                                "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer",
                                "bg-app-accent/15 text-app-accent border border-app-accent/20",
                                "hover:bg-app-accent/25 hover:border-app-accent/40 active:scale-[0.97]",
                                "tutorial-create-btn"
                            )}
                            data-tutorial="new-plan"
                        >
                            <Plus size={16} />
                            {t('sidebar.new_plan')}
                        </button>
                    </div>

                    {!multiSelect.isEnabled && (
                        <div className="px-3 pb-3 shrink-0 mt-3">
                            <div className="flex items-center mb-2 px-1">
                                <span className="text-[10px] font-black text-app-text-secondary uppercase tracking-tighter">
                                    {t('sidebar.recent_activity')}
                                </span>
                            </div>
                            <div className="space-y-1">
                                {MOCK_RECENT_PLANS.slice(0, 3).map((plan) => (
                                    <button
                                        key={plan.id}
                                        className="w-full flex items-center gap-2 group py-1 px-1.5 rounded-lg hover:bg-glass-active text-left cursor-pointer transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-[9.5px] font-black text-app-text truncate leading-tight">
                                                {plan.contentName[lang as ContentLanguage] || plan.contentName.ja}
                                            </p>
                                            <p className="text-[8px] text-app-text-secondary font-medium truncate leading-tight mt-0.5">
                                                {plan.planName}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="px-3 flex items-center justify-between mb-2 shrink-0">
                        <div className="flex items-center px-1">
                            <span className="text-[10px] font-black text-app-text-secondary uppercase tracking-tighter">
                                EXPLORER
                            </span>
                        </div>
                        <button
                            onClick={toggleMultiSelectMode}
                            className={clsx(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black transition-all border cursor-pointer",
                                multiSelect.isEnabled
                                    ? "bg-app-accent text-app-text-on-accent border-white/20 shadow-md"
                                    : "bg-glass-card text-app-text-secondary border-glass-border hover:bg-glass-hover hover:text-app-text shadow-sm"
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
                                            ? "bg-app-accent text-app-text-on-accent shadow-lg scale-[1.02] z-10"
                                            : "text-app-text-secondary hover:text-app-text hover:bg-glass-hover"
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
                                        ? "bg-app-accent text-app-text-on-accent border-app-accent shadow-md"
                                        : "bg-glass-card text-app-text-secondary border-glass-border hover:border-glass-hover hover:text-app-text"
                                )}
                            >
                                ALL
                            </button>
                            {availableCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={clsx(
                                        "whitespace-nowrap px-3 py-1.5 rounded-full text-[9px] font-black transition-all border cursor-pointer",
                                        activeCategory === cat
                                            ? "bg-app-accent text-app-text-on-accent border-app-accent shadow-md"
                                            : "bg-glass-card text-app-text-secondary border-glass-border hover:border-glass-hover hover:text-app-text"
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
                            <div className="bg-glass-header backdrop-blur-xl border border-app-accent/30 rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-3 overflow-hidden group">
                                <div className="absolute inset-0 bg-app-accent/5 animate-pulse" />
                                <div className="relative flex flex-col">
                                    <span className="text-[10px] font-bold text-app-accent">
                                        {t('sidebar.selected_count', { count: multiSelect.selectedIds.length })}
                                    </span>
                                </div>
                                <div className="relative flex items-center gap-2">
                                    <button
                                        onClick={toggleMultiSelectMode}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-app-text-muted hover:text-app-text cursor-pointer"
                                    >
                                        {t('sidebar.cancel')}
                                    </button>
                                    <button
                                        disabled={multiSelect.selectedIds.length === 0}
                                        className={clsx(
                                            "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all shadow-md cursor-pointer",
                                            multiSelect.selectedIds.length > 0
                                                ? "bg-app-accent text-app-text-on-accent hover:brightness-110 active:scale-95"
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
                <div 
                    className="absolute inset-y-0 -left-10 w-[120px] pointer-events-auto cursor-pointer" 
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
                    <button
                        onClick={() => onToggle?.()}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        className={clsx(
                            "relative w-full h-full cursor-pointer overflow-hidden group/btn",
                            "hover:bg-app-accent/[0.12] active:bg-app-accent/[0.2] transition-colors duration-200"
                        )}
                        title={isOpen ? "メニューを閉じる" : "メニューを開く"}
                    >
                        {/* 迫り出し感のある背景 */}
                        <motion.div 
                            className={clsx(
                                "absolute inset-0 bg-gradient-to-r from-transparent via-app-accent/[0.08] to-transparent",
                                isOpen ? "opacity-0" : "opacity-10"
                            )}
                            animate={{ opacity: isNear ? 0.3 : 0.1 }}
                            transition={{ duration: 0.15 }}
                        />

                        {/* 左端の固定ライン */}
                        <div className="absolute inset-y-0 left-0 w-[1px] bg-app-accent/40 group-hover/btn:bg-app-accent/70 transition-colors duration-200" />

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
                                            ? "text-app-text-muted group-hover/btn:text-app-accent" 
                                            : "text-app-accent drop-shadow-[0_0_12px_rgba(var(--app-accent-rgb),0.5)]",
                                        isHovered && "drop-shadow-[0_0_8px_rgba(var(--app-accent-rgb),0.6)]"
                                    )}
                                />
                            </motion.div>
                        </div>

                        {/* 右端の境界線 (拡張に合わせて移動) */}
                        <div className={clsx(
                            "absolute right-0 top-0 bottom-0 w-[1px] transition-all duration-200",
                            isOpen ? "bg-glass-border" : "bg-app-accent/30 shadow-[0_0_10px_rgba(var(--app-accent-rgb),0.3)]"
                        )} />
                    </button>
                </motion.div>
            </div>
        </motion.aside>
    );
};
