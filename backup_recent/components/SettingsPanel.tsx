import React, { useState } from 'react';
import { useMitigationStore } from '../store/useMitigationStore';
import { SKILL_DATA } from '../utils/calculator';
import { JOBS } from '../data/mockData';
import { Shield, ChevronUp, ChevronDown } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
    const { partyMembers, updateMemberStats } = useMitigationStore();
    const [isOpen, setIsOpen] = useState(true);

    if (partyMembers.length === 0) {
        return <div className="p-4 text-gray-500">ジョブが設定されていません</div>;
    }

    const getJobName = (jobId: string | null) => {
        if (!jobId) return '';
        const job = JOBS.find(j => j.id === jobId);
        return job ? job.name : jobId;
    };

    const getRoleName = (role: string) => {
        switch (role) {
            case 'tank': return 'タンク';
            case 'healer': return 'ヒーラー';
            case 'dps': return 'DPS';
            default: return role;
        }
    };

    return (
        <div className="p-4 bg-gray-900 border-l border-gray-800 w-96 overflow-y-auto h-full">
            <h2 className="text-lg font-bold mb-4 text-gray-200">ステータス設定</h2>

            <div className="space-y-6">
                <div className="border-b border-gray-800 bg-gray-900 flex flex-col">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center justify-between p-2 text-xs font-bold text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Shield size={14} />
                            <span>パーティーステータス</span>
                        </div>
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {isOpen && (
                        <div className="p-2 space-y-4">
                            {partyMembers.map((member) => (
                                <div key={member.id} className="bg-gray-800/50 border border-gray-700 rounded p-3 text-sm">
                                    <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-700">
                                        <span className={`font-bold ${member.role === 'tank' ? 'text-blue-400' :
                                            member.role === 'healer' ? 'text-green-400' : 'text-red-400'
                                            }`}>{member.id}</span>
                                        <span className="text-gray-500 text-xs">
                                            {member.jobId ? getJobName(member.jobId) : getRoleName(member.role)}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">HP</label>
                                                <input
                                                    type="number"
                                                    value={member.stats.hp}
                                                    onChange={(e) => updateMemberStats(member.id, { hp: Number(e.target.value) })}
                                                    className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1 text-right text-gray-200 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">メインステータス</label>
                                                <input
                                                    type="number"
                                                    value={member.stats.mainStat}
                                                    onChange={(e) => updateMemberStats(member.id, { mainStat: Number(e.target.value) })}
                                                    className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1 text-right text-gray-200 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Calculated Values Preview */}
                                        <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                                            {Object.entries(member.computedValues).map(([key, value]) => {
                                                const skill = SKILL_DATA[key as keyof typeof SKILL_DATA];
                                                // Only show if the skill is relevant to the job
                                                if (skill && member.jobId && skill.jobs && !skill.jobs.includes(member.jobId)) return null;

                                                return (
                                                    <div key={key} className="flex justify-between text-xs">
                                                        <span className="text-gray-500">{key}:</span>
                                                        <span className="text-blue-300 font-mono">{Math.floor(value)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
