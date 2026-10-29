import React from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import type { TFunction } from 'i18next';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { backdropClose } from '../../utils/backdropClose';
import { useMitigationStore } from '../../store/useMitigationStore';
import type { useTimelineDialogs } from './useTimelineDialogs';
import type { useTimelineEditing } from './useTimelineEditing';
import { matchesMobile } from '../../hooks/useIsMobile';

type Dialogs = ReturnType<typeof useTimelineDialogs>;
type Editing = ReturnType<typeof useTimelineEditing>;
type MitigationState = ReturnType<typeof useMitigationStore.getState>;

interface TimelinePopoversProps {
    t: TFunction;
    phasePopover: Dialogs['phasePopover'];
    setPhasePopover: Dialogs['setPhasePopover'];
    handlePhaseEdit: Editing['handlePhaseEdit'];
    setPhaseModalPosition: Dialogs['setPhaseModalPosition'];
    setSelectedPhaseTime: Dialogs['setSelectedPhaseTime'];
    setSelectedPhase: Dialogs['setSelectedPhase'];
    setIsPhaseModalOpen: Dialogs['setIsPhaseModalOpen'];
    removePhase: MitigationState['removePhase'];
    labelPopover: Dialogs['labelPopover'];
    setLabelPopover: Dialogs['setLabelPopover'];
    handleLabelEdit: Editing['handleLabelEdit'];
    setLabelModalPosition: Dialogs['setLabelModalPosition'];
    setSelectedLabelTime: Dialogs['setSelectedLabelTime'];
    setSelectedLabel: Dialogs['setSelectedLabel'];
    setIsLabelModalOpen: Dialogs['setIsLabelModalOpen'];
    removeLabel: MitigationState['removeLabel'];
    eventPopover: Dialogs['eventPopover'];
    setEventPopover: Dialogs['setEventPopover'];
    handlePopoverEdit: Editing['handlePopoverEdit'];
    handlePopoverAdd: Editing['handlePopoverAdd'];
    handlePopoverDelete: Editing['handlePopoverDelete'];
    setMobilePartyOpen: (open: boolean) => void;
    setMobileToolsOpen: (open: boolean) => void;
    setMobileMenuOpen: (open: boolean) => void;
    setMobileMitiFlow: Dialogs['setMobileMitiFlow'];
}

