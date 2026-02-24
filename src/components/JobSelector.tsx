import React from 'react';
import { useMitigationStore } from '../store/useMitigationStore';
import { useThemeStore } from '../store/useThemeStore';
import { JOBS } from '../data/mockData';
import clsx from 'clsx';

export const JobSelector: React.FC = () => {
    const { partyMembers } = useMitigationStore();
    const { contentLanguage } = useThemeStore();

    const getJobIcon = (jobId: string | null) => {
        if (!jobId) return null;
        const job = JOBS.find(j => j.id === jobId);
        return job ? job.icon : null;
    };

    const getJobName = (jobId: string | null) => {
        if (!jobId) return '未設定';
        const job = JOBS.find(j => j.id === jobId);
        if (!job) return jobId;
        return contentLanguage === 'en' && job.nameEn ? job.nameEn : job.name;
    };

    return (
        <div className="p-4 bg-gray-800 border-b border-gray-700">
            <div className="flex flex-wrap gap-4 justify-center">
                {partyMembers.map((member) => (
                    <div
                        key={member.id}
                        className={clsx(
                            'flex flex-col items-center gap-1 p-2 rounded-lg border w-24',
                            'bg-gray-700/50 border-gray-600'
                        )}
                    >
                        <span className={clsx("text-xs font-bold",
                            member.role === 'tank' ? 'text-blue-400' :
                                member.role === 'healer' ? 'text-green-400' : 'text-red-400'
                        )}>{member.id}</span>

                        <div className="w-10 h-10 flex items-center justify-center bg-gray-800 rounded-full border border-gray-600">
                            {member.jobId ? (
                                <img src={getJobIcon(member.jobId) || ''} alt={member.jobId} className="w-8 h-8 object-contain" />
                            ) : (
                                <span className="text-gray-500 text-xs">-</span>
                            )}
                        </div>
                        <span className="text-xs text-gray-300 truncate w-full text-center">
                            {getJobName(member.jobId)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
