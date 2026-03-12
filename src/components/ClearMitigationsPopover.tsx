import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { JOBS } from '../data/mockData';

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
    const { t } = useTranslation();
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
                "fixed w-[220px] glass-panel rounded-xl z-[9999] py-1 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95",
                !isPositioned ? "opacity-0 pointer-events-none" : "opacity-100 duration-200"
            )}
            style={{
                top: `${popoverPosition.top}px`,
                left: `${popoverPosition.left}px`,
                // IMPORTANT: Ensure no transition on top/left during initial positioning
                transition: isPositioned ? 'opacity 200ms, transform 200ms' : 'none'
            }}
        >
            {/* Clear All */}
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
                className="w-full text-left px-4 py-2.5 text-[11px] font-black text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3 group"
            >
                <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                <span className="uppercase tracking-wider font-black">{t('timeline.all_mitigations')}</span>
            </button>

            <div className="h-[1px] bg-glass-border mx-2 my-1" />

            {/* Member Section Header */}
            <div className="px-4 py-2 text-[9px] text-app-text-muted font-black uppercase tracking-[0.15em]">
                {t('timeline.member_mitigations')}
            </div>

            {/* Member List */}
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {partyMembers.map(m => {
                    const job = JOBS.find(j => j.id === m.jobId);
                    const count = timelineMitigations.filter(mit => mit.ownerId === m.id).length;
                    if (!job || count === 0) return null;
                    return (
                        <button
                            key={m.id}
                            onClick={() => {
                                onClose();
                                setConfirmDialog({
                                    title: t('timeline.clear_member', { member: m.id }).replace('{{member}}', m.id),
                                    message: t('timeline.clear_member_confirm', { member: m.id, job: contentLanguage === 'en' ? job.name.en : job.name.ja }).replace('{{member}}', m.id).replace('{{job}}', contentLanguage === 'en' ? job.name.en : job.name.ja),
                                    variant: 'danger',
                                    onConfirm: () => {
                                        useMitigationStore.getState().clearMitigationsByMember(m.id);
                                        setConfirmDialog(null);
                                    },
                                });
                            }}
                            className="w-full text-left px-4 py-2 text-[11px] text-app-text-secondary hover:text-app-text hover:bg-glass-hover flex items-center gap-2.5 transition-all group"
                        >
                            <div className="w-5 h-5 flex-shrink-0 rounded-md bg-glass-card border border-glass-border flex items-center justify-center group-hover:border-blue-500/30 transition-colors">
                                <img src={job.icon} alt="" className="w-3.5 h-3.5 object-contain" />
                            </div>
                            <div className="flex items-baseline gap-2 overflow-hidden">
                                <span className="font-black text-[10px] whitespace-nowrap">{m.id}</span>
                                <span className="text-[9px] text-app-text-muted truncate">
                                    {contentLanguage === 'en' ? job.name.en : job.name.ja}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>,
        document.body
    );
};
