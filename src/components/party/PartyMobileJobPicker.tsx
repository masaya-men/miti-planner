import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { CloseButton } from '../ui/ModalParts';
import { getPhaseName, type Job, type PartyMember } from '../../types';

interface PartyMobileJobPickerProps {
    focusedSlot: number;
    draftMembers: PartyMember[];
    JOBS: Job[];
    contentLanguage: string;
    handleJobSelect: (jobId: string) => void;
    setFocusedSlot: React.Dispatch<React.SetStateAction<number | null>>;
}

/** モバイル用インラインジョブ選択 */
export const PartyMobileJobPicker: React.FC<PartyMobileJobPickerProps> = ({ focusedSlot, draftMembers, JOBS, contentLanguage, handleJobSelect, setFocusedSlot }) => {
    const { t } = useTranslation();
    return (
                            <div className="md:hidden bg-app-surface2/50 rounded-xl p-3 border border-app-border animate-in slide-in-from-bottom-2 duration-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-app-base font-black text-app-text-muted uppercase tracking-wider">
                                        {draftMembers[focusedSlot]?.id} — {t('party.select_job', 'ジョブを選択')}
                                    </span>
                                    <CloseButton onClick={() => setFocusedSlot(null)} label={t('common.close')} />
                                </div>
                                <div className="grid grid-cols-6 gap-1.5">
                                    {JOBS.map(job => (
                                        <button
                                            key={job.id}
                                            onClick={() => {
                                                handleJobSelect(job.id);
                                                setFocusedSlot(null);
                                            }}
                                            className={clsx(
                                                "w-10 h-10 rounded-lg border flex items-center justify-center cursor-pointer active:scale-90 transition-all",
                                                draftMembers[focusedSlot]?.jobId === job.id
                                                    ? "bg-app-text/20 border-app-text"
                                                    : "bg-app-surface2 border-app-border"
                                            )}
                                        >
                                            <img referrerPolicy="no-referrer" src={job.icon} alt={getPhaseName(job.name, contentLanguage)} className="w-7 h-7 object-contain" />
                                        </button>
                                    ))}
                                </div>
                            </div>
    );
};
