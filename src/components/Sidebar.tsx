import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import { ShareModal } from './ShareModal';
import { getTemplate } from '../data/templateLoader';
import {
    Plus,
    ChevronLeft,
    ChevronRight,
    CheckSquare,
    Square,
    Share2,
    Trash2,
    X
} from 'lucide-react';
// Plus は新規作成ボタンで使用
import clsx from 'clsx';
import { showToast } from './Toast';

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
    const { t } = useTranslation();
    const { plans, currentPlanId, updatePlan } = usePlanStore();
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
                            if (contentPlans.length === 1 && !isDisabled) {
                                // プラン1件 → そのプランIDをトグル
                                onToggleSelect(contentPlans[0].id);
                            } else if (contentPlans.length === 0) {
                                // プラン0件 → 選択不可（まだ開いてないコンテンツ）
                            } else {
                                // プラン2件以上 → コンテンツを開いてサブアイテム表示
                                onSelect(content);
                            }
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
                        isDisabled && "opacity-40 cursor-not-allowed grayscale",
                        isUnavailable && "opacity-20 pointer-events-none"
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
                            {contentPlans.length <= 1 ? (
                                // 0〜1件: コンテンツ行にチェックボックス
                                contentPlans.length === 1 && multiSelect.selectedIds.includes(contentPlans[0].id)
                                    ? <CheckSquare size={16} className="text-app-text" />
                                    : contentPlans.length === 0
                                        ? <Square size={16} className="text-app-text-muted/20" />
                                        : <Square size={16} className="text-app-text-muted/40 group-hover:text-app-text-muted" />
                            ) : (
                                // 2件以上: 選択数表示
                                <span className="text-[9px] font-bold text-app-text-muted">
                                    {contentPlans.filter(p => multiSelect.selectedIds.includes(p.id)).length > 0
                                        ? `${contentPlans.filter(p => multiSelect.selectedIds.includes(p.id)).length}/${contentPlans.length}`
                                        : `${contentPlans.length}件`
                                    }
                                </span>
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

                {/* ホバーの+ボタンは廃止 → サブアイテム末尾の+行に移動 */}
            </div>

            {/* サブアイテム: 保存済みプラン一覧 */}
            {/* 通常モード: アクティブかつ1件以上で展開 / 複数選択モード: プランがあれば常に展開 */}
            {contentPlans.length >= 1 && (isActive || multiSelect.isEnabled) && (
                <div className="pl-9 pr-2 py-1 flex flex-col gap-0.5 border-l-2 border-app-text/15 ml-3.5 mt-1 mb-2">
                    {contentPlans.map(plan => {
                        const isPlanSelected = multiSelect.selectedIds.includes(plan.id);
                        const isPlanDisabled = multiSelect.isEnabled && multiSelect.mode === 'share' && !isPlanSelected && multiSelect.selectedIds.length >= 10;

                        return (
                            <div key={plan.id} className="flex items-center gap-1">
                                {multiSelect.isEnabled ? (
                                    // 複数選択モード: チェックボックス付きプラン行
                                    <button
                                        onClick={() => { if (!isPlanDisabled) onToggleSelect(plan.id); }}
                                        disabled={isPlanDisabled}
                                        className={clsx(
                                            "flex-1 text-left text-[10px] py-1 px-2 rounded-md transition-colors font-medium truncate flex items-center gap-2 cursor-pointer",
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
                        );
                    })}
                    {/* 「+」行 — 同コンテンツに新しいプランを追加 */}
                    {isActive && !multiSelect.isEnabled && (
                        <button
                            onClick={() => onSelect(content, true)}
                            className="flex-1 text-left text-[10px] py-1 px-2 rounded-md transition-colors font-medium flex items-center gap-2 text-app-text-muted hover:text-app-text hover:bg-glass-hover cursor-pointer"
                        >
                            <Plus size={10} className="shrink-0" />
                            {t('sidebar.add_plan')}
                        </button>
                    )}
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
    defaultExpanded?: boolean;
}

const SeriesAccordion: React.FC<SeriesAccordionProps> = ({
    series, floors, selectedContentId, multiSelect, onToggleSelect, onSelectContent, lang, highlightFirst, showLabel, defaultExpanded = true
}) => {
    const hasActiveFloor = React.useMemo(() => floors.some(f => f.id === selectedContentId), [floors, selectedContentId]);
    const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

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
    defaultExpanded?: boolean;
}

const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
    level, category, selectedContentId, multiSelect, onToggleSelect, onSelectContent, highlightFirst, lang, defaultExpanded = false
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
                    {seriesList.map((series, idx) => (
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
                            defaultExpanded={idx === 0}
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
        selectedIds: [],
        mode: 'share',
    });
    // 削除確認モーダル
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // 名前入力ダイアログ用ステート
    const [pendingContent, setPendingContent] = useState<ContentDefinition | null>(null);
    const [pendingPlanName, setPendingPlanName] = useState('');

    const { plans, currentPlanId, setCurrentPlanId, updatePlan } = usePlanStore();
    const { getSnapshot, loadSnapshot } = useMitigationStore();

    // コンテンツクリック → 既存プランがあればそれを開く、なければ名前入力ダイアログを表示
    const handleSelectContent = (content: ContentDefinition, forceNew?: boolean) => {
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

        // 新規作成 → 名前入力ダイアログを表示（まだ保存しない）
        const defaultName = content.shortName.en || content.shortName.ja;
        setPendingContent(content);
        setPendingPlanName(defaultName);
    };

    // 名前確定 → テンプレート読み込み → プラン保存
    const handleConfirmNewPlan = async () => {
        if (!pendingContent || !pendingPlanName.trim()) return;
        const content = pendingContent;
        const planTitle = pendingPlanName.trim();

        const store = useMitigationStore.getState();
        const planStore = usePlanStore.getState();

        store.setCurrentLevel(content.level);
        store.applyDefaultStats(content.level, content.patch);
        // 新しいコンテンツを開くので軽減・パーティをクリア
        store.clearAllMitigations();
        setActiveLevel(content.level);

        // テンプレートを裏で読み込み → 自動でプランとして保存
        const tpl = await getTemplate(content.id);
        if (tpl) {
            // リセットされた初期状態にテンプレートのイベントを合成
            const snap = store.getSnapshot();
            store.loadSnapshot({
                ...snap,
                timelineMitigations: [],
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
        } else {
            // テンプレートなし → 空のプランで即開始
            store.loadSnapshot({
                ...store.getSnapshot(),
                timelineEvents: [],
                timelineMitigations: [],
                phases: []
            });
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

        // ダイアログを閉じる
        setPendingContent(null);
        setPendingPlanName('');

        // チュートリアル: テンプレートなしでもプラン作成完了を通知
        useTutorialStore.getState().completeEvent('timeline:events-loaded');
    };

    const handleCancelNewPlan = () => {
        setPendingContent(null);
        setPendingPlanName('');
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

                    {!multiSelect.isEnabled && plans.length > 0 && (
                        <div className="pb-2 shrink-0 mt-3">
                            <div className="flex items-center mb-2 px-4">
                                <span className="text-[10px] font-black text-app-text uppercase tracking-tighter">
                                    {t('sidebar.recent_activity')}
                                </span>
                            </div>
                            <div className="space-y-1 max-h-[84px] overflow-y-auto px-3 custom-scrollbar">
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

                    <div className="px-3 flex items-center gap-1 mb-2 shrink-0 flex-wrap">
                        <button
                            onClick={() => {
                                setIsNewPlanModalOpen(true);
                                useTutorialStore.getState().completeEvent('sidebar:new-plan-clicked');
                            }}
                            data-tutorial="new-plan"
                            className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-black transition-all border cursor-pointer bg-glass-card text-app-text border-glass-border hover:bg-glass-hover shadow-sm"
                        >
                            <Plus size={10} />
                            {t('sidebar.new_plan').toUpperCase()}
                        </button>
                        <button
                            onClick={() => toggleMultiSelectMode('share')}
                            className={clsx(
                                "flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-black transition-all border cursor-pointer",
                                multiSelect.isEnabled && multiSelect.mode === 'share'
                                    ? "bg-app-text text-app-bg border-app-text shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-glass-hover shadow-sm"
                            )}
                        >
                            {multiSelect.isEnabled && multiSelect.mode === 'share' ? <CheckSquare size={10} /> : <Square size={10} />}
                            {t('sidebar.multi_select_mode').toUpperCase()}
                        </button>
                        {/* 選択削除ボタン — 押すと削除用選択モードに入る */}
                        <button
                            onClick={() => toggleMultiSelectMode('delete')}
                            className={clsx(
                                "flex items-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-black transition-all border cursor-pointer shadow-sm",
                                multiSelect.isEnabled && multiSelect.mode === 'delete'
                                    ? "bg-app-text text-app-bg border-app-text shadow-md"
                                    : "bg-glass-card text-app-text border-glass-border hover:bg-glass-hover"
                            )}
                        >
                            <Trash2 size={10} />
                            {t('sidebar.select_delete').toUpperCase()}
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
                                    defaultExpanded={category === 'savage' || category === 'ultimate'}
                                />
                            ))}

                    </div>

                    {/* 下部アクションバー — 選択モード時に表示 */}
                    {multiSelect.isEnabled && (
                        <div className="absolute bottom-4 left-3 right-3 animate-in slide-in-from-bottom-4 duration-300">
                            <div className="relative bg-app-bg border border-app-text/20 rounded-2xl shadow-sm p-3 overflow-hidden">
                                <div className="absolute inset-0 bg-app-text/5 animate-pulse" />
                                {/* 上段: 選択件数 */}
                                <div className="relative text-center mb-2">
                                    <span className="text-[10px] font-bold text-app-text">
                                        {multiSelect.mode === 'delete'
                                            ? t('sidebar.selected_count_simple', { count: multiSelect.selectedIds.length })
                                            : t('sidebar.selected_count', { count: multiSelect.selectedIds.length })
                                        }
                                    </span>
                                </div>
                                {/* 下段: キャンセル + アクション */}
                                <div className="relative flex items-center gap-2">
                                    <button
                                        onClick={() => setMultiSelect({ isEnabled: false, selectedIds: [], mode: 'share' })}
                                        className="flex-1 py-1.5 rounded-lg text-xs font-bold text-app-text hover:bg-app-text/5 transition-colors cursor-pointer"
                                    >
                                        {t('sidebar.cancel')}
                                    </button>
                                    {multiSelect.mode === 'share' ? (
                                        <button
                                            onClick={handleShareBundle}
                                            disabled={multiSelect.selectedIds.length === 0}
                                            className={clsx(
                                                "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                                                multiSelect.selectedIds.length > 0
                                                    ? "bg-app-text text-app-bg hover:opacity-80 active:scale-95"
                                                    : "bg-glass-card text-app-text-muted border border-glass-border opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <Share2 size={14} />
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
                                                "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                                                multiSelect.selectedIds.length > 0
                                                    ? "bg-app-text text-app-bg hover:opacity-80 active:scale-95"
                                                    : "bg-glass-card text-app-text-muted border border-glass-border opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <Trash2 size={14} />
                                            <span>{t('sidebar.delete')}</span>
                                        </button>
                                    )}
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
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={handleCancelNewPlan}
                >
                    <div
                        className="relative bg-app-bg border border-app-border rounded-2xl shadow-2xl w-[360px] max-w-[90vw] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-app-border">
                            <h3 className="text-sm font-bold text-app-text">
                                {t('sidebar.name_dialog_title')}
                            </h3>
                            <p className="text-[11px] text-app-text-muted mt-1">
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
                                className="w-full px-4 py-3 bg-app-surface2 border border-app-border rounded-xl text-sm text-app-text font-bold outline-none focus:border-app-text/40 transition-colors"
                            />
                        </div>
                        <div className="px-5 pb-4 flex gap-2">
                            <button
                                onClick={handleCancelNewPlan}
                                className="flex-1 py-2.5 rounded-xl border border-app-border text-xs font-bold text-app-text hover:bg-app-surface2 transition-colors cursor-pointer"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleConfirmNewPlan}
                                disabled={!pendingPlanName.trim()}
                                className={clsx(
                                    "flex-[2] py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                                    pendingPlanName.trim()
                                        ? "bg-app-text text-app-bg hover:opacity-80 active:scale-[0.98]"
                                        : "bg-app-surface2 text-app-text-muted cursor-not-allowed"
                                )}
                            >
                                {t('sidebar.create_plan_button')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* 削除確認モーダル — NewPlanModalと同じ温度感 */}
            {showDeleteConfirm && createPortal(
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <div
                        className="relative w-full max-w-[400px] bg-glass-panel border border-glass-border/50 rounded-2xl shadow-sm overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* ヘッダー */}
                        <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                            <h2 className="text-[13px] font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                                <span className="w-1.5 h-4 bg-app-text rounded-full" />
                                {t('sidebar.delete_confirm_title')}
                            </h2>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="p-2 hover:bg-glass-hover rounded-full transition-colors text-app-text cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* 本文 */}
                        <div className="p-6 space-y-3">
                            <p className="text-[13px] font-bold text-app-text text-center">
                                {t('sidebar.delete_confirm', { count: multiSelect.selectedIds.length })}
                            </p>
                            <p className="text-[11px] text-app-text-muted text-center">
                                {t('sidebar.delete_warning')}
                            </p>
                        </div>

                        {/* フッター */}
                        <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex gap-4">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-[11px] font-black text-app-text hover:bg-glass-hover transition-all cursor-pointer uppercase tracking-widest active:scale-95"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    const planStore = usePlanStore.getState();
                                    multiSelect.selectedIds.forEach(id => planStore.deletePlan(id));
                                    setMultiSelect({ isEnabled: false, selectedIds: [], mode: 'share' });
                                    setShowDeleteConfirm(false);
                                }}
                                className="flex-[2] py-3.5 rounded-2xl text-[11px] font-black bg-app-text text-app-bg hover:opacity-80 transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95"
                            >
                                {t('sidebar.delete')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </motion.aside>
    );
};
