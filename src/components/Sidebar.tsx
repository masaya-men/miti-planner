import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useTutorialStore, TUTORIAL_STEPS } from '../store/useTutorialStore';
import {
    CATEGORY_LABELS,
    LEVEL_LABELS,
    getContentBySeries,
    getCategoriesByLevel,
    getSeriesByLevel,
} from '../data/contentRegistry';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';
import { Plus, ChevronDown, ChevronRight, Layers, Sword, Hash } from 'lucide-react';
import clsx from 'clsx';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface SidebarProps {
    isOpen: boolean;
}

// ─────────────────────────────────────────────
// Available level tiers (descending = newest first)
// ─────────────────────────────────────────────

const LEVEL_TIERS: ContentLevel[] = [100, 90, 80, 70];

// ─────────────────────────────────────────────
// Sub-component: CategoryAccordion
// Renders an expandable category section with series + floor items.
// ─────────────────────────────────────────────

interface CategoryAccordionProps {
    level: ContentLevel;
    category: ContentCategory;
    selectedContentId: string | null;
    onSelectContent: (content: ContentDefinition) => void;
    highlightFirst?: boolean;  // Tutorial: glow first item
}

const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
    level, category, selectedContentId, onSelectContent, highlightFirst,
}) => {
    const [isExpanded, setIsExpanded] = useState(category === 'savage');
    const { contentLanguage } = useThemeStore();
    const lang = contentLanguage ?? 'ja';
    const categoryLabel = CATEGORY_LABELS[category][lang] || CATEGORY_LABELS[category].ja;

    // Get all series in this category + level
    const seriesList = getSeriesByLevel(level).filter(s => s.category === category);

    if (seriesList.length === 0) return null;

    return (
        <div className="mb-1">
            {/* Category Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={clsx(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer",
                    "text-app-text-muted hover:text-app-text hover:bg-glass-hover",
                    "font-bold text-[10px] tracking-widest uppercase"
                )}
            >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Sword size={11} className="text-app-accent/70" />
                <span>{categoryLabel}</span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="ml-4 space-y-0.5">
                    {seriesList.map(series => {
                        const floors = getContentBySeries(series.id);
                        const seriesName = series.name[lang] || series.name.ja;

                        return (
                            <div key={series.id}>
                                {/* Series label (only if more than 1 series in this category) */}
                                {seriesList.length > 1 && (
                                    <div className="text-[10px] text-app-text-muted/60 font-medium px-2 pt-1.5 pb-0.5 truncate">
                                        {seriesName}
                                    </div>
                                )}

                                {/* Floor buttons */}
                                {floors.map(floor => {
                                    const isActive = floor.id === selectedContentId;
                                    const shortName = floor.shortName[lang] || floor.shortName.ja;
                                    const floorName = floor.name[lang] || floor.name.ja;

                                    return (
                                        <button
                                            key={floor.id}
                                            data-tutorial-first-item={highlightFirst && floor.id === floors[0]?.id ? '' : undefined}
                                            onClick={() => {
                                                if (highlightFirst && floor.id !== floors[0]?.id) return;
                                                onSelectContent(floor);
                                            }}
                                            className={clsx(
                                                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 text-left group relative overflow-hidden active:scale-[0.98] cursor-pointer",
                                                isActive
                                                    ? "bg-app-accent-dim border border-app-border-accent text-app-accent shadow-[inset_0_1px_0_var(--color-border-accent)]"
                                                    : "bg-transparent border border-transparent text-app-text-muted hover:bg-glass-hover hover:text-app-text",
                                                // Tutorial: glow first item
                                                highlightFirst && floor.id === floors[0]?.id
                                            )}
                                        >
                                            <div className={clsx(
                                                "w-6 h-6 rounded flex items-center justify-center font-black text-[10px] transition-colors shrink-0",
                                                isActive
                                                    ? "bg-app-accent-dim text-app-accent-bold"
                                                    : "bg-glass-card text-app-text-muted group-hover:bg-glass-hover group-hover:text-app-text"
                                            )}>
                                                {shortName}
                                            </div>
                                            <div className="flex-1 truncate text-[12px] font-medium">
                                                {floorName}
                                            </div>
                                            {isActive && <ChevronRight size={14} className="text-app-accent/70 shrink-0" />}
                                        </button>
                                    );
                                })}
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
    const lang = contentLanguage ?? 'ja';

    // Currently selected level tier tab
    const [activeLevel, setActiveLevel] = useState<ContentLevel>(100);

    // Currently selected content (persisted elsewhere in the future)
    const [selectedContentId, setSelectedContentId] = useState<string | null>(null);

    // Handle content selection
    const handleSelectContent = (content: ContentDefinition) => {
        setSelectedContentId(content.id);
        // Tutorial: notify content was selected
        useTutorialStore.getState().completeEvent('timeline:events-loaded');
        // TODO: In the future, this will trigger loading the content's timeline data
    };

    // Get categories available for the active level
    const categories = getCategoriesByLevel(activeLevel);

    // Tutorial: check if we should highlight the first content item
    const isTutorialContentSelect = tutorialActive
        && TUTORIAL_STEPS[currentStepIndex]?.id === 'content-select';

    return (
        <aside
            className={clsx(
                "h-full bg-glass-header backdrop-blur-xl border-r border-glass-border flex flex-col transition-all duration-300 overflow-hidden z-40 relative",
                isOpen ? "w-64" : "w-0 border-r-0"
            )}
        >
            <div className="w-64 flex flex-col h-full">

                {/* ── New Plan Button ── */}
                <div className="p-3 border-b border-glass-border shrink-0">
                    <button
                        onClick={() => {
                            // Tutorial: notify sidebar new plan clicked
                            useTutorialStore.getState().completeEvent('sidebar:new-plan-clicked');
                            // TODO: Open content selection dialog
                        }}
                        className={clsx(
                            "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer",
                            "bg-app-accent/15 text-app-accent border border-app-accent/20",
                            "hover:bg-app-accent/25 hover:border-app-accent/40 active:scale-[0.97]"
                        )}
                        data-tutorial="new-plan"
                    >
                        <Plus size={16} />
                        {t('sidebar.new_plan')}
                    </button>
                </div>

                {/* ── Level Tier Tabs ── */}
                <div className="px-3 pt-3 pb-1 shrink-0">
                    <div className="flex gap-1 bg-glass-card rounded-lg p-0.5 border border-glass-border">
                        {LEVEL_TIERS.map(level => (
                            <button
                                key={level}
                                onClick={() => setActiveLevel(level)}
                                className={clsx(
                                    "flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all duration-200 cursor-pointer",
                                    activeLevel === level
                                        ? "bg-app-accent/20 text-app-accent shadow-sm"
                                        : "text-app-text-muted hover:text-app-text hover:bg-glass-hover"
                                )}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Level Label ── */}
                <div className="px-3 py-2 shrink-0">
                    <div className="flex items-center gap-2 text-app-text-muted font-bold text-[10px] tracking-widest uppercase">
                        <Layers size={12} />
                        <span>{LEVEL_LABELS[activeLevel][lang] || LEVEL_LABELS[activeLevel].ja}</span>
                    </div>
                </div>

                {/* ── Content List (scrollable) ── */}
                <div data-tutorial="content-select" className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
                    {categories.map(category => (
                        <CategoryAccordion
                            key={`${activeLevel}-${category}`}
                            level={activeLevel}
                            category={category}
                            selectedContentId={selectedContentId}
                            onSelectContent={handleSelectContent}
                            highlightFirst={isTutorialContentSelect && category === categories[0]}
                        />
                    ))}

                    {categories.length === 0 && (
                        <div className="text-center text-app-text-muted text-xs py-8 opacity-50">
                            {t('sidebar.no_content')}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="p-3 border-t border-glass-border bg-glass-card shrink-0">
                    <div className="text-[10px] text-app-text-muted mb-2 font-medium">
                        {t('sidebar.cloud_sync')}
                    </div>
                    <button className="w-full py-2 bg-glass-card hover:bg-glass-hover text-app-text rounded text-xs font-bold transition-colors border border-glass-border flex items-center justify-center gap-2 cursor-pointer">
                        <Hash size={14} />
                        {t('sidebar.manage_plans')}
                    </button>
                </div>
            </div>
        </aside>
    );
};
