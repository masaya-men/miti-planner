import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTutorialStore } from '../../store/useTutorialStore';
import type { MultiSelectState } from '../../types/sidebarTypes';
import { SegmentButton } from '../ui/SegmentButton';
import { Plus, CheckSquare, Square, Trash2, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import type { SidebarTab } from './useSidebarNav';

interface SidebarToolbarProps {
    activeTab: SidebarTab;
    setActiveTab: (tab: SidebarTab) => void;
    multiSelect: MultiSelectState;
    toggleMultiSelectMode: (mode?: 'share' | 'delete') => void;
    setIsNewPlanModalOpen: (open: boolean) => void;
    fullWidth?: boolean;
    onAutoPlan?: () => void;
}

export const SidebarToolbar: React.FC<SidebarToolbarProps> = ({ activeTab, setActiveTab, multiSelect, toggleMultiSelectMode, setIsNewPlanModalOpen, fullWidth, onAutoPlan }) => {
    const { t } = useTranslation();
    return (
<>
                    {/* Header Controls area with save button instead of big new plan */}
                    <div className="p-2 border-b border-glass-border" />

                    {/* タブ */}
                    <div className="px-3 pt-3">
                        <SegmentButton
                            options={[
                                { value: 'savage' as const, label: t('sidebar.tab_savage').toUpperCase() },
                                { value: 'ultimate' as const, label: t('sidebar.tab_ultimate').toUpperCase() },
                                { value: 'other' as const, label: t('sidebar.tab_other').toUpperCase() },
                                { value: 'archive' as const, label: t('sidebar.tab_archive').toUpperCase() },
                            ]}
                            value={activeTab}
                            onChange={setActiveTab}
                            size="sm"
                            className="shadow-sm"
                        />
                    </div>

                    {/* ボタンバー */}
                    <div className="px-3 shrink-0 my-2">
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
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-app-base font-black transition-all duration-300 border cursor-pointer bg-glass-card text-app-text border-glass-border hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text active:scale-95 shadow-sm"
                        >
                            <Plus size={12} />
                            {t('sidebar.new_plan').toUpperCase()}
                        </button>
                        <button
                            onClick={() => toggleMultiSelectMode('share')}
                            className={clsx(
                                "flex items-center gap-1 px-2 py-1 rounded-md text-app-base font-black transition-all duration-300 border cursor-pointer active:scale-95",
                                multiSelect.isEnabled && multiSelect.mode === 'share'
                                    ? "bg-app-toggle text-app-toggle-text border-app-toggle shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text shadow-sm"
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
                                    ? "bg-app-toggle text-app-toggle-text border-app-toggle shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text"
                            )}
                        >
                            <Trash2 size={12} />
                            {t('sidebar.select_delete').toUpperCase()}
                        </button>
                        {/* モバイルメニュー専用: 軽減自動組み立て(ボタンバー右の空きへ・短縮文言) */}
                        {fullWidth && (
                            <button
                                onClick={() => onAutoPlan?.()}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-app-base font-black transition-all duration-300 border cursor-pointer bg-glass-card text-app-text border-glass-border hover:bg-app-toggle hover:border-app-toggle hover:text-app-toggle-text active:scale-95 shadow-sm"
                            >
                                <Sparkles size={12} />
                                {t('mitigation.auto_plan_short').toUpperCase()}
                            </button>
                        )}
                        </div>
                    </div>
</>
    );
};
