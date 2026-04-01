import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeClose } from '../hooks/useEscapeClose';
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
import { useAuthStore } from '../store/useAuthStore';
import { getTemplate } from '../data/templateLoader';
import { PLAN_LIMITS } from '../types/firebase';
import { LoginModal } from './LoginModal';
import { X, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface NewPlanModalProps {
    isOpen: boolean;
    onClose: (created?: { contentId: string | null; level: ContentLevel }) => void;
}

const LEVEL_OPTIONS: ContentLevel[] = [100, 90, 80, 70];
const CATEGORY_OPTIONS: ContentCategory[] = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];

// 零式・絶はドロップダウンから選択、それ以外は自由入力
const hasContentRegistry = (cat: ContentCategory | null): cat is 'savage' | 'ultimate' =>
    cat === 'savage' || cat === 'ultimate';

export const NewPlanModal: React.FC<NewPlanModalProps> = ({ isOpen, onClose }) => {
    useEscapeClose(isOpen, () => onClose());
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'en' ? 'en' : 'ja';

    const { plans, addPlan, setCurrentPlanId, updatePlan, currentPlanId: activePlanId } = usePlanStore();
    const { getSnapshot } = useMitigationStore();
    const user = useAuthStore(s => s.user);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // 件数制限チェック
    const totalPlanCount = plans.length;
    const isTotalLimitReached = totalPlanCount >= PLAN_LIMITS.MAX_TOTAL_PLANS;
    const isArchiveWarning = totalPlanCount >= PLAN_LIMITS.ARCHIVE_WARNING_THRESHOLD;

    // Selection State — レベル・カテゴリは未選択スタート
    const [level, setLevel] = useState<ContentLevel | null>(null);
    const [category, setCategory] = useState<ContentCategory | null>(null);
    const [boss, setBoss] = useState<ContentDefinition | null>(null);
    const [title, setTitle] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // モーダルが開くたびにリセット
    useEffect(() => {
        if (isOpen) {
            useTutorialStore.getState().completeEvent('create:modal-opened');
            setLevel(null);
            setCategory(null);
            setBoss(null);
            setTitle('');
        }
    }, [isOpen]);

    const titleInputRef = useRef<HTMLInputElement>(null);

    // 零式・絶の場合のみドロップダウン用のコンテンツリストを生成
    const filteredBosses = React.useMemo(() => {
        if (!level || !hasContentRegistry(category)) return [];
        const series = getSeriesByLevel(level).filter(s => s.category === category);
        return series.flatMap(s => getContentBySeries(s.id));
    }, [level, category]);

    // フィルタ変更時にbossをリセット
    useEffect(() => {
        if (boss && !filteredBosses.some(b => b.id === boss.id)) {
            setBoss(null);
        }
    }, [filteredBosses, boss]);

    // カテゴリ変更時にbossとタイトルをリセット
    useEffect(() => {
        setBoss(null);
        setTitle('');
        ;
    }, [category]);

    // ドロップダウンからボスを選択
    const handleBossSelect = (selectedBoss: ContentDefinition) => {
        setBoss(selectedBoss);
        const defaultName = selectedBoss.shortName.en || selectedBoss.shortName.ja;
        setTitle(defaultName);
        ;

        setTimeout(() => {
            if (titleInputRef.current) {
                titleInputRef.current.focus();
                titleInputRef.current.select();
            }
        }, 50);
    };

    // バリデーション
    const isLevelSelected = level !== null;
    const isCategorySelected = category !== null;
    const hasBossOrFreeInput = hasContentRegistry(category)
        ? boss !== null  // 零式・絶: ドロップダウンから選択必須
        : title.trim().length > 0;  // その他: 名前入力必須
    const canCreate = isLevelSelected && isCategorySelected && hasBossOrFreeInput && title.trim().length > 0;

    // 選択中コンテンツの件数チェック
    const contentPlanCount = boss ? plans.filter(p => p.contentId === boss.id).length : 0;
    const isContentLimitReached = boss ? contentPlanCount >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT : false;
    const isBlocked = isTotalLimitReached || isContentLimitReached;

    const handleCreate = async () => {
        if (!canCreate || isBlocked || !level) return;

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

        // 3. テンプレート読み込み（零式・絶でコンテンツ選択時のみ）
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

        // 4. contentId の決定
        // 零式・絶: 既存のコンテンツID / それ以外: ユーザー入力名をそのまま使う
        const contentId = boss?.id || (hasContentRegistry(category) ? null : title.trim());

        // 5. プラン保存
        const newPlanId = `plan_${Date.now()}`;
        addPlan({
            id: newPlanId,
            ownerId: 'local',
            ownerDisplayName: 'Guest',
            contentId,
            category: category!,
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
        useTutorialStore.getState().completeEvent('content:selected');
        useTutorialStore.getState().completeEvent('create:plan-created');

        // サイドバーに作成結果を伝える
        onClose({ contentId, level: useLevel as ContentLevel });
    };

    // Enterキーで作成
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && canCreate && !isBlocked) {
            e.preventDefault();
            handleCreate();
        }
    };

    if (!isOpen) return null;
    if (!mounted || !isOpen) return null;

    // 未入力項目の案内メッセージ
    const getMissingMessage = (): string | null => {
        if (!isLevelSelected) return t('new_plan.select_level');
        if (!isCategorySelected) return t('new_plan.select_category');
        if (hasContentRegistry(category) && !boss) return t('new_plan.select_content');
        if (!title.trim()) return t('new_plan.enter_name');
        return null;
    };
    const missingMessage = getMissingMessage();

    return (<>
        {createPortal(
        <AnimatePresence mode="wait">
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onClose()}
                    className="absolute inset-0 bg-black/50 backdrop-blur-[2px] cursor-pointer"
                />

                <motion.div
                    data-tutorial-modal
                    initial={{ scale: 0.9, opacity: 0, y: 30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 30 }}
                    className="relative w-full max-w-[440px] glass-tier3 rounded-2xl shadow-sm overflow-hidden flex flex-col pointer-events-auto"
                    style={{ maxHeight: 'min(720px, calc(100vh - 64px))' }}
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                        <h2 className="text-[18px] font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                            <span className="w-1.5 h-4 bg-app-text rounded-full" />
                            {t('new_plan.modal_title')}
                        </h2>
                        <button
                            data-tutorial="new-plan-close"
                            onClick={() => onClose()}
                            className="p-2 rounded-full text-app-text border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 space-y-7 overflow-y-auto no-scrollbar">
                        {/* Level Tabs */}
                        <div className="space-y-3.5">
                            <label className="text-[11px] font-black text-app-text uppercase tracking-[0.25em] pl-1">
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
                                            "flex-1 py-2 rounded-lg text-[13px] font-black transition-all duration-300 cursor-pointer",
                                            level === l
                                                ? "bg-app-text text-app-bg shadow-lg scale-[1.02]"
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
                            <label className="text-[11px] font-black text-app-text uppercase tracking-[0.25em] pl-1">
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
                                            "whitespace-nowrap px-6 py-2.5 rounded-full text-[13px] font-black transition-all border cursor-pointer",
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

                        {/* 零式・絶: コンテンツ一覧（フラットリスト） */}
                        {hasContentRegistry(category) && (
                            <div className="space-y-3.5">
                                <label className="text-[11px] font-black text-app-text uppercase tracking-[0.25em] pl-1">
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
                                                        "w-full px-4 py-3 rounded-xl text-[13px] font-black transition-all border cursor-pointer text-left active:scale-[0.98]",
                                                        boss?.id === b.id
                                                            ? "bg-app-text text-app-bg border-app-text"
                                                            : "bg-glass-card/30 text-app-text border-glass-border/40 hover:bg-glass-hover"
                                                    )}
                                                >
                                                    {b.name[lang] || b.name.ja}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-app-text-muted text-center py-6 italic opacity-60">
                                            {t('new_plan.no_matches')}
                                        </p>
                                    )
                                ) : (
                                    <p className="text-[11px] text-app-text-muted text-center py-6 italic opacity-60">
                                        {t('new_plan.select_level_first')}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* 零式・絶: プラン名入力 */}
                        {hasContentRegistry(category) && boss && (
                            <div className="space-y-3.5">
                                <label className="text-[11px] font-black text-app-text uppercase tracking-[0.25em] pl-1">
                                    {t('new_plan.plan_name_label')}
                                </label>
                                <input
                                    ref={titleInputRef}
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    placeholder={t('new_plan.plan_name_placeholder')}
                                    className="w-full px-5 py-4 bg-glass-card/40 border border-glass-border/30 rounded-2xl text-[13px] focus:outline-none focus:border-app-text focus:ring-4 ring-app-text/10 transition-all font-black placeholder:text-app-text-muted/30"
                                />
                            </div>
                        )}

                        {/* ダンジョン・レイド・その他: 名前入力のみ */}
                        {category !== null && !hasContentRegistry(category) && (
                            <div className="space-y-3.5">
                                <label className="text-[11px] font-black text-app-text uppercase tracking-[0.25em] pl-1">
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
                                    className="w-full px-5 py-4 bg-glass-card/40 border border-glass-border/30 rounded-2xl text-[13px] focus:outline-none focus:border-app-text focus:ring-4 ring-app-text/10 transition-all font-black placeholder:text-app-text-muted/30"
                                />
                            </div>
                        )}
                    </div>

                    {/* 件数制限の警告 */}
                    {(isBlocked || isArchiveWarning) && (
                        <div className="px-6 pb-2">
                            <div className={clsx(
                                "flex items-start gap-2 p-3 rounded-xl text-[11px] border",
                                isBlocked
                                    ? "bg-app-red-dim border-app-red-border text-app-red"
                                    : "bg-app-amber-dim border-app-amber-border text-app-amber"
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
                    <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex flex-col gap-3">
                        {/* 非ログイン時のさりげない案内 */}
                        {!user && (
                            <p className="text-[10px] text-app-text-muted text-center leading-relaxed">
                                {t('new_plan.guest_hint')
                                    .split(/<\/?login>/)
                                    .map((part, i) =>
                                        i === 1 ? (
                                            <button
                                                key="login"
                                                onClick={() => setShowLoginModal(true)}
                                                className="underline hover:text-app-text transition-colors cursor-pointer"
                                            >
                                                {part}
                                            </button>
                                        ) : (
                                            <span key={i}>{part}</span>
                                        )
                                    )}
                            </p>
                        )}
                        {/* 未入力項目の案内 */}
                        {missingMessage && !isBlocked && (
                            <p className="text-[10px] text-app-text-muted text-center">{missingMessage}</p>
                        )}
                        <div className="flex gap-4">
                            <button
                                onClick={() => onClose()}
                                className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-[13px] font-black text-app-text hover:bg-glass-hover transition-all cursor-pointer uppercase tracking-widest active:scale-95"
                            >
                                {t('new_plan.cancel_button')}
                            </button>
                            <button
                                data-tutorial="create-plan-btn"
                                onClick={handleCreate}
                                disabled={!canCreate || isBlocked}
                                className={clsx(
                                    "flex-[2] py-3.5 rounded-2xl text-[13px] font-bold transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95",
                                    canCreate && !isBlocked
                                        ? "bg-app-blue text-white hover:bg-app-blue-hover"
                                        : "bg-glass-card/40 text-app-text-muted cursor-not-allowed opacity-40 grayscale"
                                )}
                            >
                                {t('new_plan.create_button')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
        )}
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>);
};
