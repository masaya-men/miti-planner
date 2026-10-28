import React from 'react';
import type { TFunction } from 'i18next';
import { X } from 'lucide-react';
import { EventModal } from '../EventModal';
import { MobileContextMenu } from '../MobileContextMenu';
import { BoundaryEditModal } from '../BoundaryEditModal';
import { HeaderPhaseDropdown } from '../HeaderPhaseDropdown';
import { HeaderGimmickDropdown } from '../HeaderGimmickDropdown';
import { HeaderTimeInput } from '../HeaderTimeInput';
import { HeaderMechanicSearch } from '../HeaderMechanicSearch';
import { MemoFloatingBar } from '../Memo/MemoFloatingBar';
import { Tooltip } from '../ui/Tooltip';
import { MitigationSelector } from '../MitigationSelector';
import { JobPicker } from '../JobPicker';
import { PartySettingsModal } from '../PartySettingsModal';
import { JobMigrationModal } from '../JobMigrationModal';
import { FFLogsImportModal } from '../FFLogsImportModal';
import { SpreadsheetGridImportModal } from '../SpreadsheetGridImportModal';
import { ConfirmDialog } from '../ConfirmDialog';
import { PlacementToast } from './sheet/PlacementToast';
import { SheetHiddenPopover } from './sheet/SheetHiddenPopover';
import { SheetColumnTooltip } from './sheet/SheetColumnTooltip';
import { SheetTargetPopover } from './sheet/SheetTargetPopover';
import { getPhaseName } from '../../types';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useSheetHiddenSkillsStore } from '../../store/useSheetHiddenSkillsStore';
import type { useJobs } from '../../hooks/useSkillsData';
import type { useTimelineDialogs } from './useTimelineDialogs';
import type { useTimelineEditing } from './useTimelineEditing';
import type { useTimelineMitigationEditing } from './useTimelineMitigationEditing';
import type { useTimelineDamage } from './useTimelineDamage';
import type { useTimelineAutoPlan } from './useTimelineAutoPlan';
import type { useTimelineSheetViewState, useTimelineSheetTap, useTimelineSheetColumns, useTimelineSheetHover } from './useTimelineSheetView';

type Dialogs = ReturnType<typeof useTimelineDialogs>;
type Editing = ReturnType<typeof useTimelineEditing>;
type MitigationEditing = ReturnType<typeof useTimelineMitigationEditing>;
type MitigationState = ReturnType<typeof useMitigationStore.getState>;

interface TimelineDialogsProps {
    t: TFunction;
    contentLanguage: string;
    isMemoMode: boolean;
    memos: MitigationState['memos'];
    clipboardEvent: MitigationState['clipboardEvent'];
    setClipboardEvent: MitigationState['setClipboardEvent'];
    isModalOpen: Dialogs['isModalOpen'];
    setIsModalOpen: Dialogs['setIsModalOpen'];
    handleSave: Editing['handleSave'];
    handleDelete: Editing['handleDelete'];
    selectedEvent: Dialogs['selectedEvent'];
    selectedTime: Dialogs['selectedTime'];
    eventModalPosition: Dialogs['eventModalPosition'];
    mobileContextMenu: Dialogs['mobileContextMenu'];
    setMobileContextMenu: Dialogs['setMobileContextMenu'];
    handleContextEdit: MitigationEditing['handleContextEdit'];
    handleContextAdd: MitigationEditing['handleContextAdd'];
    handleContextDelete: MitigationEditing['handleContextDelete'];
    isPhaseModalOpen: Dialogs['isPhaseModalOpen'];
    setIsPhaseModalOpen: Dialogs['setIsPhaseModalOpen'];
    selectedPhase: Dialogs['selectedPhase'];
    handlePhaseSave: Editing['handlePhaseSave'];
    handlePhaseDelete: Editing['handlePhaseDelete'];
    setTimelineSelectMode: Dialogs['setTimelineSelectMode'];
    phases: MitigationState['phases'];
    phaseModalPosition: Dialogs['phaseModalPosition'];
    isLabelModalOpen: Dialogs['isLabelModalOpen'];
    setIsLabelModalOpen: Dialogs['setIsLabelModalOpen'];
    selectedLabel: Dialogs['selectedLabel'];
    handleLabelSave: Editing['handleLabelSave'];
    handleLabelDelete: Editing['handleLabelDelete'];
    setLabelSelectMode: Dialogs['setLabelSelectMode'];
    labels: MitigationState['labels'];
    labelModalPosition: Dialogs['labelModalPosition'];
    phaseDropdownOpen: Dialogs['phaseDropdownOpen'];
    setPhaseDropdownOpen: Dialogs['setPhaseDropdownOpen'];
    gimmickDropdownOpen: Dialogs['gimmickDropdownOpen'];
    setGimmickDropdownOpen: Dialogs['setGimmickDropdownOpen'];
    timeInputOpen: Dialogs['timeInputOpen'];
    setTimeInputOpen: Dialogs['setTimeInputOpen'];
    mechanicSearchOpen: Dialogs['mechanicSearchOpen'];
    setMechanicSearchOpen: Dialogs['setMechanicSearchOpen'];
    handleNavJump: (time: number) => void;
    phaseColumnCollapsed: boolean;
    labelColumnCollapsed: boolean;
    handleTogglePhaseCollapse: () => void;
    handleToggleLabelCollapse: () => void;
    phaseHeaderRef: React.RefObject<HTMLDivElement | null>;
    gimmickHeaderRef: React.RefObject<HTMLDivElement | null>;
    timeHeaderRef: React.RefObject<HTMLDivElement | null>;
    mechanicHeaderRef: React.RefObject<HTMLDivElement | null>;
    maxTime: ReturnType<typeof useTimelineDamage>['maxTime'];
    timelineEvents: MitigationState['timelineEvents'];
}

