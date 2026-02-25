import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMitigationStore } from '../store/useMitigationStore';
import { useThemeStore } from '../store/useThemeStore';
import { SKILL_DATA, calculateHpValue, calculatePotencyValue, calculateCriticalValue } from '../utils/calculator';
import { Shield, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface PartyStatusPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLElement>;
}

interface FormattedNumberInputProps {
    value: number;
    onChange: (value: number) => void;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    className?: string;
    placeholder?: string;
}

const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({ value, onChange, onFocus, className, placeholder }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/,/g, '');
        if (rawValue === '' || /^-?\d*$/.test(rawValue)) {
            onChange(Number(rawValue));
        }
    };

    return (
        <input
            type="text"
            value={value.toLocaleString()}
            onChange={handleChange}
            onFocus={onFocus}
            className={className}
            placeholder={placeholder}
        />
    );
};

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

    if (!isOpen || !mounted) return null;

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
                    "absolute top-0 left-0 h-full w-[340px] max-w-full bg-glass-panel border-r border-glass-border shadow-glass flex flex-col transition-transform duration-300 ease-out glass-panel overflow-y-auto",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="p-4 flex-1">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-3 border-b border-white/[0.03] pb-2">
                        <h3 className="text-app-text-primary font-bold flex items-center gap-2 text-xs uppercase tracking-wider">
                            <Shield size={14} className="text-app-accent-primary" />
                            {t('party.settings_title')}
                        </h3>
                        <button onClick={onClose} className="text-app-text-muted hover:text-app-text-primary transition-colors">
                            <X size={14} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {/* Role Settings Group */}
                        <div className="space-y-2">
                            {/* Tank Settings */}
                            <div className="bg-blue-500/[0.03] border border-blue-500/10 rounded-lg p-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                                        <h4 className="text-[9px] font-bold text-blue-200 uppercase tracking-wider opacity-90">TANK</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[9px] uppercase tracking-wider text-app-text-muted">HP</label>
                                        <FormattedNumberInput
                                            value={tankRep?.stats.hp || 0}
                                            onChange={(val) => updateTankHP(val)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-20 bg-black/40 border border-white/5 rounded px-1.5 py-0.5 text-right text-app-text-primary text-[10px] focus:border-blue-500/30 focus:outline-none focus:ring-1 focus:ring-blue-500/10 font-mono transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Healer Settings */}
                            <div className="bg-green-500/[0.03] border border-green-500/10 rounded-lg p-2">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                                    <h4 className="text-[9px] font-bold text-green-200 uppercase tracking-wider opacity-90">HEALER</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[9px] uppercase tracking-wider text-app-text-muted">HP</label>
                                        <FormattedNumberInput
                                            value={healerRep?.stats.hp || 0}
                                            onChange={(val) => updateHealerHP(val)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-20 bg-black/40 border border-white/5 rounded px-1.5 py-0.5 text-right text-app-text-primary text-[10px] focus:border-green-500/30 focus:outline-none focus:ring-1 focus:ring-green-500/10 font-mono transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[9px] uppercase tracking-wider text-app-text-muted">WD</label>
                                        <FormattedNumberInput
                                            value={healerRep?.stats.wd || 0}
                                            onChange={(val) => updateHealerStats({ wd: val })}
                                            onFocus={(e) => e.target.select()}
                                            className="w-20 bg-black/40 border border-white/5 rounded px-1.5 py-0.5 text-right text-app-text-primary text-[10px] focus:border-green-500/30 focus:outline-none focus:ring-1 focus:ring-green-500/10 font-mono transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[9px] uppercase tracking-wider text-app-text-muted">MND</label>
                                        <FormattedNumberInput
                                            value={healerRep?.stats.mainStat || 0}
                                            onChange={(val) => updateHealerStats({ mainStat: val })}
                                            onFocus={(e) => e.target.select()}
                                            className="w-20 bg-black/40 border border-white/5 rounded px-1.5 py-0.5 text-right text-app-text-primary text-[10px] focus:border-green-500/30 focus:outline-none focus:ring-1 focus:ring-green-500/10 font-mono transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[9px] uppercase tracking-wider text-app-text-muted">DET</label>
                                        <FormattedNumberInput
                                            value={healerRep?.stats.det || 0}
                                            onChange={(val) => updateHealerStats({ det: val })}
                                            onFocus={(e) => e.target.select()}
                                            className="w-20 bg-black/40 border border-white/5 rounded px-1.5 py-0.5 text-right text-app-text-primary text-[10px] focus:border-green-500/30 focus:outline-none focus:ring-1 focus:ring-green-500/10 font-mono transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Skill Value Preview List */}
                        <div className="space-y-1 border-t border-white/[0.03] pt-2">
                            <h4 className="text-[9px] uppercase tracking-widest text-app-text-muted font-bold px-1 mb-1">{t('settings.shield_preview')}</h4>

                            <div className="space-y-1">
                                {/* Top Row: Tank (4 cols) and DPS (2 cols) */}
                                <div className="flex gap-1">
                                    {/* Tank Group */}
                                    <div className="flex-[4]">
                                        <h5 className="text-[8px] font-bold text-blue-400 opacity-80 pl-1 mb-0.5">TANK</h5>
                                        <div className="grid grid-cols-4 gap-1">
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
                                        <h5 className="text-[8px] font-bold text-red-400 opacity-80 pl-1 mb-0.5">DPS</h5>
                                        <div className="grid grid-cols-2 gap-1">
                                            {[
                                                "インプロビゼーション",
                                                "テンペラグラッサ",
                                            ].map(skillName => renderSkillItem(skillName, tankRep, healerRep, contentLanguage))}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Row: Healer (6 cols) */}
                                <div>
                                    <h5 className="text-[8px] font-bold text-green-400 opacity-80 pl-1 mb-0.5">HEALER</h5>
                                    <div className="grid grid-cols-6 gap-1">
                                        {[
                                            "ディヴァインカレス",
                                            "秘策：展開戦術",
                                            "コンソレイション",
                                            "アクセッション",
                                            "ホーリズム",
                                            "パンハイマ",
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
            className="flex flex-col items-center justify-center bg-white/[0.03] border border-white/[0.05] rounded py-1 px-1 hover:bg-white/[0.08] transition-colors gap-0.5 min-w-0"
            title={displayName}
        >
            {iconUrl ? (
                <img src={iconUrl} alt={displayName} className="w-[20px] h-[20px] rounded-sm opacity-90" />
            ) : (
                <div className="w-[20px] h-[20px] bg-slate-900/ dark:bg-white/ rounded-sm flex items-center justify-center text-[9px] text-slate-800 dark:text-white/50">?</div>
            )}
            <span className="font-mono text-app-accent-primary font-bold text-[9px] tracking-tight leading-none">
                {value.toLocaleString()}
            </span>
        </div>
    );
};
