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
import { X, ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

interface NewPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LEVEL_OPTIONS: ContentLevel[] = [100, 90, 80, 70];
const CATEGORY_OPTIONS: ContentCategory[] = ['savage', 'ultimate', 'raid', 'dungeon'];

export const NewPlanModal: React.FC<NewPlanModalProps> = ({ isOpen, onClose }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language === 'en' ? 'en' : 'ja';

    const { addPlan, setCurrentPlanId, updatePlan, currentPlanId: activePlanId } = usePlanStore();
    const { getSnapshot, loadSnapshot } = useMitigationStore();

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
        const bossName = selectedBoss.name[lang] || selectedBoss.name.ja;
        setTitle(bossName);
        setIsDropdownOpen(false);
        
        // Short delay to ensure title is set before focus
        setTimeout(() => {
            if (titleInputRef.current) {
                titleInputRef.current.focus();
                titleInputRef.current.select();
            }
        }, 50);
    };

    const handleCreate = () => {
        if (!boss || !title.trim()) return;

        // 1. Save current plan before switching
        const currentData = getSnapshot();
        if (activePlanId) {
            updatePlan(activePlanId, { data: currentData });
        }

        // 2. Create New Plan
        const newPlanId = `plan_${Date.now()}`;
        const newPlan = {
            id: newPlanId,
            ownerId: 'local',
            ownerDisplayName: 'Guest',
            contentId: boss.id,
            title: title.trim(),
            isPublic: false,
            copyCount: 0,
            useCount: 0,
            data: {
                ...currentData, // Use current settings as base
                timelineEvents: [], // Start with empty timeline
                currentLevel: level,
                timelineMitigations: []
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        addPlan(newPlan);
        setCurrentPlanId(newPlanId);
        loadSnapshot(newPlan.data);
        
        onClose();
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
                    onClick={onClose}
                    className="absolute inset-0 bg-black/40 backdrop-blur-md cursor-pointer"
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 30 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 30 }}
                    className="relative w-full max-w-[440px] bg-glass-panel/70 backdrop-blur-2xl border border-glass-border/50 rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col pointer-events-auto"
                    style={{ maxHeight: 'min(720px, calc(100vh - 64px))' }}
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-glass-border/30 flex items-center justify-between bg-glass-header/30">
                        <h2 className="text-[13px] font-black text-app-text tracking-widest flex items-center gap-3 uppercase">
                            <span className="w-1.5 h-4 bg-app-accent rounded-full shadow-[0_0_12px_rgba(var(--app-accent-rgb),0.6)]" />
                            {t('new_plan.modal_title')}
                        </h2>
                        <button 
                            onClick={onClose} 
                            className="p-2 hover:bg-glass-hover rounded-full transition-colors text-app-text-muted hover:text-app-text cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 space-y-7 overflow-y-auto no-scrollbar">
                        {/* Level Tabs */}
                        <div className="space-y-3.5">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black text-app-text-secondary uppercase tracking-[0.25em]">
                                    {t('new_plan.level_label')}
                                </label>
                                <span className="text-[9px] font-bold text-app-accent/60 bg-app-accent/5 px-2 py-0.5 rounded-full border border-app-accent/10">REQUIRED</span>
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
                                                : "text-app-text-muted hover:text-app-text hover:bg-glass-hover"
                                        )}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category Tabs */}
                        <div className="space-y-3.5">
                            <label className="text-[10px] font-black text-app-text-secondary uppercase tracking-[0.25em] pl-1">
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
                                                ? "bg-app-accent/20 text-app-accent border-app-accent/40 shadow-[0_0_15px_rgba(var(--app-accent-rgb),0.2)]"
                                                : "bg-glass-card/30 text-app-text-muted border-glass-border/40 hover:border-glass-hover hover:text-app-text"
                                        )}
                                    >
                                        {(CATEGORY_LABELS[cat][lang] || CATEGORY_LABELS[cat].ja).toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Dropdown */}
                        <div className="space-y-3.5 relative">
                            <label className="text-[10px] font-black text-app-text-secondary uppercase tracking-[0.25em] pl-1">
                                {t('new_plan.content_label')}
                            </label>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={clsx(
                                    "w-full flex items-center justify-between px-4.5 py-4 bg-glass-card/40 border rounded-2xl text-[13px] transition-all duration-300 cursor-pointer",
                                    boss ? "text-app-text font-black" : "text-app-text-muted",
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
                                        className="absolute top-full left-0 right-0 mt-3 bg-app-bg/98 backdrop-blur-3xl border border-glass-border shadow-[0_24px_48px_rgba(0,0,0,0.8)] rounded-2xl z-[110] max-h-64 overflow-y-auto no-scrollbar p-2"
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
                                                            : "text-app-text-secondary hover:bg-white/10 hover:text-app-text"
                                                    )}
                                                >
                                                    <span className="truncate">{b.name[lang] || b.name.ja}</span>
                                                    {boss?.id === b.id && <Check size={14} className="shrink-0 ml-2" />}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="py-10 text-center text-app-text-muted italic text-[11px] opacity-60">
                                                No matches for current filters
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Plan Name */}
                        <div className="space-y-3.5">
                            <label className="text-[10px] font-black text-app-text-secondary uppercase tracking-[0.25em] pl-1">
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

                        {/* Template Guidance (Phase 4 Hint) */}
                        <div className="pt-3">
                            <div className="bg-app-accent/5 border border-app-accent/20 rounded-2xl p-5 flex flex-col gap-2.5 shadow-sm">
                                <p className="text-[10px] text-app-accent font-black tracking-[0.2em] uppercase opacity-80">
                                    {t('new_plan.template_guidance', 'Want to start from a pre-filled template?')}
                                </p>
                                <button className="text-[11px] text-app-text-secondary hover:text-app-accent transition-all font-black flex items-center gap-2 cursor-pointer group">
                                    {t('new_plan.browse_templates', 'Browse Templates')} 
                                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-glass-card/10 border-t border-glass-border/20 flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-2xl border border-glass-border/40 text-[11px] font-black text-app-text-muted hover:bg-glass-hover hover:text-app-text transition-all cursor-pointer uppercase tracking-widest active:scale-95"
                        >
                            {t('new_plan.cancel_button')}
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!boss || !title.trim()}
                            className={clsx(
                                "flex-[2] py-3.5 rounded-2xl text-[11px] font-black transition-all cursor-pointer uppercase tracking-[0.3em] active:scale-95",
                                boss && title.trim()
                                    ? "bg-app-accent text-app-text-on-accent shadow-[0_12px_24px_-4px_rgba(var(--app-accent-rgb),0.4)] hover:brightness-110"
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
