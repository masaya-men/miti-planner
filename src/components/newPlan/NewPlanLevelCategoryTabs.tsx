import React from 'react';
import { useTranslation } from 'react-i18next';
import { CATEGORY_LABELS } from '../../data/contentRegistry';
import type { ContentLevel, ContentCategory } from '../../types';
import { useTutorialStore } from '../../store/useTutorialStore';
import clsx from 'clsx';

const LEVEL_OPTIONS: ContentLevel[] = [100, 90, 80, 70];
const CATEGORY_OPTIONS: ContentCategory[] = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];

interface NewPlanLevelCategoryTabsProps {
    level: ContentLevel | null;
    setLevel: (l: ContentLevel) => void;
    category: ContentCategory | null;
    setCategory: (c: ContentCategory) => void;
    lang: 'en' | 'ja';
}

/** 新規作成モーダルのレベル選択タブとカテゴリ選択タブ。 */
export const NewPlanLevelCategoryTabs: React.FC<NewPlanLevelCategoryTabsProps> = ({ level, setLevel, category, setCategory, lang }) => {
    const { t } = useTranslation();
    return (<>
                        {/* Level Tabs */}
                        <div className="space-y-3.5">
                            <label className="text-app-base font-black text-app-text uppercase tracking-[0.25em] pl-1">
                                {t('new_plan.level_label')}
                            </label>
                            <div className="flex gap-1.5 bg-glass-card/50 rounded-xl p-1.5 border border-glass-border/20 shadow-inner">
                                {LEVEL_OPTIONS.map((l, idx) => (
                                    <button
                                        key={l}
                                        data-tutorial={idx === 0 ? 'level-max' : undefined}
                                        onClick={() => {
                                            setLevel(l);
                                            useTutorialStore.getState().completeEvent('create:level-selected');
                                        }}
                                        className={clsx(
                                            "flex-1 py-2 rounded-lg text-app-md font-black transition-all duration-300 cursor-pointer",
                                            level === l
                                                ? "bg-app-toggle text-app-toggle-text shadow-lg scale-[1.02]"
                                                : "text-app-text hover:bg-glass-hover"
                                        )}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category Tabs */}
                        <div className="space-y-3.5">
                            <label className="text-app-base font-black text-app-text uppercase tracking-[0.25em] pl-1">
                                {t('new_plan.category_label')}
                            </label>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
                                {CATEGORY_OPTIONS.map(cat => (
                                    <button
                                        key={cat}
                                        data-tutorial={cat === 'dungeon' ? 'category-dungeon' : undefined}
                                        onClick={() => {
                                            setCategory(cat);
                                            useTutorialStore.getState().completeEvent('create:category-selected');
                                        }}
                                        className={clsx(
                                            "whitespace-nowrap px-6 py-2.5 rounded-full text-app-md font-black transition-all border cursor-pointer",
                                            category === cat
                                                ? "bg-app-toggle text-app-toggle-text border-app-toggle"
                                                : "bg-glass-card/30 text-app-text border-glass-border/40 hover:border-glass-hover"
                                        )}
                                    >
                                        {(CATEGORY_LABELS[cat][lang] || CATEGORY_LABELS[cat].ja).toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
    </>);
};
