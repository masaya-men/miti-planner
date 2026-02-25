
import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { MITIGATIONS, getMitigationPriority, JOBS } from '../data/mockData';
import type { Mitigation, AppliedMitigation } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { validateMitigationPlacement } from '../utils/resourceTracker';
import { useMitigationStore } from '../store/useMitigationStore';

interface MitigationSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mitigation: Mitigation & { _targetId?: string }) => void;
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

    // Check resource availability for a mitigation using shared logic
    const getResourceStatus = (m: Mitigation) => {
        return validateMitigationPlacement(m, selectedTime, activeMitigations, schAetherflowPattern, t);
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
            onSelect({ ...selectedSingleTargetMit, _targetId: targetId });
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
                {isMobile && <div className="w-12 h-1 bg-slate-900/ dark:bg-white/ rounded-full mx-auto mb-3 shrink-0" />}
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/[0.03] px-1 shrink-0">
                    <span className="text-xs font-bold text-app-text-muted uppercase tracking-wider">
                        {selectedSingleTargetMit ? t('mitigation.select_target', '対象を選択してください') : t('mitigation.select')}
                    </span>
                    <button onClick={handleClose} className="text-app-text-muted hover:text-slate-800 dark:text-white transition-colors">
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
                                                    <span className="ml-1 text-[9px] bg-slate-900/ dark:bg-white/ px-1 rounded text-slate-800 dark:text-white/70">▶</span>
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
                    <div className="flex flex-col gap-2 overflow-y-auto pr-1 shrink">
                        {partyMembers.map((member: import('../types').PartyMember) => {
                            const job = member.jobId ? JOBS.find(j => j.id === member.jobId) : null;
                            return (
                                <button
                                    key={member.id}
                                    onClick={() => handleTargetSelect(member.id)}
                                    className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] transition-colors"
                                >
                                    {job ? (
                                        <img src={job.icon} alt={job.name} className="w-8 h-8 object-contain opacity-90 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                                    ) : (
                                        <div className="w-8 h-8 rounded bg-slate-900/ dark:bg-white/ border border-white/20" />
                                    )}
                                    <span className={`text-sm font-black tracking-widest ${member.role === 'tank' ? 'text-blue-400' : member.role === 'healer' ? 'text-green-400' : 'text-red-400'}`}>
                                        {member.id}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

