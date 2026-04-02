import React, { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useMitigationStore } from '../store/useMitigationStore';
import { useThemeStore } from '../store/useThemeStore';
import { SKILL_DATA, calculateHpValue, calculatePotencyValue, calculateCriticalValue } from '../utils/calculator';
import { useLevelModifiers } from '../hooks/useSkillsData';
import { Shield, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import clsx from 'clsx';
import { FormattedNumberInput } from './ui/FormattedNumberInput';
import { useTutorialStore } from '../store/useTutorialStore';
import { Tooltip } from './ui/Tooltip';

interface PartyStatusPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLElement>;
}

export const PartyStatusPopover: React.FC<PartyStatusPopoverProps> = ({ isOpen, onClose }) => {
    const { partyMembers, updateMemberStats, currentLevel } = useMitigationStore();
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();
    useEscapeClose(isOpen, onClose);
    const LEVEL_MODIFIERS = useLevelModifiers();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);

    // 2段階制御: mount → 次フレームで visible（transitionを効かせる）
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setVisible(true));
            });
        } else {
            setVisible(false);
            const timer = setTimeout(() => setMounted(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Tutorial: block closing the popover during the tutorial
            if (useTutorialStore.getState().isActive) return;

            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Swipe-to-dismiss for mobile bottom sheet
    const dragStartY = useRef(0);
    const isDragging = useRef(false);

    const handleSheetTouchStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
        isDragging.current = true;
    };
    const handleSheetTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current || !popoverRef.current) return;
        const dy = e.touches[0].clientY - dragStartY.current;
        if (dy > 0) {
            popoverRef.current.style.transform = `translateY(${dy}px)`;
            popoverRef.current.style.transition = 'none';
        }
    };
    const handleSheetTouchEnd = () => {
        if (!isDragging.current || !popoverRef.current) return;
        isDragging.current = false;
        const dy = parseInt(popoverRef.current.style.transform.replace(/[^-?\d]/g, '') || '0');
        if (dy > 100) {
            onClose();
        } else {
            popoverRef.current.style.transform = '';
            popoverRef.current.style.transition = 'all 0.3s cubic-bezier(0.2,0.8,0.2,1)';
        }
    };

    // Representative members for input values
    const tankRep = partyMembers.find(m => m.role === 'tank');
    const healerRep = partyMembers.find(m => m.role === 'healer');

    // プレビュー対象スキル名（SKILL_DATAのキー = 日本語名）
    const PREVIEW_SKILLS = {
        tank: ["ディヴァインヴェール", "シェイクオフ", "原初の血気", "ブラックナイト"],
        dps: ["インプロビゼーション", "テンペラグラッサ"],
        healerTop: ["ディヴァインカレス", "秘策：展開戦術", "コンソレイション", "アクセッション", "ホーリズム", "パンハイマ"],
        healerBottom: ["鼓舞激励の策", "意気軒高の策", "士気高揚の策", "エウクラシア・プログノシスII", "エウクラシア・プログノシス", "アスペクト・ヘリオス (Nセクト)", "コンジャンクション・ヘリオス (Nセクト)"],
    };

    // スキル計算はステータスが変わった時だけ実行（パネル開閉では再計算しない）
    const skillPreviews = useMemo(() => {
        const compute = (skillName: string) => {
            const skill = SKILL_DATA[skillName as keyof typeof SKILL_DATA] as any;
            if (!skill) return null;
            if (skill.minLevel && currentLevel < skill.minLevel) return null;
            if (skill.maxLevel && currentLevel > skill.maxLevel) return null;

            const isTankSkill = ['pld', 'war', 'drk', 'gnb'].some(job => skill.jobs?.includes(job));
            const stats = isTankSkill ? tankRep?.stats : healerRep?.stats;
            if (!stats) return null;

            let value = 0;
            if (skill.type === 'hp' && 'percent' in skill) {
                value = calculateHpValue(stats.hp, skill.percent || 0);
            } else if (skill.type === 'potency' && 'potency' in skill) {
                let base = calculatePotencyValue(stats, skill.potency || 0, isTankSkill ? 'tank' : 'healer', LEVEL_MODIFIERS[currentLevel]);
                const multiplier = 'multiplier' in skill ? skill.multiplier : undefined;
                if (multiplier) base = Math.floor(base * multiplier);
                if ((skill as any).isCrit) base = calculateCriticalValue(base);
                value = base;
            }

            const iconUrl = (skill as any).icon ? `/icons/${(skill as any).icon}` : null;
            const nameEn = (skill as any).nameEn || skillName;
            return { key: skillName, value, iconUrl, nameJa: skillName, nameEn };
        };

        return {
            tank: PREVIEW_SKILLS.tank.map(compute).filter(Boolean),
            dps: PREVIEW_SKILLS.dps.map(compute).filter(Boolean),
            healerTop: PREVIEW_SKILLS.healerTop.map(compute).filter(Boolean),
            healerBottom: PREVIEW_SKILLS.healerBottom.map(compute).filter(Boolean),
        };
    }, [tankRep?.stats.hp, healerRep?.stats.hp, healerRep?.stats.mainStat, healerRep?.stats.det, healerRep?.stats.wd, currentLevel, contentLanguage]);

    if (!mounted) return null;

    // Helper for batch updates
    const updateTankHP = (val: number) => {
        partyMembers.forEach(m => {
            if (m.role === 'tank') updateMemberStats(m.id, { hp: val });
        });
    };

    const updateHealerHP = (val: number) => {
        partyMembers.forEach(m => {
            if (m.role === 'healer' || m.role === 'dps') updateMemberStats(m.id, { hp: val });
        });
    };

    const updateHealerStats = (stats: { mainStat?: number; det?: number; wd?: number }) => {
        partyMembers.forEach(m => {
            if (m.role === 'healer') updateMemberStats(m.id, stats);
        });
    };

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[9999]",
            visible ? "pointer-events-auto" : "pointer-events-none"
        )}>
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 transition-opacity duration-300 ease-out",
                    visible ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />

            {/* Slide-Over Panel — Left on PC, Bottom on Mobile */}
            <div
                ref={popoverRef}
                className={clsx(
                    "glass-tier3 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] overflow-y-auto",
                    // PC: left slide-over
                    "md:absolute md:top-0 md:left-0 md:h-full md:w-[450px] md:max-w-full md:border-r",
                    visible ? "md:translate-x-0" : "md:-translate-x-full",
                    // Mobile: bottom sheet
                    "max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:max-h-[65vh] max-md:rounded-t-2xl max-md:border-t max-md:pb-20",
                    visible ? "max-md:translate-y-0" : "max-md:translate-y-full"
                )}
            >
                {/* Mobile drag handle */}
                <div
                    className="md:hidden flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
                    onTouchStart={handleSheetTouchStart}
                    onTouchMove={handleSheetTouchMove}
                    onTouchEnd={handleSheetTouchEnd}
                >
                    <div className="w-10 h-1 rounded-full bg-app-border" />
                </div>

                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-glass-border bg-glass-header flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-app-text/10 rounded-xl">
                            <Shield className="text-app-text" size={16} />
                        </div>
                        <div>
                            <h2 className="text-app-lg font-bold text-app-text tracking-wider">{t('party.settings_title', 'パラメータ設定')}</h2>
                            <p className="text-app-sm text-app-text-sec mt-0.5 whitespace-pre-line">
                                {t('party.settings_desc')}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-app-text p-1.5 rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 flex-1 space-y-4">


                    {/* Role Settings Group */}
                    <div className="space-y-3">
                        {/* Tank Settings */}
                        <div className="bg-glass-card border border-glass-border rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    <h4 className="text-app-lg font-bold text-blue-700 dark:text-blue-100 uppercase tracking-wider">TANK</h4>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-app-base uppercase tracking-wider text-app-text font-bold">HP</label>
                                    <FormattedNumberInput
                                        value={tankRep?.stats.hp || 0}
                                        onChange={(val) => updateTankHP(val)}
                                        className="w-24 bg-app-surface2 border border-app-border rounded-lg px-2 py-1 text-right text-app-text font-mono text-app-lg hover:border-app-border focus:border-app-accent focus:bg-app-surface2 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Healer Settings */}
                        <div className="bg-glass-card border border-glass-border rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <h4 className="text-app-lg font-bold text-green-700 dark:text-green-100 uppercase tracking-wider">HEALER</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-app-base uppercase tracking-wider text-app-text font-bold">HP</label>
                                    <FormattedNumberInput
                                        value={healerRep?.stats.hp || 0}
                                        onChange={(val) => updateHealerHP(val)}
                                        className="w-20 bg-app-surface2 border border-app-border rounded-lg px-2 py-1 text-right text-app-text font-mono text-app-lg hover:border-app-border focus:border-app-accent focus:bg-app-surface2 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-app-base uppercase tracking-wider text-app-text font-bold">WD</label>
                                    <FormattedNumberInput
                                        value={healerRep?.stats.wd || 0}
                                        onChange={(val) => updateHealerStats({ wd: val })}
                                        className="w-20 bg-app-surface2 border border-app-border rounded-lg px-2 py-1 text-right text-app-text font-mono text-app-lg hover:border-app-border focus:border-app-accent focus:bg-app-surface2 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-app-base uppercase tracking-wider text-app-text font-bold">MND</label>
                                    <FormattedNumberInput
                                        value={healerRep?.stats.mainStat || 0}
                                        onChange={(val) => updateHealerStats({ mainStat: val })}
                                        className="w-20 bg-app-surface2 border border-app-border rounded-lg px-2 py-1 text-right text-app-text font-mono text-app-lg hover:border-app-border focus:border-app-accent focus:bg-app-surface2 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-app-base uppercase tracking-wider text-app-text font-bold">DET</label>
                                    <FormattedNumberInput
                                        value={healerRep?.stats.det || 0}
                                        onChange={(val) => updateHealerStats({ det: val })}
                                        className="w-20 bg-app-surface2 border border-app-border rounded-lg px-2 py-1 text-right text-app-text font-mono text-app-lg hover:border-app-border focus:border-app-accent focus:bg-app-surface2 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Skill Value Preview List（useMemoでステータス変更時のみ再計算） */}
                    <div className="pt-2">
                        <h4 className="text-app-base uppercase tracking-widest text-app-text font-bold mb-2">{t('settings.shield_preview', 'シールド・ヒール量 プレビュー')}</h4>

                        <div className="space-y-3">
                            {/* Top Row: Tank (4 cols) and DPS (2 cols) */}
                            <div className="flex gap-2">
                                <div className="flex-[4]">
                                    <h5 className="text-app-sm font-extrabold text-blue-700 dark:text-blue-300 mb-1">TANK</h5>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {skillPreviews.tank.map((s: any) => (
                                            <SkillPreviewItem key={s.key} item={s} contentLanguage={contentLanguage} />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-[2]">
                                    <h5 className="text-app-sm font-extrabold text-red-700 dark:text-red-300 mb-1">DPS</h5>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {skillPreviews.dps.map((s: any) => (
                                            <SkillPreviewItem key={s.key} item={s} contentLanguage={contentLanguage} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Row: Healer (6 cols) */}
                            <div>
                                <h5 className="text-app-sm font-extrabold text-green-700 dark:text-green-300 mb-1">HEALER</h5>
                                <div className="grid grid-cols-6 gap-1.5 mb-1.5">
                                    {skillPreviews.healerTop.map((s: any) => (
                                        <SkillPreviewItem key={s.key} item={s} contentLanguage={contentLanguage} />
                                    ))}
                                </div>
                                <div className="grid grid-cols-6 gap-1.5">
                                    {skillPreviews.healerBottom.map((s: any) => (
                                        <SkillPreviewItem key={s.key} item={s} contentLanguage={contentLanguage} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

const SkillPreviewItem: React.FC<{ item: { key: string; value: number; iconUrl: string | null; nameJa: string; nameEn: string }; contentLanguage: 'ja' | 'en' }> = ({ item, contentLanguage }) => {
    const displayName = contentLanguage === 'en' ? item.nameEn : item.nameJa;
    return (
        <div className="flex flex-col items-center justify-center bg-glass-card hover:bg-glass-hover border border-glass-border rounded-lg p-1.5 transition-colors gap-1 min-w-0">
            <Tooltip content={displayName}>
                <div className="flex flex-col items-center gap-1">
                    {item.iconUrl ? (
                        <img src={item.iconUrl} alt={displayName} className="w-6 h-6 rounded-md opacity-100 drop-shadow-sm" />
                    ) : (
                        <div className="w-6 h-6 bg-app-surface2 rounded-md flex items-center justify-center text-app-base text-app-text-muted">?</div>
                    )}
                    <span className="font-mono text-app-text font-bold text-app-base tracking-tight leading-none">
                        {item.value.toLocaleString()}
                    </span>
                </div>
            </Tooltip>
        </div>
    );
};
