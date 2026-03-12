import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/useTutorialStore';
import {
    CATEGORY_LABELS,
    getContentBySeries,
    getCategoriesByLevel,
    getSeriesByLevel,
} from '../data/contentRegistry';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';
import type { MultiSelectState } from '../types/sidebarTypes';
import type { ContentLanguage } from '../store/useThemeStore';
import { MOCK_RECENT_PLANS } from '../data/sidebarMockData';
import {
    Plus,
    ChevronRight,
    Layers,
    Sword,
    History,
    FileText,
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

    return (
        <button
            onClick={() => {
                if (multiSelect.isEnabled) {
                    if (!isDisabled) onToggleSelect(content.id);
                } else {
                    onSelect(content);
                }
            }}
            disabled={isDisabled}
            title={floorName}
            className={clsx(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 text-left group relative active:scale-[0.98] cursor-pointer",
                isActive && !multiSelect.isEnabled
                    ? "bg-app-accent-dim border border-app-border-accent/30 text-app-accent shadow-sm"
                    : "bg-transparent border border-transparent text-app-text-muted hover:bg-glass-hover hover:text-app-text",
                isDisabled && "opacity-40 cursor-not-allowed grayscale",
                highlightFirst && "ring-2 ring-app-accent ring-offset-2 ring-offset-transparent animate-pulse"
            )}
            data-tutorial-first-item={highlightFirst ? '' : undefined}
        >
            {/* Active Indicator Line */}
            {isActive && !multiSelect.isEnabled && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-app-accent rounded-full animate-in fade-in zoom-in duration-300" />
            )}

            {/* Multi-select Checkbox */}
            {multiSelect.isEnabled && (
                <div className="flex items-center justify-center shrink-0 transition-all duration-300 animate-in fade-in slide-in-from-left-2">
                    {isSelected ? (
                        <CheckSquare size={16} className="text-app-accent" />
                    ) : (
                        <Square size={16} className="text-app-text-muted/40 group-hover:text-app-text-muted" />
                    )}
                </div>
            )}

            {(() => {
                const [main, ...subs] = shortName.split('\n');
                return (
                    <div className="relative flex flex-col items-center shrink-0 w-6 h-6">
                        <div className={clsx(
                            "w-6 h-6 rounded flex items-center justify-center font-black text-[9px] shrink-0",
                            isActive && !multiSelect.isEnabled
                                ? "bg-app-accent/20 text-app-accent-bold"
                                : "bg-glass-card text-app-text-muted group-hover:bg-glass-hover group-hover:text-app-text"
                        )}>
                            {main}
                        </div>
                        {subs.length > 0 && (
                            <div className={clsx(
                                "absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[6px] font-bold leading-none whitespace-nowrap overflow-visible pointer-events-none drop-shadow-sm",
                                isActive && !multiSelect.isEnabled ? "text-app-accent-bold" : "text-app-text-muted/90"
                            )}>
                                {subs.join(' ')}
                            </div>
                        )}
                    </div>
                );
            })()}
            <div className={clsx(
                "flex-1 truncate text-[12px]",
                isActive && !multiSelect.isEnabled ? "font-bold" : "font-medium"
            )}>
                {floorName}
            </div>
            {isActive && !multiSelect.isEnabled && <ChevronRight size={14} className="text-app-accent/70 shrink-0" />}
        </button>
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
    const categoryLabel = CATEGORY_LABELS[category][lang as ContentLanguage] || CATEGORY_LABELS[category].ja;
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
                <Sword size={11} className={clsx(isExpanded ? "text-app-accent" : "text-app-accent/70")} />
                <span>{categoryLabel}</span>
            </button>

            {isExpanded && (
                <div className="ml-3 mt-1 space-y-0.5 border-l border-glass-border pl-2 animate-in fade-in slide-in-from-left-1 duration-200">
                    {seriesList.map(series => {
                        const floors = getContentBySeries(series.id);
                        const seriesName = series.name[lang as ContentLanguage] || series.name.ja;

                        return (
                            <div key={series.id} className="mb-2">
                                {seriesList.length > 1 && (
                                    <div className="text-[10px] text-app-text-secondary font-bold px-2 py-1 truncate flex items-center gap-1.5 group/series">
                                        <div className="w-1 h-1 rounded-full bg-app-accent-dim group-hover/series:bg-app-accent transition-colors" />
                                        {seriesName}
                                    </div>
                                )}
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
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// Main: Sidebar
// ─────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const { isActive: tutorialActive, currentStepIndex } = useTutorialStore();
    const lang = contentLanguage;

    const [activeLevel, setActiveLevel] = useState<ContentLevel>(100);
    const [activeCategory, setActiveCategory] = useState<ContentCategory | 'all'>('all');
    const [selectedContentId, setSelectedContentId] = useState<string | null>(null);

    // Multi-select state
    const [multiSelect, setMultiSelect] = useState<MultiSelectState>({
        isEnabled: false,
        selectedIds: []
    });

    const handleSelectContent = (content: ContentDefinition) => {
        setSelectedContentId(content.id);
        useTutorialStore.getState().completeEvent('timeline:events-loaded');
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

    // Filter categories based on level
    const availableCategories = useMemo(() => getCategoriesByLevel(activeLevel), [activeLevel]);

    // Ensure active category is valid for new level
    useMemo(() => {
        if (activeCategory !== 'all' && !availableCategories.includes(activeCategory)) {
            setActiveCategory('all');
        }
    }, [availableCategories, activeCategory]);

    // Tutorial checks
    const isTutorialContentSelect = tutorialActive && TUTORIAL_STEPS[currentStepIndex]?.id === 'content-select';

    return (
        <aside
            className={clsx(
                "h-full bg-glass-header backdrop-blur-3xl border-r border-glass-border flex flex-col transition-all duration-300 overflow-hidden z-40 relative",
                isOpen ? "w-64" : "w-0 border-r-0"
            )}
        >
            <div className="w-64 flex flex-col h-full overflow-hidden">

                {/* [A] 新規作成セクション */}
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

                {/* [B] 最近のアクティビティ (Recent Activity) */}
                {!multiSelect.isEnabled && (
                    <div className="px-3 pb-3 shrink-0">
                        <div className="flex items-center gap-1.5 mb-2 px-1">
                            <History size={11} className="text-app-text-secondary" />
                            <span className="text-[10px] font-black text-app-text-secondary uppercase tracking-tighter">
                                {t('sidebar.recent_activity')}
                            </span>
                        </div>
                        <div className="space-y-1">
                            {MOCK_RECENT_PLANS.map(plan => (
                                <button
                                    key={plan.id}
                                    className="w-full flex items-center gap-2 group p-1.5 rounded-lg hover:bg-glass-active text-left cursor-pointer transition-colors"
                                >
                                    <div className="p-1.5 rounded bg-glass-card border border-glass-border group-hover:border-app-accent/40 shadow-sm transition-all">
                                        <FileText size={12} className="text-app-text-secondary group-hover:text-app-accent" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black text-app-text truncate">
                                            {plan.contentName[lang as ContentLanguage] || plan.contentName.ja}
                                        </p>
                                        <p className="text-[9px] text-app-text-secondary font-medium truncate">
                                            {plan.planName}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* [C] エクスプローラー領域 */}
                <div className="px-3 flex items-center justify-between mb-2 shrink-0">
                    <div className="flex items-center gap-1.5 px-1">
                        <Layers size={11} className="text-app-text-secondary" />
                        <span className="text-[10px] font-black text-app-text-secondary uppercase tracking-tighter">
                            EXPLORER
                        </span>
                    </div>

                    {/* Multi-Select Toggle */}
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

                {/* 1. フィルター領域 (2段水平タブ) */}
                <div className="px-3 space-y-2 shrink-0 mb-3">
                    {/* 上段（レベル） */}
                    <div className="flex gap-1 bg-glass-card/80 rounded-lg p-0.5 border border-glass-border shadow-sm">
                        {LEVEL_TIERS.map(level => (
                            <button
                                key={level}
                                onClick={() => setActiveLevel(level)}
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

                    {/* 下段（カテゴリ） */}
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

                {/* 2. コンテンツツリー */}
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

                {/* [3] フローティング・アクションバー (Multi-select) */}
                {multiSelect.isEnabled && (
                    <div className="absolute bottom-4 left-3 right-3 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-glass-header backdrop-blur-xl border border-app-accent/30 rounded-2xl shadow-2xl p-3 flex items-center justify-between gap-3 overflow-hidden group">
                            {/* Decorative background pulse */}
                            <div className="absolute inset-0 bg-app-accent/5 animate-pulse" />

                            <div className="relative flex flex-col">
                                <span className="text-[10px] font-bold text-app-accent">
                                    {t('sidebar.selected_count', { count: multiSelect.selectedIds.length })}
                                </span>
                                {multiSelect.selectedIds.length >= 10 && (
                                    <span className="text-[8px] text-app-accent-bold/80 font-medium whitespace-nowrap">
                                        {t('sidebar.limit_reached_warning')}
                                    </span>
                                )}
                            </div>

                            <div className="relative flex items-center gap-2">
                                <button
                                    onClick={toggleMultiSelectMode}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-app-text-muted hover:text-app-text  cursor-pointer"
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
        </aside>
    );
};
