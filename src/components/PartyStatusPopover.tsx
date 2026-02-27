import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMitigationStore } from '../store/useMitigationStore';
import { useThemeStore } from '../store/useThemeStore';
import { SKILL_DATA, calculateHpValue, calculatePotencyValue, calculateCriticalValue } from '../utils/calculator';
import { Shield, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { FormattedNumberInput } from './ui/FormattedNumberInput';

interface PartyStatusPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLElement>;
}

export const PartyStatusPopover: React.FC<PartyStatusPopoverProps> = ({ isOpen, onClose }) => {
    const { partyMembers, updateMemberStats } = useMitigationStore();
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
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

    //if (!isOpen || !mounted) return null;
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

    // Representative members for input values
    const tankRep = partyMembers.find(m => m.role === 'tank');
    const healerRep = partyMembers.find(m => m.role === 'healer');

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[9999]",
            isOpen ? "pointer-events-auto" : "pointer-events-none"
        )}>
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-glass-panel backdrop-blur-sm transition-opacity duration-300 ease-out",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />

            {/* Slide-Over Panel */}
            <div
                ref={popoverRef}
                className={clsx(
                    "absolute top-0 left-0 h-full w-[340px] max-w-full bg-glass-panel backdrop-blur-xl border-r border-glass-border shadow-glass flex flex-col transition-transform duration-300 ease-out overflow-y-auto",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-glass-border bg-glass-header flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <Shield className="text-blue-500" size={16} />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold text-app-text tracking-wider">{t('party.settings_title', 'パラメータ設定')}</h2>
                            <p className="text-[9px] text-app-text-muted mt-0.5">
                                バリアやヒールの基準となる数値を設定します
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-app-text-muted hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
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
                                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                                    <h4 className="text-xs font-bold text-blue-200 uppercase tracking-wider opacity-90">TANK</h4>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-[10px] uppercase tracking-wider text-app-text-muted font-bold">HP</label>
                                    <FormattedNumberInput
                                        value={tankRep?.stats.hp || 0}
                                        onChange={(val) => updateTankHP(val)}
                                        className="w-24 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-right text-app-text font-mono text-xs hover:border-white/20 focus:border-app-accent focus:bg-black/40 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Healer Settings */}
                        <div className="bg-glass-card border border-glass-border rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                                <h4 className="text-xs font-bold text-green-200 uppercase tracking-wider opacity-90">HEALER</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] uppercase tracking-wider text-app-text-muted font-bold">HP</label>
                                    <FormattedNumberInput
                                        value={healerRep?.stats.hp || 0}
                                        onChange={(val) => updateHealerHP(val)}
                                        className="w-20 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-right text-app-text font-mono text-xs hover:border-white/20 focus:border-app-accent focus:bg-black/40 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] uppercase tracking-wider text-app-text-muted font-bold">WD</label>
                                    <FormattedNumberInput
                                        value={healerRep?.stats.wd || 0}
                                        onChange={(val) => updateHealerStats({ wd: val })}
                                        className="w-20 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-right text-app-text font-mono text-xs hover:border-white/20 focus:border-app-accent focus:bg-black/40 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] uppercase tracking-wider text-app-text-muted font-bold">MND</label>
                                    <FormattedNumberInput
                                        value={healerRep?.stats.mainStat || 0}
                                        onChange={(val) => updateHealerStats({ mainStat: val })}
                                        className="w-20 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-right text-app-text font-mono text-xs hover:border-white/20 focus:border-app-accent focus:bg-black/40 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] uppercase tracking-wider text-app-text-muted font-bold">DET</label>
                                    <FormattedNumberInput
                                        value={healerRep?.stats.det || 0}
                                        onChange={(val) => updateHealerStats({ det: val })}
                                        className="w-20 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-right text-app-text font-mono text-xs hover:border-white/20 focus:border-app-accent focus:bg-black/40 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Skill Value Preview List */}
                    <div className="pt-2">
                        <h4 className="text-[10px] uppercase tracking-widest text-app-text-muted font-bold mb-2">{t('settings.shield_preview', 'シールド・ヒール量 プレビュー')}</h4>

                        <div className="space-y-3">
                            {/* Top Row: Tank (4 cols) and DPS (2 cols) */}
                            <div className="flex gap-2">
                                {/* Tank Group */}
                                <div className="flex-[4]">
                                    <h5 className="text-[9px] font-bold text-blue-400 opacity-80 mb-1">TANK</h5>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {[
                                            "ディヴァインヴェール",
                                            "シェイクオフ",
                                            "原初の血気",
                                            "ブラックナイト",
                                        ].map(skillName => renderSkillItem(skillName, tankRep, healerRep, contentLanguage))}
                                    </div>
                                </div>
                                {/* DPS Group */}
                                <div className="flex-[2]">
                                    <h5 className="text-[9px] font-bold text-red-400 opacity-80 mb-1">DPS</h5>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {[
                                            "インプロビゼーション",
                                            "テンペラグラッサ",
                                        ].map(skillName => renderSkillItem(skillName, tankRep, healerRep, contentLanguage))}
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Row: Healer (6 cols) */}
                            <div>
                                <h5 className="text-[9px] font-bold text-green-400 opacity-80 mb-1">HEALER</h5>
                                <div className="grid grid-cols-6 gap-1.5 mb-1.5">
                                    {[
                                        "ディヴァインカレス",
                                        "秘策：展開戦術",
                                        "コンソレイション",
                                        "アクセッション",
                                        "ホーリズム",
                                        "パンハイマ",
                                    ].map(skillName => renderSkillItem(skillName, tankRep, healerRep, contentLanguage))}
                                </div>
                                <div className="grid grid-cols-6 gap-1.5">
                                    {[
                                        "鼓舞激励の策",
                                        "意気軒昂の策",
                                        "エウクラシア・プログノシスII",
                                    ].map(skillName => renderSkillItem(skillName, tankRep, healerRep, contentLanguage))}
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

const renderSkillItem = (skillName: string, tankRep: any, healerRep: any, contentLanguage: 'ja' | 'en' = 'ja') => {
    const skill = SKILL_DATA[skillName as keyof typeof SKILL_DATA];
    if (!skill) return null;

    const isTankSkill = ['pld', 'war', 'drk', 'gnb'].some(job => skill.jobs?.includes(job));
    const stats = isTankSkill ? tankRep?.stats : healerRep?.stats;

    if (!stats) return null;

    let value = 0;
    if (skill.type === 'hp' && 'percent' in skill) {
        value = calculateHpValue(stats.hp, skill.percent || 0);
    } else if (skill.type === 'potency' && 'potency' in skill) {
        let base = calculatePotencyValue(stats, skill.potency || 0, isTankSkill ? 'tank' : 'healer');
        const multiplier = 'multiplier' in skill ? skill.multiplier : undefined;
        if (multiplier) base = Math.floor(base * multiplier);
        if ((skill as any).isCrit) base = calculateCriticalValue(base);
        value = base;
    }

    const iconUrl = (skill as any).icon ? `/icons/${(skill as any).icon}` : null;
    const displayName = contentLanguage === 'en' && (skill as any).nameEn ? (skill as any).nameEn : skillName;

    return (
        <div
            key={skillName}
            className="flex flex-col items-center justify-center bg-glass-card hover:bg-glass-hover border border-glass-border rounded-lg p-1.5 transition-colors gap-1 min-w-0"
            title={displayName}
        >
            {iconUrl ? (
                <img src={iconUrl} alt={displayName} className="w-6 h-6 rounded-md opacity-100 drop-shadow-sm" />
            ) : (
                <div className="w-6 h-6 bg-slate-900/50 rounded-md flex items-center justify-center text-[10px] text-white/50">?</div>
            )}
            <span className="font-mono text-app-accent-primary font-bold text-[10px] tracking-tight leading-none">
                {value.toLocaleString()}
            </span>
        </div>
    );
};
