import React from 'react';
import { useMitigationStore } from '../store/useMitigationStore';
import { JOBS } from '../data/mockData';
import { X, User, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface PartySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PartySettingsModal: React.FC<PartySettingsModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { partyMembers, setMemberJob } = useMitigationStore();
    const popoverRef = React.useRef<HTMLDivElement>(null);

    // Close on click outside + Enter key
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Standard Light Party Grouping
    // MtGroup: MT(0), H1(2), D1(4), D3(6)
    // StGroup: ST(1), H2(3), D2(5), D4(7)
    const mtGroupIndices = [0, 2, 4, 6];
    const stGroupIndices = [1, 3, 5, 7];

    const handleRemoveJob = (memberId: string) => {
        setMemberJob(memberId, null as any);
    };

    // Melee DPS job IDs (ranged = everything else in 'dps' role)
    const MELEE_IDS = ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'];

    const handleToggleJob = (groupIndices: number[], jobId: string) => {
        const existingMemberIndex = groupIndices.find(index => partyMembers[index].jobId === jobId);

        if (existingMemberIndex !== undefined) {
            handleRemoveJob(partyMembers[existingMemberIndex].id);
        } else {
            const job = JOBS.find(j => j.id === jobId);
            if (!job) return;

            // Determine preferred slot indices within the group based on job role/subrole
            // groupIndices: [tank, healer, D-melee, D-ranged]
            //   MT group: [0, 2, 4, 6]  →  MT, H1, D1, D3
            //   ST group: [1, 3, 5, 7]  →  ST, H2, D2, D4
            let preferredIndices: number[];
            if (job.role === 'tank') {
                preferredIndices = [groupIndices[0]]; // Tank slot
            } else if (job.role === 'healer') {
                preferredIndices = [groupIndices[1]]; // Healer slot
            } else if (MELEE_IDS.includes(jobId)) {
                preferredIndices = [groupIndices[2], groupIndices[3]]; // D-melee first, then D-ranged
            } else {
                preferredIndices = [groupIndices[3], groupIndices[2]]; // D-ranged first, then D-melee
            }

            // Try preferred slots first, then fall back to any empty slot
            const targetIndex = preferredIndices.find(idx => !partyMembers[idx].jobId)
                ?? groupIndices.find(idx => !partyMembers[idx].jobId);

            if (targetIndex !== undefined) {
                setMemberJob(partyMembers[targetIndex].id, jobId);
            }
        }
    };

    const renderGroup = (title: string, groupIndices: number[]) => {
        const renderJobRow = (jobs: typeof JOBS) => (
            <div className="flex gap-1 flex-wrap mb-1">
                {jobs.map(job => {
                    const isSelected = groupIndices.some(index => partyMembers[index].jobId === job.id);

                    // Dynamic styles based on selection and role
                    const activeStyle = job.role === 'tank'
                        ? "bg-blue-500/20 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                        : job.role === 'healer'
                            ? "bg-green-500/20 border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                            : "bg-red-500/20 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]";

                    return (
                        <button
                            key={job.id}
                            onClick={() => handleToggleJob(groupIndices, job.id)}
                            className={clsx(
                                "w-6 h-6 rounded flex items-center justify-center transition-all relative overflow-hidden",
                                isSelected
                                    ? activeStyle
                                    : "bg-[#1a1a1d] border border-white/5 opacity-60 hover:opacity-100 hover:bg-[#252529]"
                            )}
                            title={job.name}
                        >
                            <img src={job.icon} alt={job.name} className="w-4 h-4 object-contain" />
                        </button>
                    );
                })}
            </div>
        );

        // Filter Jobs
        const tanks = JOBS.filter(j => j.role === 'tank');
        const healers = JOBS.filter(j => j.role === 'healer');
        const melee = JOBS.filter(j => ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'].includes(j.id));
        const phys = JOBS.filter(j => ['brd', 'mch', 'dnc'].includes(j.id));
        const magic = JOBS.filter(j => ['blm', 'smn', 'rdm', 'pct'].includes(j.id));

        return (
            <div className="flex-1 flex flex-col gap-2 bg-[#0a0a0c]/80 p-3 rounded-xl border border-white/[0.05]">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-white/[0.05] pb-1 mb-1">
                    {title}
                </h3>

                {/* Selected Slots - Slightly Compact */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {groupIndices.map((index) => {
                        const member = partyMembers[index];
                        const job = JOBS.find(j => j.id === member.jobId);

                        // Role Colors
                        const roleColor = job
                            ? (job.role === 'tank' ? 'blue' : job.role === 'healer' ? 'green' : 'red')
                            : (member.role === 'tank' ? 'blue' : member.role === 'healer' ? 'green' : 'red');

                        // Glass Style for Active Card
                        const activeClass = job
                            ? (roleColor === 'blue' ? 'bg-gradient-to-br from-blue-500/10 to-blue-900/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30' :
                                roleColor === 'green' ? 'bg-gradient-to-br from-green-500/10 to-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.15)] ring-1 ring-green-500/30' :
                                    'bg-gradient-to-br from-red-500/10 to-red-900/20 shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30')
                            : "bg-white/[0.02] border border-white/[0.05]";

                        return (
                            <div
                                key={member.id}
                                className={clsx(
                                    "aspect-square rounded-lg flex flex-col items-center justify-center relative group cursor-pointer transition-all duration-300 overflow-hidden",
                                    job
                                        ? `${activeClass} hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]`
                                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                                )}
                                onClick={() => job && handleRemoveJob(member.id)}
                            >
                                <span className={clsx("absolute top-0.5 left-1 text-[8px] font-black tracking-widest opacity-40 z-0",
                                    member.role === 'tank' ? 'text-blue-200' :
                                        member.role === 'healer' ? 'text-green-200' : 'text-red-200'
                                )}>{member.id}</span>

                                {job ? (
                                    <>
                                        <div className="z-10 relative filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
                                            <img src={job.icon} alt={job.name} className="w-6 h-6 object-contain" />
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-20 backdrop-blur-[1px]">
                                            <Trash2 size={14} className="text-white/90 drop-shadow-lg" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white/10 text-[7px] tracking-widest font-light">SELECT</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Job Selection Pool */}
                <div className="flex flex-col gap-1">
                    {renderJobRow(tanks)}
                    {renderJobRow(healers)}
                    {renderJobRow(melee)}
                    {renderJobRow(phys)}
                    {renderJobRow(magic)}
                </div>
            </div>
        );
    };

    // Use createPortal like PartyStatusPopover
    // Fixed position: top-24 left-4 (based on timeline button pos)
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] pointer-events-none">
                    {/* No backdrop, just content */}
                    <div ref={popoverRef} className="pointer-events-auto fixed top-24 left-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="bg-[#020203] border border-white/[0.08] rounded-xl shadow-2xl w-[650px] flex flex-col overflow-hidden ring-1 ring-white/5 glass-panel"
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center px-4 py-2 border-b border-white/[0.05] bg-[#050505]/50 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                        <User className="text-blue-500" size={14} />
                                    </div>
                                    <div>
                                        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{t('party.configuration_title')}</h2>
                                        <p className="text-[9px] text-slate-500">{t('party.configuration_description')}</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-3 flex gap-3 bg-[#020203]/80">
                                {renderGroup("MT Group", mtGroupIndices)}
                                {renderGroup("ST Group", stGroupIndices)}
                            </div>

                            {/* Footer */}
                            <div className="px-3 py-2 border-t border-white/[0.05] bg-[#050505]/50 flex justify-end flex-shrink-0">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[10px] shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all"
                                >
                                    OK
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};
