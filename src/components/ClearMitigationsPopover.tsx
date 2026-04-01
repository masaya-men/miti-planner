import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useMitigationStore } from '../store/useMitigationStore';
import { useJobs } from '../hooks/useSkillsData';
import { Tooltip } from './ui/Tooltip';

interface ClearMitigationsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    triggerRef: React.RefObject<HTMLElement | null>;
    partyMembers: any[];
    timelineMitigations: any[];
    contentLanguage: string;
    setConfirmDialog: (dialog: any) => void;
}

export const ClearMitigationsPopover: React.FC<ClearMitigationsPopoverProps> = ({
    isOpen,
    onClose,
    triggerRef,
    partyMembers,
    timelineMitigations,
    contentLanguage,
    setConfirmDialog
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const jobs = useJobs();
    const { t } = useTranslation();
    useEscapeClose(isOpen, onClose);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
    const [isPositioned, setIsPositioned] = useState(false);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                if (triggerRef?.current && triggerRef.current.contains(event.target as Node)) {
                    return;
                }
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, triggerRef]);

    useLayoutEffect(() => {
        if (isOpen && triggerRef?.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Align the popover's left edge with the button's left edge
            setPopoverPosition({
                top: rect.bottom + 8,
                left: rect.left
            });
            setIsPositioned(true);
        } else if (!isOpen) {
            setIsPositioned(false);
        }
    }, [isOpen, triggerRef]);

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={popoverRef}
            className={clsx(
                "fixed w-[190px] glass-tier3 rounded-xl z-[9999] py-1 shadow-sm overflow-hidden animate-in fade-in zoom-in-95",
                !isPositioned ? "opacity-0 pointer-events-none" : "opacity-100 duration-200"
            )}
            style={{
                top: `${popoverPosition.top}px`,
                left: `${popoverPosition.left}px`,
                // IMPORTANT: Ensure no transition on top/left during initial positioning
                transition: isPositioned ? 'opacity 200ms, transform 200ms' : 'none'
            }}
        >
            {/* Header: Clear All + Close */}
            <div className="flex items-center pr-2 group/header">
                <button
                    onClick={() => {
                        onClose();
                        setConfirmDialog({
                            title: t('timeline.clear_all'),
                            message: t('timeline.clear_all_confirm'),
                            variant: 'danger',
                            onConfirm: () => {
                                useMitigationStore.getState().clearAllMitigations();
                                setConfirmDialog(null);
                            },
                        });
                    }}
                    className="flex-1 text-left px-4 py-2.5 text-[13px] font-black text-app-red hover:bg-app-red-dim rounded-xl cursor-pointer transition-colors flex items-center gap-3 group/btn"
                >
                    <Trash2 size={14} className="group-hover/btn:scale-110 transition-transform" />
                    <span className="uppercase tracking-wider font-black">{t('timeline.all_mitigations')}</span>
                </button>
                <Tooltip content={t('common.close', '閉じる')}>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-app-text rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90"
                    >
                        <X size={14} />
                    </button>
                </Tooltip>
            </div>

            <div className="h-[1px] bg-glass-border mx-2 my-1" />

            {/* Member Section Header */}
            <div className="px-4 py-2 text-[11px] text-app-text-muted font-black uppercase tracking-[0.15em]">
                {t('timeline.member_mitigations')}
            </div>

            {/* Member List Grid */}
            <div className="grid grid-cols-4 gap-2 px-3 pb-3 pt-1">
                {partyMembers.map(m => {
                    const job = jobs.find(j => j.id === m.jobId);
                    const count = timelineMitigations.filter(mit => mit.ownerId === m.id).length;
                    const hasMitigations = count > 0;

                    return (
                        <button
                            key={m.id}
                            onClick={() => {
                                if (!hasMitigations) return;
                                onClose();
                                setConfirmDialog({
                                    title: t('timeline.clear_member', { member: m.id }).replace('{{member}}', m.id),
                                    message: t('timeline.clear_member_confirm', { member: m.id, job: contentLanguage === 'en' ? job?.name.en : job?.name.ja }).replace('{{member}}', m.id).replace('{{job}}', (contentLanguage === 'en' ? job?.name.en : job?.name.ja) || m.id),
                                    variant: 'danger',
                                    onConfirm: () => {
                                        useMitigationStore.getState().clearMitigationsByMember(m.id);
                                        setConfirmDialog(null);
                                    },
                                });
                            }}
                            disabled={!hasMitigations}
                            className={clsx(
                                "flex items-center justify-center p-2 rounded-lg border transition-all duration-200",
                                "bg-app-surface2 border-app-border",
                                "shadow-sm",
                                !hasMitigations
                                    ? "opacity-20 cursor-not-allowed grayscale shadow-none"
                                    : "cursor-pointer hover:bg-app-surface2 hover:border-app-border active:scale-95 hover:scale-[1.03] hover:shadow-md"
                            )}
                        >
                            {hasMitigations ? (
                                <Tooltip content={`${m.id} (${contentLanguage === 'en' ? job?.name.en : job?.name.ja})`}>
                                    {job ? (
                                        <img src={job.icon} alt="" className="w-6 h-6 object-contain drop-shadow-md" />
                                    ) : (
                                        <span className={clsx(
                                            "text-[10px] font-black tracking-tighter uppercase",
                                            m.role === 'tank' ? 'text-blue-500 dark:text-blue-400' :
                                                m.role === 'healer' ? 'text-green-500 dark:text-green-400' :
                                                    'text-red-500 dark:text-red-400'
                                        )}>
                                            {m.id}
                                        </span>
                                    )}
                                </Tooltip>
                            ) : (
                                job ? (
                                    <img src={job.icon} alt="" className="w-6 h-6 object-contain drop-shadow-md" />
                                ) : (
                                    <span className={clsx(
                                        "text-[10px] font-black tracking-tighter uppercase",
                                        m.role === 'tank' ? 'text-blue-500 dark:text-blue-400' :
                                            m.role === 'healer' ? 'text-green-500 dark:text-green-400' :
                                                'text-red-500 dark:text-red-400'
                                    )}>
                                        {m.id}
                                    </span>
                                )
                            )}
                        </button>
                    );
                })}
            </div>
        </div>,
        document.body
    );
};