/** メモバー・コピー中バー・各種モーダル・ヘッダーのドロップダウン(スマホの軽減一覧シートより前の並び)。Timeline から移したもの(Fragment を返しラッパーは足さない)。 */
export const TimelineDialogs: React.FC<TimelineDialogsProps> = ({
    t, contentLanguage, isMemoMode, memos, clipboardEvent, setClipboardEvent, isModalOpen, setIsModalOpen, handleSave,
    handleDelete, selectedEvent, selectedTime, eventModalPosition, mobileContextMenu, setMobileContextMenu,
    handleContextEdit, handleContextAdd, handleContextDelete, isPhaseModalOpen, setIsPhaseModalOpen, selectedPhase,
    handlePhaseSave, handlePhaseDelete, setTimelineSelectMode, phases, phaseModalPosition, isLabelModalOpen,
    setIsLabelModalOpen, selectedLabel, handleLabelSave, handleLabelDelete, setLabelSelectMode, labels,
    labelModalPosition, phaseDropdownOpen, setPhaseDropdownOpen, gimmickDropdownOpen, setGimmickDropdownOpen,
    timeInputOpen, setTimeInputOpen, mechanicSearchOpen, setMechanicSearchOpen, handleNavJump, phaseColumnCollapsed,
    labelColumnCollapsed, handleTogglePhaseCollapse, handleToggleLabelCollapse, phaseHeaderRef, gimmickHeaderRef,
    timeHeaderRef, mechanicHeaderRef, maxTime, timelineEvents,
}) => {
    return (
        <>
            {/* メモモード フローティングバー */}
            {isMemoMode && (
                <MemoFloatingBar
                    memoCount={memos.length}
                    onExit={() => useMitigationStore.getState().setToolMode('idle')}
                />
            )}

            {clipboardEvent && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5 float-surface rounded-2xl transition-all duration-300 pointer-events-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-app-4xl drop-shadow-md">📋</span>
                        <div className="flex flex-col">
                            <span className="font-bold text-app-2xl leading-tight drop-shadow-md text-app-text">
                                {t('timeline.copying', { name: clipboardEvent.name ? getPhaseName(clipboardEvent.name, contentLanguage) : t('timeline.event') })}
                            </span>
                            <span className="text-app-base text-app-text-muted leading-tight">
                                {t('timeline.paste_hint')}
                            </span>
                        </div>
                    </div>
                    <Tooltip content={t('timeline.cancel_copy')}>
                        <button
                            onClick={() => setClipboardEvent(null)}
                            className="ml-3 bg-app-text/10 hover:bg-app-text/20 p-1.5 rounded-full cursor-pointer text-app-text"
                        >
                            <X size={16} />
                        </button>
                    </Tooltip>
                </div>
            )
            }

            <EventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
                initialData={selectedEvent}
                initialTime={selectedTime}
                position={eventModalPosition}
            />

            {mobileContextMenu?.event && (
                <MobileContextMenu
                    isOpen={mobileContextMenu.isOpen}
                    onClose={() => setMobileContextMenu(null)}
                    event={mobileContextMenu.event}
                    time={mobileContextMenu.time}
                    onEdit={handleContextEdit}
                    onAdd={handleContextAdd}
                    onDelete={handleContextDelete}
                    contentLanguage={contentLanguage}
                />
            )}

            <BoundaryEditModal
                isOpen={isPhaseModalOpen}
                isEdit={!!selectedPhase}
                initial={selectedPhase ? { name: selectedPhase.name, startTime: selectedPhase.startTime, endTime: selectedPhase.endTime } : undefined}
                onClose={() => setIsPhaseModalOpen(false)}
                onSave={handlePhaseSave}
                onDelete={selectedPhase ? handlePhaseDelete : undefined}
                onTimelineSelectStart={selectedPhase ? () => {
                    const anchorTime = selectedPhase.endTime ?? selectedPhase.startTime;
                    setTimelineSelectMode({ phaseId: selectedPhase.id, startTime: anchorTime, field: 'startTime' });
                    setIsPhaseModalOpen(false);
                } : undefined}
                onTimelineSelectEnd={selectedPhase ? () => {
                    const phase = phases.find(p => p.id === selectedPhase.id);
                    setTimelineSelectMode({ phaseId: selectedPhase.id, startTime: phase?.startTime ?? 0, field: 'endTime' });
                    setIsPhaseModalOpen(false);
                } : undefined}
                mode="phase"
                position={phaseModalPosition}
            />
            <BoundaryEditModal
                isOpen={isLabelModalOpen}
                isEdit={!!selectedLabel}
                initial={selectedLabel ? { name: selectedLabel.name, startTime: selectedLabel.startTime, endTime: selectedLabel.endTime } : undefined}
                onClose={() => setIsLabelModalOpen(false)}
                onSave={handleLabelSave}
                onDelete={selectedLabel ? handleLabelDelete : undefined}
                onTimelineSelectStart={selectedLabel ? () => {
                    const anchorTime = selectedLabel.endTime ?? selectedLabel.startTime;
                    setLabelSelectMode({ labelId: selectedLabel.id, startTime: anchorTime, field: 'startTime' });
                    setIsLabelModalOpen(false);
                } : undefined}
                onTimelineSelectEnd={selectedLabel ? () => {
                    const label = labels.find(l => l.id === selectedLabel.id);
                    setLabelSelectMode({ labelId: selectedLabel.id, startTime: label?.startTime ?? 0, field: 'endTime' });
                    setIsLabelModalOpen(false);
                } : undefined}
                mode="label"
                position={labelModalPosition}
            />
            <HeaderPhaseDropdown
                isOpen={phaseDropdownOpen}
                onClose={() => setPhaseDropdownOpen(false)}
                phases={phases}
                onJump={handleNavJump}
                isCollapsed={phaseColumnCollapsed}
                onToggleCollapse={handleTogglePhaseCollapse}
                triggerRef={phaseHeaderRef}
            />
            <HeaderGimmickDropdown
                isOpen={gimmickDropdownOpen}
                onClose={() => setGimmickDropdownOpen(false)}
                labels={labels}
                onJump={handleNavJump}
                triggerRef={gimmickHeaderRef}
                isCollapsed={labelColumnCollapsed}
                onToggleCollapse={handleToggleLabelCollapse}
            />
            <HeaderTimeInput
                isOpen={timeInputOpen}
                onClose={() => setTimeInputOpen(false)}
                onJump={handleNavJump}
                triggerRef={timeHeaderRef}
                maxTime={maxTime}
            />
            <HeaderMechanicSearch
                isOpen={mechanicSearchOpen}
                onClose={() => setMechanicSearchOpen(false)}
                events={timelineEvents}
                phases={phases}
                onJump={handleNavJump}
                triggerRef={mechanicHeaderRef}
            />
        </>
    );
};

