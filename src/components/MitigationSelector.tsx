import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { MITIGATIONS, getMitigationPriority } from '../data/mockData';
import type { Mitigation, AppliedMitigation } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { getAetherflowStacks, getAddersgallStacks, canUseSummonSeraph, getRemainingCharges, isFairyAvailable } from '../utils/resourceTracker';
import { useMitigationStore } from '../store/useMitigationStore';

interface MitigationSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mitigation: Mitigation) => void;
    jobId: string | null;
    position: { x: number; y: number };
    activeMitigations?: AppliedMitigation[];
    selectedTime?: number;
    schAetherflowPattern?: 1 | 2;
}

export const MitigationSelector: React.FC<MitigationSelectorProps> = ({ isOpen, onClose, onSelect, jobId, position, activeMitigations = [], selectedTime = 0, schAetherflowPattern = 1 }) => {
    const { contentLanguage } = useThemeStore();
    const { t } = useTranslation();

    const panelRef = React.useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = React.useState(position);

    // 2-step selection state
    const [selectedSingleTargetMit, setSelectedSingleTargetMit] = React.useState<Mitigation | null>(null);
    const { partyMembers } = useMitigationStore();

    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    React.useEffect(() => {
        if (!isOpen || !panelRef.current) {
            setAdjustedPos(position);
            return;
        }
        if (isMobile) return; // Position handled by CSS on mobile

        requestAnimationFrame(() => {
            if (!panelRef.current) return;
            const rect = panelRef.current.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let x = position.x;
            let y = position.y;
            if (y + rect.height > vh - 8) {
                y = Math.max(8, vh - rect.height - 8);
            }
            if (x + rect.width > vw - 8) {
                x = Math.max(8, vw - rect.width - 8);
            }
            setAdjustedPos({ x, y });
        });
    }, [isOpen, position, isMobile]);

    // Close on click outside (without blocking scroll)
    React.useEffect(() => {
        if (!isOpen) {
            setSelectedSingleTargetMit(null);
            return;
        }
        const handleMouseDown = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const allJobMitigations = jobId ? MITIGATIONS.filter(m => m.jobId === jobId) : [];

    // Check resource availability for a mitigation
    const getResourceStatus = (m: Mitigation): { available: boolean; warning?: boolean; message?: string; badge?: string; badgeColor?: string } => {
        // Fairy-dependent skill restrictions (Dissipation dismisses fairy)
        if (m.id === 'fey_illumination' && !isFairyAvailable(selectedTime, activeMitigations)) {
            return { available: false, message: t('mitigation.unavailable_dissipation', 'Unavailable (Dissipation)') };
        }
        if (m.id === 'summon_seraph' && !canUseSummonSeraph(selectedTime, activeMitigations)) {
            return { available: false, message: t('mitigation.unavailable_dissipation_dup', 'Unavailable (Dissipation)') };
        }

        // Resource cost check (Aetherflow / Addersgall)
        if (m.resourceCost) {
            let stacks = 0;
            if (m.resourceCost.type === 'aetherflow') {
                stacks = getAetherflowStacks(selectedTime, schAetherflowPattern, activeMitigations);
            } else if (m.resourceCost.type === 'addersgall') {
                stacks = getAddersgallStacks(selectedTime, activeMitigations);
            }
            const badge = `×${stacks}`;
            if (stacks < m.resourceCost.amount) {
                const label = m.resourceCost.type === 'aetherflow'
                    ? t('mitigation.no_aetherflow', 'No Aetherflow')
                    : t('mitigation.no_addersgall', 'No Addersgall');
                return { available: false, message: label, badge, badgeColor: 'red' };
            }
            // Resource available but still check cooldown below
        }

        // Charge check (maxCharges) — charge system handles cooldown internally
        if (m.maxCharges) {
            const remaining = getRemainingCharges(m.id, selectedTime, activeMitigations);
            const badge = `${remaining}/${m.maxCharges}`;
            if (remaining <= 0) {
                const label = t('mitigation.no_charges', 'No charges');
                return { available: false, message: label, badge, badgeColor: 'red' };
            }
            return { available: true, badge, badgeColor: remaining <= 1 ? 'amber' : 'cyan' };
        }

        // Cooldown check (non-charge skills only)
        const sameSkillUses = activeMitigations
            .filter(am => am.mitigationId === m.id)
            .sort((a, b) => a.time - b.time);

        if (sameSkillUses.length > 0) {
            // Forward check: is the skill still on cooldown from a previous use?
            const prevUses = sameSkillUses.filter(u => u.time < selectedTime);
            if (prevUses.length > 0) {
                const lastPrev = prevUses[prevUses.length - 1];
                const cdEnd = lastPrev.time + m.cooldown;
                if (selectedTime < cdEnd) {
                    const remaining = Math.ceil(cdEnd - selectedTime);
                    const label = t('mitigation.cd_remaining', { seconds: remaining, defaultValue: `CD ${remaining}s` });
                    return { available: false, message: label };
                }
            }

            // Backward check: would this placement's cooldown overlap with a future use?
            const nextUses = sameSkillUses.filter(u => u.time > selectedTime);
            if (nextUses.length > 0) {
                const firstNext = nextUses[0];
                if (selectedTime + m.cooldown > firstNext.time) {
                    const gap = Math.floor(firstNext.time - selectedTime);
                    const label = t('mitigation.next_at', { time: firstNext.time, gap, defaultValue: `Next at ${firstNext.time}s (${gap}s gap)` });
                    // Get resource badge if applicable
                    const resourceBadge = m.resourceCost ? (() => {
                        let stacks = 0;
                        if (m.resourceCost!.type === 'aetherflow') stacks = getAetherflowStacks(selectedTime, schAetherflowPattern, activeMitigations);
                        else if (m.resourceCost!.type === 'addersgall') stacks = getAddersgallStacks(selectedTime, activeMitigations);
                        return { badge: `×${stacks}`, badgeColor: stacks <= 1 ? 'amber' as const : 'cyan' as const };
                    })() : {};
                    return { available: true, warning: true, message: label, ...resourceBadge };
                }
            }
        }

        // If we have resource cost, return with badge (passed the resource check earlier)
        if (m.resourceCost) {
            let stacks = 0;
            if (m.resourceCost.type === 'aetherflow') stacks = getAetherflowStacks(selectedTime, schAetherflowPattern, activeMitigations);
            else if (m.resourceCost.type === 'addersgall') stacks = getAddersgallStacks(selectedTime, activeMitigations);
            const badge = `×${stacks}`;
            return { available: true, badge, badgeColor: stacks <= 1 ? 'amber' : 'cyan' };
        }

        return { available: true };
    };

    // Identify Single Target Buffs that can be thrown to others
    const SINGLE_TARGET_BUFFS = ['the_black_est_night', 'heart_of_corundum', 'intervention', 'oblation', 'aquaveil', 'exaltation', 'protraction', 'taurochole', 'haima']; // Add others as needed

    // Filter out skills whose prerequisites are not met (completely hidden)
    const availableMitigations = allJobMitigations.filter(m => {
        if (!m.requires) return true;
        return activeMitigations.some(am => {
            if (am.mitigationId !== m.requires) return false;
            const start = am.time;
            const end = am.time + am.duration;
            return selectedTime >= start && selectedTime < end;
        });
    }).sort((a, b) => getMitigationPriority(a.id) - getMitigationPriority(b.id));

    const handleMitigationClick = (mitigation: Mitigation) => {
        // If it's a single target buff, go to step 2
        if (SINGLE_TARGET_BUFFS.includes(mitigation.id)) {
            setSelectedSingleTargetMit(mitigation);
        } else {
            // Normal skill
            onSelect(mitigation);
        }
    };

    const handleTargetSelect = (targetId: string) => {
        if (selectedSingleTargetMit) {
            // Pass targetId by hacking it onto the object or letting the parent handle it
            // The cleanest way without changing Mitigation type is to cast/extend it here,
            // but the parent `onSelect` expects Mitigation. 
            // Let's modify onSelect to take an optional targetId.
            onSelect({ ...selectedSingleTargetMit, _targetId: targetId } as any);
        }
    };

    const handleClose = () => {
        if (selectedSingleTargetMit) {
            setSelectedSingleTargetMit(null); // Go back to mitigation list
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed z-[9999] pointer-events-none" style={{ top: 0, left: 0 }}>
            <div
                ref={panelRef}
                className={clsx(
                    "pointer-events-auto glass-panel shadow-2xl p-2 overflow-hidden ring-1 ring-white/5 fixed flex flex-col transition-transform duration-300",
                    isMobile
                        ? "bottom-0 left-0 right-0 w-full rounded-t-2xl rounded-b-none border-b-0 translate-y-0"
                        : "rounded-xl w-64"
                )}
                style={isMobile ? { maxHeight: '75vh' } : { left: adjustedPos.x, top: adjustedPos.y, maxHeight: '50vh' }}
            >
                {/* Mobile Drag Handle Indicator */}
                {isMobile && <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3 shrink-0" />}
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/[0.03] px-1 shrink-0">
                    <span className="text-xs font-bold text-app-text-muted uppercase tracking-wider">
                        {selectedSingleTargetMit ? t('mitigation.select_target', '対象を選択') : t('mitigation.select')}
                    </span>
                    <button onClick={handleClose} className="text-app-text-muted hover:text-white transition-colors">
                        <X size={14} />
                    </button>
                </div>

                {!selectedSingleTargetMit ? (
                    <div className="space-y-1 overflow-y-auto pr-1 custom-scrollbar shrink">
                        {availableMitigations.length === 0 ? (
                            <div className="text-xs text-app-text-muted p-4 text-center">{t('mitigation.no_mitigations')}</div>
                        ) : (
                            availableMitigations.map(mitigation => {
                                const status = getResourceStatus(mitigation);
                                return (
                                    <button
                                        key={mitigation.id}
                                        onClick={() => status.available && handleMitigationClick(mitigation)}
                                        disabled={!status.available}
                                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left group border ${!status.available
                                            ? 'border-red-500/20 bg-red-500/[0.06] cursor-not-allowed opacity-70'
                                            : status.warning
                                                ? 'hover:bg-amber-500/[0.06] border-amber-500/30 cursor-pointer'
                                                : 'hover:bg-white/[0.08] border-transparent hover:border-white/[0.03] cursor-pointer'
                                            }`}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <img
                                                src={mitigation.icon}
                                                alt={mitigation.name}
                                                className={`w-8 h-8 object-contain rounded border ${!status.available
                                                    ? 'bg-red-900/30 border-red-500/30'
                                                    : status.warning
                                                        ? 'bg-amber-900/20 border-amber-500/30'
                                                        : 'bg-black/30 border-white/5'
                                                    }`}
                                            />
                                            {status.badge && (
                                                <span className={`absolute -top-1.5 -right-1.5 text-[8px] font-black leading-none px-1 py-0.5 rounded-full shadow-lg ring-1 ${status.badgeColor === 'red'
                                                    ? 'bg-red-600/90 text-red-100 ring-red-400/50'
                                                    : status.badgeColor === 'amber'
                                                        ? 'bg-amber-600/90 text-amber-100 ring-amber-400/50'
                                                        : 'bg-cyan-600/90 text-cyan-100 ring-cyan-400/50'
                                                    }`}>
                                                    {status.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <div className={`text-xs font-bold transition-colors ${!status.available
                                                ? 'text-red-400'
                                                : status.warning
                                                    ? 'text-amber-300'
                                                    : 'text-app-text-primary group-hover:text-app-accent-primary'
                                                }`}>
                                                {contentLanguage === 'en' && mitigation.nameEn ? mitigation.nameEn : mitigation.name}
                                                {SINGLE_TARGET_BUFFS.includes(mitigation.id) && (
                                                    <span className="ml-1 text-[9px] bg-white/10 px-1 rounded text-white/70">▶</span>
                                                )}
                                            </div>
                                            {!status.available ? (
                                                <div className="text-[10px] text-red-400/80 font-medium">
                                                    {status.message}
                                                </div>
                                            ) : status.warning ? (
                                                <div className="text-[10px] text-amber-400/80 font-medium">
                                                    ⚠ {status.message}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-app-text-muted">
                                                    {mitigation.duration}s / {mitigation.cooldown}s ({t('mitigation.cd')})
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                ) : (
                    // Target Selection View
                    <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 shrink">
                        {partyMembers.map((member: import('../types').PartyMember) => (
                            <button
                                key={member.id}
                                onClick={() => handleTargetSelect(member.id)}
                                className="flex flex-col items-center justify-center p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] transition-colors"
                            >
                                <span className={`text-[10px] font-black tracking-widest mb-1 ${member.role === 'tank' ? 'text-blue-400' : member.role === 'healer' ? 'text-green-400' : 'text-red-400'}`}>
                                    {member.id}
                                </span>
                                {member.jobId ? (
                                    <img src={`/icons/${member.jobId}.png`} alt={member.jobId} className="w-6 h-6 object-contain opacity-90" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-white/10" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