/** フェーズ / ラベル / イベントの右クリックメニュー(body へ portal)。Timeline から移したもの(Fragment を返しラッパーは足さない)。 */
export const TimelinePopovers: React.FC<TimelinePopoversProps> = ({
    t, phasePopover, setPhasePopover, handlePhaseEdit, setPhaseModalPosition, setSelectedPhaseTime, setSelectedPhase,
    setIsPhaseModalOpen, removePhase, labelPopover, setLabelPopover, handleLabelEdit, setLabelModalPosition,
    setSelectedLabelTime, setSelectedLabel, setIsLabelModalOpen, removeLabel, eventPopover, setEventPopover,
    handlePopoverEdit, handlePopoverAdd, handlePopoverDelete, setMobilePartyOpen, setMobileToolsOpen,
    setMobileMenuOpen, setMobileMitiFlow,
}) => {
    return (
        <>
            {phasePopover && createPortal(
                <div
                    className="fixed inset-0 z-[9998] cursor-default modal-scrim"
                    {...backdropClose(() => setPhasePopover(null))}
                >
                    <div
                        className={clsx(
                            "min-w-[200px] rounded-xl py-1.5 float-surface glass-panel",
                            "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]",
                            "md:static md:absolute md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:w-auto"
                        )}
                        style={{
                            ...(!matchesMobile(window) ? {
                                left: Math.min(phasePopover.position.x, window.innerWidth - 220),
                                top: Math.min(phasePopover.position.y, window.innerHeight - 200),
                                transform: 'none',
                                position: 'absolute',
                            } : {})
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => {
                                handlePhaseEdit(phasePopover.phase, { stopPropagation: () => {}, clientX: phasePopover.position.x, clientY: phasePopover.position.y } as React.MouseEvent);
                                setPhasePopover(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer text-app-text hover:bg-app-surface2"
                        >
                            <Pencil size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.phase_edit')}</span>
                        </button>
                        <button
                            onClick={() => {
                                const clickTime = phasePopover.clickTime;
                                setPhasePopover(null);
                                setPhaseModalPosition(phasePopover.position);
                                setSelectedPhaseTime(clickTime);
                                setSelectedPhase(null);
                                setIsPhaseModalOpen(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer text-app-text hover:bg-app-surface2"
                        >
                            <Plus size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.phase_add_here')}</span>
                        </button>
                        <div className="h-px mx-3 my-1 bg-app-border" />
                        <button
                            onClick={() => {
                                removePhase(phasePopover.phase.id);
                                setPhasePopover(null);
                            }}
                            className="flex items-center gap-3 mx-1.5 px-3 py-2 text-app-2xl font-medium transition-colors cursor-pointer rounded-lg text-app-red hover:bg-app-red-dim"
                        >
                            <Trash2 size={15} className="shrink-0" />
                            <span>{t('timeline.phase_delete')}</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}
            {labelPopover && createPortal(
                <div
                    className="fixed inset-0 z-[9998] cursor-default modal-scrim"
                    {...backdropClose(() => setLabelPopover(null))}
                >
                    <div
                        className={clsx(
                            "min-w-[200px] rounded-xl py-1.5 float-surface glass-panel",
                            "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]",
                            "md:static md:absolute md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:w-auto"
                        )}
                        style={{
                            ...(!matchesMobile(window) ? {
                                left: Math.min(labelPopover.position.x, window.innerWidth - 220),
                                top: Math.min(labelPopover.position.y, window.innerHeight - 200),
                                transform: 'none',
                                position: 'absolute',
                            } : {})
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => {
                                handleLabelEdit(labelPopover.label, { stopPropagation: () => {}, clientX: labelPopover.position.x, clientY: labelPopover.position.y } as React.MouseEvent);
                                setLabelPopover(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer text-app-text hover:bg-app-surface2"
                        >
                            <Pencil size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.label_edit')}</span>
                        </button>
                        <button
                            onClick={() => {
                                const clickTime = labelPopover.clickTime;
                                setLabelPopover(null);
                                setLabelModalPosition(labelPopover.position);
                                setSelectedLabelTime(clickTime);
                                setSelectedLabel(null);
                                setIsLabelModalOpen(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer text-app-text hover:bg-app-surface2"
                        >
                            <Plus size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.label_add_here')}</span>
                        </button>
                        <div className="h-px mx-3 my-1 bg-app-border" />
                        <button
                            onClick={() => {
                                removeLabel(labelPopover.label.id);
                                setLabelPopover(null);
                            }}
                            className="flex items-center gap-3 mx-1.5 px-3 py-2 text-app-2xl font-medium transition-colors cursor-pointer rounded-lg text-app-red hover:bg-app-red-dim"
                        >
                            <Trash2 size={15} className="shrink-0" />
                            <span>{t('timeline.label_delete')}</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}
            {eventPopover && createPortal(
                <div
                    className="fixed inset-0 z-[9998] cursor-default modal-scrim"
                    {...backdropClose(() => setEventPopover(null))}
                >
                    <div
                        className={clsx(
                            "min-w-[200px] rounded-xl py-1.5 float-surface glass-panel",
                            "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                            // モバイル: 画面中央、PC: クリック位置
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]",
                            "md:static md:absolute md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:w-auto"
                        )}
                        style={{
                            // PCのみ位置を適用
                            ...(!matchesMobile(window) ? {
                                left: Math.min(eventPopover.position.x, window.innerWidth - 220),
                                top: Math.min(eventPopover.position.y, window.innerHeight - 160),
                                transform: 'none',
                                position: 'absolute',
                            } : {})
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={handlePopoverEdit}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer",
                                "text-app-text hover:bg-app-surface2"
                            )}
                        >
                            <Pencil size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.event_edit')}</span>
                        </button>
                        <button
                            onClick={handlePopoverAdd}
                            className={clsx(
                                "w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer",
                                "text-app-text hover:bg-app-surface2"
                            )}
                        >
                            <Plus size={15} className="text-app-text shrink-0" />
                            <span>{t('timeline.event_add_here')}</span>
                        </button>
                        {/* モバイルのみ: 軽減追加ショートカット */}
                        {matchesMobile(window) && (
                            <button
                                onClick={() => {
                                    const time = eventPopover.event.time;
                                    setEventPopover(null);
                                    setMobilePartyOpen(false);
                                    setMobileToolsOpen(false);
                                    setMobileMenuOpen(false);
                                    setMobileMitiFlow({ isOpen: true, time, step: 'job', selectedMemberId: null, pending: null });
                                }}
                                className={clsx(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-app-2xl font-medium transition-colors cursor-pointer",
                                    "text-app-text hover:bg-app-surface2"
                                )}
                            >
                                <Plus size={15} className="text-app-text shrink-0" />
                                <span>{t('timeline.add_mitigation_here')}</span>
                            </button>
                        )}
                        <div className={clsx("h-px mx-3 my-1", "bg-app-border")} />
                        <button
                            onClick={handlePopoverDelete}
                            className={clsx(
                                "flex items-center gap-3 mx-1.5 px-3 py-2 text-app-2xl font-medium transition-colors cursor-pointer rounded-lg",
                                "text-app-red hover:bg-app-red-dim"
                            )}
                        >
                            <Trash2 size={15} className="shrink-0" />
                            <span>{t('timeline.event_delete')}</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