interface TimelineDialogsLowerProps {
    t: TFunction;
    JOBS: ReturnType<typeof useJobs>;
    isSheetView: boolean;
    isMobileView: boolean;
    sheetToast: ReturnType<typeof useTimelineSheetViewState>['sheetToast'];
    sheetColHover: ReturnType<typeof useTimelineSheetHover>['sheetColHover'];
    sheetPopover: ReturnType<typeof useTimelineSheetViewState>['sheetPopover'];
    sheetHiddenPopover: ReturnType<typeof useTimelineSheetColumns>['sheetHiddenPopover'];
    setSheetHiddenPopover: ReturnType<typeof useTimelineSheetColumns>['setSheetHiddenPopover'];
    sheetHiddenColumns: ReturnType<typeof useTimelineSheetColumns>['sheetHiddenColumns'];
    handleCloseSheetHidden: ReturnType<typeof useTimelineSheetColumns>['handleCloseSheetHidden'];
    handleSheetPopoverPick: ReturnType<typeof useTimelineSheetTap>['handleSheetPopoverPick'];
    handleSheetPopoverClose: ReturnType<typeof useTimelineSheetTap>['handleSheetPopoverClose'];
    mitigationSelectorOpen: Dialogs['mitigationSelectorOpen'];
    setMitigationSelectorOpen: Dialogs['setMitigationSelectorOpen'];
    handleMitigationSelect: MitigationEditing['handleMitigationSelect'];
    removeMitigation: MitigationState['removeMitigation'];
    selectedMemberId: Dialogs['selectedMemberId'];
    partyMembers: MitigationState['partyMembers'];
    selectorPosition: Dialogs['selectorPosition'];
    timelineMitigations: MitigationState['timelineMitigations'];
    selectedMitigationTime: Dialogs['selectedMitigationTime'];
    jobPickerOpen: Dialogs['jobPickerOpen'];
    setJobPickerOpen: Dialogs['setJobPickerOpen'];
    handleJobSelect: MitigationEditing['handleJobSelect'];
    jobPickerPosition: Dialogs['jobPickerPosition'];
    jobPickerMemberId: Dialogs['jobPickerMemberId'];
    partySettingsOpen: boolean;
    setPartySettingsOpen: (open: boolean) => void;
    importModalOpen: Dialogs['importModalOpen'];
    setImportModalOpen: Dialogs['setImportModalOpen'];
    showGridImport: Dialogs['showGridImport'];
    setShowGridImport: Dialogs['setShowGridImport'];
    handleSheetImport: ReturnType<typeof useTimelineAutoPlan>['handleSheetImport'];
    sheetImportDefault: ReturnType<typeof useTimelineAutoPlan>['sheetImportDefault'];
    migrationConfig: Dialogs['migrationConfig'];
    handleMigrationConfirm: MitigationEditing['handleMigrationConfirm'];
    handleMigrationCancel: MitigationEditing['handleMigrationCancel'];
    confirmDialog: Dialogs['confirmDialog'];
    setConfirmDialog: Dialogs['setConfirmDialog'];
}

