import React from 'react';
import { useTranslation } from 'react-i18next';
import { hasContentRegistry } from '../../lib/contentSelection';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../../types';
import clsx from 'clsx';
import { INPUT_CLASS } from '../ui/ModalParts';

interface NewPlanContentFieldsProps {
    level: ContentLevel | null;
    category: ContentCategory | null;
    boss: ContentDefinition | null;
    title: string;
    setTitle: (title: string) => void;
    titleInputRef: React.RefObject<HTMLInputElement | null>;
    filteredBosses: ContentDefinition[];
    handleBossSelect: (selectedBoss: ContentDefinition) => void;
    lang: 'en' | 'ja';
}

/** 新規作成モーダルのコンテンツ一覧(零式・絶)とプラン名入力。 */
export const NewPlanContentFields: React.FC<NewPlanContentFieldsProps> = ({
    level, category, boss, title, setTitle, titleInputRef, filteredBosses, handleBossSelect, lang,
}) => {
    const { t } = useTranslation();
    return (<>
                        {/* 零式・絶: コンテンツ一覧（フラットリスト） */}
                        {hasContentRegistry(category) && (
                            <div className="space-y-3.5">
                                <label className="text-app-base font-black text-app-text uppercase tracking-[0.25em] pl-1">
                                    {t('new_plan.content_label')}
                                </label>
                                {level ? (
                                    filteredBosses.length > 0 ? (
                                        <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                                            {filteredBosses.map(b => (
                                                <button
                                                    key={b.id}
                                                    onClick={() => handleBossSelect(b)}
                                                    className={clsx(
                                                        "w-full px-4 py-3 rounded-xl text-app-lg font-black transition-all border cursor-pointer text-left active:scale-[0.98]",
                                                        boss?.id === b.id
                                                            ? "bg-app-toggle text-app-toggle-text border-app-toggle"
                                                            : "bg-glass-card/30 text-app-text border-glass-border/40 hover:bg-glass-hover"
                                                    )}
                                                >
                                                    {b.name[lang] || b.name.ja}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-app-md text-app-text-muted text-center py-6 italic opacity-60">
                                            {t('new_plan.no_matches')}
                                        </p>
                                    )
                                ) : (
                                    <p className="text-app-md text-app-text-muted text-center py-6 italic opacity-60">
                                        {t('new_plan.select_level_first')}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* 零式・絶: プラン名入力 */}
                        {hasContentRegistry(category) && boss && (
                            <div className="space-y-3.5">
                                <label className="text-app-base font-black text-app-text uppercase tracking-[0.25em] pl-1">
                                    {t('new_plan.plan_name_label')}
                                </label>
                                <input
                                    ref={titleInputRef}
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder={t('new_plan.plan_name_placeholder')}
                                    className={INPUT_CLASS}
                                />
                            </div>
                        )}

                        {/* ダンジョン・レイド・その他: 名前入力のみ */}
                        {category !== null && !hasContentRegistry(category) && (
                            <div className="space-y-3.5">
                                <label className="text-app-base font-black text-app-text uppercase tracking-[0.25em] pl-1">
                                    {t('new_plan.plan_name_label')}
                                </label>
                                <input
                                    ref={titleInputRef}
                                    data-tutorial="plan-name-input"
                                    autoFocus
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder={t('new_plan.free_name_placeholder')}
                                    className={INPUT_CLASS}
                                />
                            </div>
                        )}
    </>);
};
