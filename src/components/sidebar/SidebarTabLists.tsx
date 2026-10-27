import React from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_LABELS, getProjectLabel, getContentById, getSavageForCurrentExpansion, getAllUltimates, getOtherContents, getSeriesById } from '../../data/contentRegistry';
import type { ContentDefinition } from '../../types';
import type { MultiSelectState } from '../../types/sidebarTypes';
import type { ContentLanguage } from '../../store/useThemeStore';
import { useTransitionOverlay } from '../ui/TransitionOverlay';
import type { SidebarTab } from './useSidebarNav';
import type { SavedPlan } from '../../types';
import type { useSidebarNav } from './useSidebarNav';
import { ContentTreeItem } from './ContentTreeItem';
import { FreePlanSection } from './FreePlanSection';
import { ArchivePlanRow } from './ArchivePlanRow';

type Nav = ReturnType<typeof useSidebarNav>;

interface SidebarTabListsProps {
    activeTab: SidebarTab;
    lang: ContentLanguage;
    multiSelect: MultiSelectState;
    setMultiSelect: React.Dispatch<React.SetStateAction<MultiSelectState>>;
    toggleItemId: (id: string) => void;
    plans: SavedPlan[];
    currentPlanId: string | null;
    updatePlan: (id: string, data: Partial<SavedPlan>) => void;
    selectedContentId: string | null;
    handleSelectContent: (content: ContentDefinition, forceNew?: boolean) => void;
    handleLoadPlan: (id: string) => void;
    setContextMenu: Nav['setContextMenu'];
    isTutorialContentSelect: boolean;
    runTransition: ReturnType<typeof useTransitionOverlay>['runTransition'];
    savageListRef: React.RefObject<HTMLDivElement | null>;
    ultimateListRef: React.RefObject<HTMLDivElement | null>;
    otherListRef: React.RefObject<HTMLDivElement | null>;
    archiveListRef: React.RefObject<HTMLDivElement | null>;
}

