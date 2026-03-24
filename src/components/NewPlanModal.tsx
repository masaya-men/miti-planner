import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    CATEGORY_LABELS,
    getSeriesByLevel,
    getContentBySeries,
} from '../data/contentRegistry';
import type { ContentLevel, ContentCategory, ContentDefinition } from '../types';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { getTemplate } from '../data/templateLoader';
import { PLAN_LIMITS } from '../types/firebase';
import { X, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface NewPlanModalProps {
    isOpen: boolean;
    onClose: (created?: { contentId: string | null; level: ContentLevel }) => void;
}

const LEVEL_OPTIONS: ContentLevel[] = [100, 90, 80, 70];
const CATEGORY_OPTIONS: ContentCategory[] = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];

export const NewPlanModal: React.FC<NewPlanModalProps> = ({ isOpen, onClose }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'en' ? 'en' : 'ja';

    const { plans, addPlan, setCurrentPlanId, updatePlan, currentPlanId: activePlanId } = usePlanStore();
    const { getSnapshot } = useMitigationStore();

    // 件数制限チェック
    const totalPlanCount = plans.length;
    const isTotalLimitReached = totalPlanCount >= PLAN_LIMITS.MAX_TOTAL_PLANS;
    const isArchiveWarning = totalPlanCount >= PLAN_LIMITS.ARCHIVE_WARNING_THRESHOLD;

    // Selection State
    const [level, setLevel] = useState<ContentLevel>(100);
    const [category, setCategory] = useState<ContentCategory>('savage');
    const [boss, setBoss] = useState<ContentDefinition | null>(null);
    const [title, setTitle] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const titleInputRef = useRef<HTMLInputElement>(null);

    // Filter bosses based on level and category
    const filteredBosses = React.useMemo(() => {
        const series = getSeriesByLevel(level).filter(s => s.category === category);
        return series.flatMap(s => getContentBySeries(s.id));
    }, [level, category]);

    // Reset boss if filter changes and current boss is no longer in the list
    useEffect(() => {
        if (boss && !filteredBosses.some(b => b.id === boss.id)) {
            setBoss(null);
        }
    }, [filteredBosses, boss]);

    // Auto-fill title and focus
    const handleBossSelect = (selectedBoss: ContentDefinition) => {
        setBoss(selectedBoss);
        // デフォルト名は英語略称（サイドバーからの作成と同じ）
        const defaultName = selectedBoss.shortName.en || selectedBoss.shortName.ja;
        setTitle(defaultName);
        setIsDropdownOpen(false);

        setTimeout(() => {
            if (titleInputRef.current) {
                titleInputRef.current.focus();
                titleInputRef.current.select();
            }
        }, 50);
    };

    // 選択中コンテンツの件数チェック
    const contentPlanCount = boss ? plans.filter(p => p.contentId === boss.id).length : 0;
    const isContentLimitReached = boss ? contentPlanCount >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT : false;
    const isBlocked = isTotalLimitReached || isContentLimitReached;

    const handleCreate = async () => {
        if (!title.trim() || isBlocked) return;

        // 1. 現在のプランを保存
        if (activePlanId) {
            updatePlan(activePlanId, { data: getSnapshot() });
        }

        const store = useMitigationStore.getState();
        const useLevel = boss ? boss.level : level;

        // 2. レベル・ステータス設定 + 軽減クリア
        store.setCurrentLevel(useLevel);
        store.applyDefaultStats(useLevel, boss?.patch);
        store.clearAllMitigations();

        // 3. テンプレート読み込み（コンテンツ選択時のみ）
        if (boss) {
            const tpl = await getTemplate(boss.id);
            if (tpl) {
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
                store.loadSnapshot({
                    ...store.getSnapshot(),
                    timelineEvents: [],
                    timelineMitigations: [],
                    phases: []
                });
            }
        } else {
            // コンテンツなし → 完全に空のプラン
            store.loadSnapshot({
                ...store.getSnapshot(),
                timelineEvents: [],
                timelineMitigations: [],
                phases: []
            });
        }

        // 4. プラン保存
        const newPlanId = `plan_${Date.now()}`;
        addPlan({
            id: newPlanId,
            ownerId: 'local',
            ownerDisplayName: 'Guest',
            contentId: boss?.id || null,
            title: title.trim(),
            isPublic: false,
            copyCount: 0,
            useCount: 0,
            data: store.getSnapshot(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        setCurrentPlanId(newPlanId);

        // チュートリアル通知
        useTutorialStore.getState().completeEvent('timeline:events-loaded');

        // サイドバーに作成結果を伝える
        onClose({ contentId: boss?.id || null, level: useLevel as ContentLevel });
    };

    if (!isOpen) return null;

    if (!mounted || !isOpen) return null;

    return createPortal(
        <AnimatePresence mode="wait">
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onClose()}
                    className="absolute inset-0 bg-black/40 cursor-pointer"
                />

                <motion.div
                    data-tutorial-modal
                    initial={{ scale: 0.9, opacity: 0, y: 30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 30 }}
                    className="relative w-full max-w-[440px] bg-glass-panel border border-glass-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col pointer-events-auto"
                    style={{ maxHeight: 'min(720px, calc(100vh - 64px))' }}
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                        <h2 className="text-[13px] font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                            <span className="w-1.5 h-4 bg-app-text rounded-full" />
                            {t('new_plan.modal_title')}
                        </h2>
                        <button
                            data-tutorial="new-plan-close"
                            onClick={() => onClose()}
                            className="p-2 hover:bg-glass-hover rounded-full transition-colors text-app-text cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 space-y-7 overflow-y-auto no-scrollbar">
                        {/* Level Tabs */}
                        <div className="space-y-3.5">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black text-app-text uppercase tracking-[0.25em]">
                                    {t('new_plan.level_label')}
                                </label>
                                <span className="text-[9px] font-bold text-app-text-muted bg-app-text/5 px-2 py-0.5 rounded-full border border-app-text/10">{t('new_plan.optional')}</span>
                            </div>
                            <div className="flex gap-1.5 bg-glass-card/50 rounded-xl p-1.5 border border-glass-border/20 shadow-inner">
                                {LEVEL_OPTIONS.map(l => (
                                    <button
                                        key={l}
                                        onClick={() => setLevel(l)}
                                        className={clsx(
                                            "flex-1 py-2 rounded-lg text-[11px] font-black transition-all duration-300 cursor-pointer",
                                            level === l 
                                                ? "bg-app-accent text-app-text-on-accent shadow-lg shadow-app-accent/30 scale-[1.02]" 
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
                            <label className="text-[10px] font-black text-app-text uppercase tracking-[0.25em] pl-1">
                                {t('new_plan.category_label')}
                            </label>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
                                {CATEGORY_OPTIONS.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategory(cat)}
                                        className={clsx(
                                            "whitespace-nowrap px-6 py-2.5 rounded-full text-[11px] font-black transition-all border cursor-pointer",
                                            category === cat
                                                ? "bg-app-text text-app-bg border-app-text"
                                                : "bg-glass-card/30 text-app-text border-glass-border/40 hover:border-glass-hover"
                                        )}
                                    >
                                        {(CATEGORY_LABELS[cat][lang] || CATEGORY_LABELS[cat].ja).toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Dropdown */}
                        <div className="space-y-3.5 relative">
                            <label className="text-[10px] font-black text-app-text uppercase tracking-[0.25em] pl-1">
                                {t('new_plan.content_label')}
                            </label>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={clsx(
                                    "w-full flex items-center justify-between px-4.5 py-4 bg-glass-card/40 border rounded-2xl text-[13px] transition-all duration-300 cursor-pointer",
                                    boss ? "text-app-text font-black" : "text-app-text-muted",  // placeholder
                                    isDropdownOpen ? "border-app-accent ring-4 ring-app-accent/15" : "border-glass-border/40 hover:border-glass-hover"
                                )}
                            >
                                <span className="truncate">
                                    {boss ? (boss.name[lang] || boss.name.ja) : t('new_plan.content_placeholder')}
                                </span>
                                <ChevronDown size={18} className={clsx("transition-transform duration-300", isDropdownOpen && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                                {isDropdownOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute top-full left-0 right-0 mt-3 bg-app-bg border border-glass-border shadow-sm rounded-2xl z-[110] max-h-64 overflow-y-auto no-scrollbar p-2"
                                    >
                                        {filteredBosses.length > 0 ? (
                                            filteredBosses.map(b => (
                                                <button
                                                    key={b.id}
                                                    onClick={() => handleBossSelect(b)}
                                                    className={clsx(
                                                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs transition-all cursor-pointer text-left mb-1 last:mb-0",
                                                        boss?.id === b.id 
                                                            ? "bg-app-accent/20 text-app-accent font-black shadow-inner" 
                                                            : "text-app-text hover:bg-app-surface2"
                                                    )}
                                                >
                                                    <span className="truncate">{b.name[lang] || b.name.ja}</span>
                                                    {boss?.id === b.id && <Check size={14} className="shrink-0 ml-2" />}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="py-10 text-center text-app-text-muted italic text-[11px] opacity-60">
                                                {t('new_plan.no_matches')}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Plan Name */}
                        <div className="space-y-3.5">
                            <label className="text-[10px] font-black text-app-text uppercase tracking-[0.25em] pl-1">
                                {t('new_plan.plan_name_label')}
                            </label>
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder={t('new_plan.plan_name_placeholder')}
                                className="w-full px-5 py-4 bg-glass-card/40 border border-glass-border/30 rounded-2xl text-[13px] focus:outline-none focus:border-app-accent focus:ring-4 ring-app-accent/15 transition-all font-black placeholder:text-app-text-muted/30"
                            />
                        </div>

                    </div>

                    {/* 件数制限の警告 */}
                    {(isBlocked || isArchiveWarning) && (
                        <div className="px-6 pb-2">
                            <div className={clsx(
                                "flex items-start gap-2 p-3 rounded-xl text-[11px] border",
                                isBlocked
                                    ? "bg-app-text/5 border-app-text/20 text-app-text"
                                    : "bg-app-text/3 border-app-text/10 text-app-text-muted"
                            )}>
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <div>
                                    {isTotalLimitReached && (
                                        <p>{t('new_plan.plan_limit_total', { max: PLAN_LIMITS.MAX_TOTAL_PLANS })}</p>
                                    )}
                                    {isContentLimitReached && !isTotalLimitReached && (
                                        <p>{t('new_plan.plan_limit_per_content', { max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT })}</p>
                                    )}
                                    {isArchiveWarning && !isBlocked && (
                                        <p>{t('new_plan.plan_archive_warning', { threshold: PLAN_LIMITS.ARCHIVE_WARNING_THRESHOLD })}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex gap-4">
                        <button
                            onClick={() => onClose()}
                            className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-[11px] font-black text-app-text hover:bg-glass-hover transition-all cursor-pointer uppercase tracking-widest active:scale-95"
                        >
                            {t('new_plan.cancel_button')}
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!title.trim() || isBlocked}
                            className={clsx(
                                "flex-[2] py-3.5 rounded-2xl text-[11px] font-black transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95",
                                title.trim() && !isBlocked
                                    ? "bg-app-text text-app-bg hover:opacity-80"
                                    : "bg-glass-card/40 text-app-text-muted cursor-not-allowed opacity-40 grayscale"
                            )}
                        >
                            {t('new_plan.create_button')}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};
