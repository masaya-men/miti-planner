import React from 'react';
import { useMitigationStore } from '../store/useMitigationStore';
import { JOBS } from '../data/mockData';
import { User, Trash2, Star } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
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

    // Removed conditional return null to ensure pre-mounting
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
                                    "h-12 rounded-lg flex flex-col items-center justify-center relative group transition-all duration-300 overflow-hidden",
                                    job
                                        ? `${activeClass} hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]`
                                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                                )}
                            >
                                <span className={clsx("absolute top-1 left-1.5 text-[8px] font-black tracking-widest opacity-40 z-0",
                                    member.role === 'tank' ? 'text-blue-200' :
                                        member.role === 'healer' ? 'text-green-200' : 'text-red-200'
                                )}>{member.id}</span>

                                {job ? (
                                    <>
                                        {/* My Job Toggle Star */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                useMitigationStore.getState().myMemberId === member.id
                                                    ? useMitigationStore.getState().setMyMemberId(null)
                                                    : useMitigationStore.getState().setMyMemberId(member.id);
                                            }}
                                            className="absolute top-1 right-1 z-30 p-1"
                                            title="Set as My Job"
                                        >
                                            <Star
                                                size={12}
                                                className={clsx(
                                                    "transition-colors",
                                                    useMitigationStore.getState().myMemberId === member.id
                                                        ? "text-yellow-400 fill-yellow-400 opacity-100 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]"
                                                        : "text-white/20 hover:text-yellow-100 opacity-0 group-hover:opacity-100"
                                                )}
                                            />
                                        </button>

                                        <div className="z-10 relative filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] flex flex-col items-center pointer-events-none mt-1">
                                            <img src={job.icon} alt={job.name} className="w-5 h-5 object-contain" />
                                        </div>

                                        {/* Delete Overlay */}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity z-20 backdrop-blur-[1px]">
                                            <button onClick={(e) => { e.stopPropagation(); handleRemoveJob(member.id); }} className="w-full h-full flex items-center justify-center pt-2">
                                                <Trash2 size={16} className="text-white/90 drop-shadow-lg hover:text-red-400 transition-colors" />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => { }}>
                                        <span className="text-white/20 text-[8px] tracking-widest font-light">SELECT</span>
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
        <div className={clsx(
            "fixed inset-0 z-[9999] transition-all duration-300",
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none invisible"
        )}>
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />

            {/* Slide-Over Panel (Left) */}
            <div
                ref={popoverRef}
                className={clsx(
                    "absolute top-0 left-0 h-full w-[400px] max-w-full bg-[#020203] border-r border-white/[0.08] shadow-2xl flex flex-col transition-transform duration-300 ease-out glass-panel",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-white/[0.05] bg-[#050505]/50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <User className="text-blue-500" size={16} />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{t('party.configuration_title', 'パーティ構成設定')}</h2>
                            <p className="text-[9px] text-slate-500">{t('party.configuration_description', 'パーティ構成とグループを管理します')}</p>
                            <p className="text-[9px] text-yellow-500/90 font-bold mt-1 flex items-center gap-1 bg-yellow-500/10 w-fit px-1.5 py-0.5 rounded">
                                <Star size={10} className="fill-yellow-500/80" /> {t('party.my_job_instruction', 'スロット右上の星をタップして自ジョブに設定')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2 bg-[#020203]/80">
                    {renderGroup("MT Group", mtGroupIndices)}
                    {renderGroup("ST Group", stGroupIndices)}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-white/[0.05] bg-[#050505]/50 flex justify-end flex-shrink-0 items-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-105 active:scale-95"
                    >
                        {t('common.ok', 'OK')}
                    </button>
                </div>
            </div>
        </div>
    );
};