/** スプシ表示の小窓・軽減/ジョブ選択・パーティ設定・取り込み・移行・確認ダイアログ(スマホの軽減一覧シートより後の並び)。Timeline から移したもの(Fragment を返しラッパーは足さない)。 */
export const TimelineDialogsLower: React.FC<TimelineDialogsLowerProps> = ({
    t, JOBS, isSheetView, isMobileView, sheetToast, sheetColHover, sheetPopover, sheetHiddenPopover,
    setSheetHiddenPopover, sheetHiddenColumns, handleCloseSheetHidden, handleSheetPopoverPick,
    handleSheetPopoverClose, mitigationSelectorOpen, setMitigationSelectorOpen, handleMitigationSelect,
    removeMitigation, selectedMemberId, partyMembers, selectorPosition, timelineMitigations, selectedMitigationTime,
    jobPickerOpen, setJobPickerOpen, handleJobSelect, jobPickerPosition, jobPickerMemberId, partySettingsOpen,
    setPartySettingsOpen, importModalOpen, setImportModalOpen, showGridImport, setShowGridImport, handleSheetImport,
    sheetImportDefault, migrationConfig, handleMigrationConfirm, handleMigrationCancel, confirmDialog,
    setConfirmDialog,
}) => {
    return (
        <>
            {/* スプシ表示: 置けないマスを押したときのトースト・対象 / 鼓舞を選ぶ小窓 */}
            {isSheetView && <PlacementToast key={sheetToast?.n} message={sheetToast?.message ?? null} />}
            {isSheetView && sheetColHover && !sheetPopover && (
                <SheetColumnTooltip def={sheetColHover.def} x={sheetColHover.x} y={sheetColHover.y} />
            )}
            {isSheetView && sheetHiddenPopover && (
                <SheetHiddenPopover
                    state={sheetHiddenPopover}
                    columns={sheetHiddenColumns?.get(sheetHiddenPopover.memberId) ?? []}
                    onShow={(id) => useSheetHiddenSkillsStore.getState().show(id)}
                    onShowAll={() => {
                        useSheetHiddenSkillsStore.getState().showMany((sheetHiddenColumns?.get(sheetHiddenPopover.memberId) ?? []).map(c => c.mitigationId));
                        setSheetHiddenPopover(null);
                    }}
                    onClose={handleCloseSheetHidden}
                />
            )}
            {isSheetView && sheetPopover && (
                <SheetTargetPopover state={sheetPopover} onPick={handleSheetPopoverPick} onClose={handleSheetPopoverClose} />
            )}

            <MitigationSelector
                isOpen={mitigationSelectorOpen}
                onClose={() => setMitigationSelectorOpen(false)}
                onSelect={handleMitigationSelect}
                onRemove={removeMitigation}
                ownerId={selectedMemberId}
                jobId={selectedMemberId ? partyMembers.find(m => m.id === selectedMemberId)?.jobId || null : null}
                position={selectorPosition}
                activeMitigations={timelineMitigations.filter(m => m.ownerId === selectedMemberId)}
                selectedTime={selectedMitigationTime}
            />

            <JobPicker
                isOpen={jobPickerOpen}
                onClose={() => setJobPickerOpen(false)}
                onSelect={handleJobSelect}
                position={jobPickerPosition}
                currentJobId={jobPickerMemberId ? partyMembers.find(m => m.id === jobPickerMemberId)?.jobId || null : null}
            />

            {/* PC版のみ: PartySettingsModal（モバイルはLayout.tsxのMobileBottomSheetで表示） */}
            {!isMobileView && (
                <PartySettingsModal
                    isOpen={partySettingsOpen}
                    onClose={() => setPartySettingsOpen(false)}
                />
            )}

            <FFLogsImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
            />

            {/* 列グリッド取込モーダル: handleSheetImport / sheetImportDefault を利用 */}
            <SpreadsheetGridImportModal
                isOpen={showGridImport}
                onClose={() => setShowGridImport(false)}
                onImport={handleSheetImport}
                defaultSelection={sheetImportDefault}
            />

            {
                migrationConfig && (
                    <JobMigrationModal
                        isOpen={migrationConfig.isOpen}
                        onConfirm={handleMigrationConfirm}
                        onCancel={handleMigrationCancel}
                        oldJob={JOBS.find(j => j.id === migrationConfig.oldJobId) || JOBS[0]}
                        newJob={JOBS.find(j => j.id === migrationConfig.newJobId) || JOBS[0]}
                        memberName={partyMembers.find(m => m.id === migrationConfig.memberId)?.id || ''}
                    />
                )
            }

            <ConfirmDialog
                isOpen={confirmDialog !== null}
                title={confirmDialog?.title ?? ''}
                message={confirmDialog?.message ?? ''}
                variant={confirmDialog?.variant ?? 'danger'}
                onConfirm={() => confirmDialog?.onConfirm?.()}
                onCancel={() => setConfirmDialog(null)}
                confirmLabel={confirmDialog?.confirmLabel ?? t('ui.ok', 'OK')}
                cancelLabel={confirmDialog?.cancelLabel ?? t('common.cancel', 'キャンセル')}
            />
        </>
    );
};
