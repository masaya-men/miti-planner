import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTutorialStore } from '../../store/useTutorialStore';
import type { ContentDefinition } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import type { MultiSelectState } from '../../types/sidebarTypes';
import type { ContentLanguage } from '../../store/useThemeStore';
import { usePlanStore } from '../../store/usePlanStore';
import { useShallow } from 'zustand/react/shallow';
import { PLAN_LIMITS } from '../../types/firebase';
import { useTransitionOverlay } from '../ui/transitionOverlayContext';
import { Plus, ChevronRight, CheckSquare, Square } from 'lucide-react';
import clsx from 'clsx';
import { ContentPlanRow } from './ContentPlanRow';
import { usePlanRowEditing } from './usePlanRowEditing';

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
    onContextMenu?: (e: React.MouseEvent, planId: string, planTitle: string, contentId: string | null) => void;
    onShiftSelect?: (planId: string) => void;
    /** shortNameアイコンの代わりに正式名称をテキスト表示する */
    showFullName?: boolean;
}

export const ContentTreeItem = React.memo<ContentTreeItemProps>(({
    content, isActive, multiSelect, onToggleSelect, onSelect, highlightFirst, lang, onContextMenu, onShiftSelect, showFullName
}) => {
    const { t } = useTranslation();
    const { plans, currentPlanId } = usePlanStore(
        useShallow(s => ({ plans: s.plans, currentPlanId: s.currentPlanId }))
    );
    const { runTransition } = useTransitionOverlay();
    const contentPlans = plans.filter(p => p.contentId === content.id);
    // 複数選択モード: プラン単位で選択する
    const hasSelectedPlan = multiSelect.isEnabled && contentPlans.some(p => multiSelect.selectedIds.includes(p.id));
    // 共有モードのみ10件制限、削除モードは無制限
    const isDisabled = multiSelect.isEnabled && multiSelect.mode === 'share' && !hasSelectedPlan && multiSelect.selectedIds.length >= 10;

    const floorName = content.name[lang as ContentLanguage] || content.name.en || content.name.ja;
    const shortName = content.shortName[lang as ContentLanguage] || content.shortName.en || content.shortName.ja;
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

    const {
        editingPlanId, setEditingPlanId, editingTitle, setEditingTitle, editInputRef,
        confirmDeletePlanId, setConfirmDeletePlanId, startEditing, finishEditing,
    } = usePlanRowEditing();

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

                        {showFullName ? (
                            /* 正式名称テキスト表示（絶タブ用） */
                            <span className={clsx(
                                "flex-1 min-w-0 truncate text-app-base font-bold",
                                isActive && !multiSelect.isEnabled ? "text-app-text" : "text-app-text"
                            )}>
                                {floorName}
                            </span>
                        ) : (
                            <div className="shrink-0 flex items-center justify-center">
                                <div className={clsx(
                                    "w-8 h-9 rounded flex flex-col items-center justify-center font-black text-app-base shrink-0",
                                    isActive && !multiSelect.isEnabled
                                        ? "bg-app-toggle text-app-toggle-text"
                                        : "bg-glass-card text-app-text group-hover:bg-glass-hover"
                                )}>
                                    <span className="leading-none">{shortName.split('\n')[0]}</span>
                                    {shortName.split('\n')[1] && (
                                        <span className="text-app-sm leading-none mt-0.5">{shortName.split('\n')[1]}</span>
                                    )}
                                </div>
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

                        {/* 上限到達バッジ (Phase B-1.5 polish 第 2 弾 #3): コンテンツが
                            プラン保存上限に達したら閉じ状態でも常に「上限 5/5」 を表示。
                            i18n キーは expanded 時の表示と完全に同じ (sidebar.plan_limit) で揃える。 */}
                        {contentPlans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT && !multiSelect.isEnabled && (
                            <span className="shrink-0 text-app-xs font-medium text-app-text-muted/60 px-1">
                                {t('sidebar.plan_limit', {
                                    current: contentPlans.length,
                                    max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT,
                                })}
                            </span>
                        )}

                        {/* クリック領域を維持するための flex-1 スペーサー（絶タブは正式名称が flex-1 で広がるため不要） */}
                        {!showFullName && <div className="flex-1 min-w-0" />}
                    </button>
                </Tooltip>

                {/* ホバーで表示される「+」ボタン — 展開せずにプラン追加 */}
                {!multiSelect.isEnabled && (
                    <Tooltip content={t('sidebar.add_plan')}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(content, true);
                            }}
                            className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-all cursor-pointer opacity-0 group-hover/content:opacity-100"
                        >
                            <Plus size={12} />
                        </button>
                    </Tooltip>
                )}
            </div>

            {/* サブアイテム: 保存済みプラン一覧 */}
            {contentPlans.length >= 1 && (isExpanded || multiSelect.isEnabled) && (
                <div className="pl-9 pr-2 py-1 flex flex-col gap-0.5 border-l-2 border-app-text/15 ml-3.5 mt-1 mb-2">
                    {contentPlans.map(plan => {
                        return (
                            <ContentPlanRow
                                key={plan.id}
                                plan={plan}
                                multiSelect={multiSelect}
                                onToggleSelect={onToggleSelect}
                                onContextMenu={onContextMenu}
                                onShiftSelect={onShiftSelect}
                                currentPlanId={currentPlanId}
                                runTransition={runTransition}
                                editingPlanId={editingPlanId}
                                setEditingPlanId={setEditingPlanId}
                                editingTitle={editingTitle}
                                setEditingTitle={setEditingTitle}
                                editInputRef={editInputRef}
                                finishEditing={finishEditing}
                                startEditing={startEditing}
                                confirmDeletePlanId={confirmDeletePlanId}
                                setConfirmDeletePlanId={setConfirmDeletePlanId}
                            />
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