export const SidebarTabLists: React.FC<SidebarTabListsProps> = ({ activeTab, lang, multiSelect, setMultiSelect, toggleItemId, plans, currentPlanId, updatePlan, selectedContentId, handleSelectContent, handleLoadPlan, setContextMenu, isTutorialContentSelect, runTransition, savageListRef, ultimateListRef, otherListRef, archiveListRef }) => {
    const { t } = useTranslation();
    return (
<>
                    {/* 零式タブ (savage) */}
                    {activeTab === 'savage' && (
                        <div ref={savageListRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
                            {(() => {
                                const savageContents = getSavageForCurrentExpansion();
                                const seriesIds = [...new Set(savageContents.map(c => c.seriesId))];
                                return seriesIds.map(sid => {
                                    const series = getSeriesById(sid);
                                    const contents = savageContents.filter(c => c.seriesId === sid);
                                    if (contents.length === 0) return null;
                                    const seriesName = series?.name[lang as ContentLanguage] || series?.name.ja || sid;
                                    const projectLabel = getProjectLabel(contents[0].level, 'savage');
                                    const sectionLabel = projectLabel
                                        ? `${projectLabel[lang as ContentLanguage] || projectLabel.ja}：${seriesName}`
                                        : seriesName;
                                    return (
                                        <div key={sid}>
                                            <div className="text-app-base font-bold text-app-text px-2.5 pt-3 pb-1">
                                                {sectionLabel}
                                            </div>
                                            {contents.map((content, idx) => (
                                                <ContentTreeItem
                                                    key={content.id}
                                                    content={content}
                                                    isActive={selectedContentId === content.id}
                                                    multiSelect={multiSelect}
                                                    onToggleSelect={toggleItemId}
                                                    onSelect={handleSelectContent}
                                                    highlightFirst={isTutorialContentSelect && idx === 0 && sid === seriesIds[0]}
                                                    lang={lang}
                                                    onContextMenu={(e, planId, planTitle, contentId) => {
                                                        setContextMenu({ x: e.clientX, y: e.clientY, planId, planTitle, contentId });
                                                    }}
                                                    onShiftSelect={(planId) => {
                                                        setMultiSelect(prev => ({
                                                            isEnabled: true,
                                                            selectedIds: prev.selectedIds.includes(planId)
                                                                ? prev.selectedIds.filter(id => id !== planId)
                                                                : [...prev.selectedIds, planId],
                                                            mode: prev.mode || 'share',
                                                        }));
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}

                    {/* 絶タブ (ultimate) */}
                    {activeTab === 'ultimate' && (
                        <div ref={ultimateListRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
                            {getAllUltimates().map(content => (
                                <ContentTreeItem
                                    key={content.id}
                                    content={content}
                                    isActive={selectedContentId === content.id}
                                    multiSelect={multiSelect}
                                    onToggleSelect={toggleItemId}
                                    onSelect={handleSelectContent}
                                    lang={lang}
                                    showFullName
                                    onContextMenu={(e, planId, planTitle, contentId) => {
                                        setContextMenu({ x: e.clientX, y: e.clientY, planId, planTitle, contentId });
                                    }}
                                    onShiftSelect={(planId) => {
                                        setMultiSelect(prev => ({
                                            isEnabled: true,
                                            selectedIds: prev.selectedIds.includes(planId)
                                                ? prev.selectedIds.filter(id => id !== planId)
                                                : [...prev.selectedIds, planId],
                                            mode: prev.mode || 'share',
                                        }));
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* その他タブ (other) */}
                    {activeTab === 'other' && (
                        <div ref={otherListRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
                            {getOtherContents().map(content => (
                                <ContentTreeItem
                                    key={content.id}
                                    content={content}
                                    isActive={selectedContentId === content.id}
                                    multiSelect={multiSelect}
                                    onToggleSelect={toggleItemId}
                                    onSelect={handleSelectContent}
                                    lang={lang}
                                    onContextMenu={(e, planId, planTitle, contentId) => {
                                        setContextMenu({ x: e.clientX, y: e.clientY, planId, planTitle, contentId });
                                    }}
                                    onShiftSelect={(planId) => {
                                        setMultiSelect(prev => ({
                                            isEnabled: true,
                                            selectedIds: prev.selectedIds.includes(planId)
                                                ? prev.selectedIds.filter(id => id !== planId)
                                                : [...prev.selectedIds, planId],
                                            mode: prev.mode || 'share',
                                        }));
                                    }}
                                />
                            ))}
                            {(['dungeon', 'raid', 'custom'] as const).map(cat => {
                                const catPlans = plans.filter(p => {
                                    if (p.archived) return false;
                                    if (p.category) return p.category === cat;
                                    if (p.contentId === null && cat === 'custom') return true;
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
                    )}

                    {/* アーカイブタブ (archive) */}
                    {activeTab === 'archive' && (
                        <div ref={archiveListRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
                            {(() => {
                                const archivedPlans = plans.filter(p => p.archived);
                                if (archivedPlans.length === 0) {
                                    return (
                                        <div className="text-center text-app-text-muted text-app-base py-8">
                                            {t('sidebar.archive_empty')}
                                        </div>
                                    );
                                }
                                const sorted = [...archivedPlans].sort((a, b) => {
                                    const levelA = a.level ?? 0;
                                    const levelB = b.level ?? 0;
                                    if (levelA !== levelB) return levelA - levelB;
                                    const catOrder = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];
                                    return catOrder.indexOf(a.category || 'custom') - catOrder.indexOf(b.category || 'custom');
                                });
                                return sorted.map(plan => (
                                    <ArchivePlanRow
                                        key={plan.id}
                                        plan={plan}
                                        currentPlanId={currentPlanId}
                                        runTransition={runTransition}
                                        t={t}
                                    />
                                ));
                            })()}
                        </div>
                    )}
</>
    );
};
