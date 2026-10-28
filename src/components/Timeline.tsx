import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TimelineScrollArea } from './timeline/TimelineScrollArea';

import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { useCollabJoinerSession } from '../store/useCollabJoinerSession';
import { useTutorialStore } from '../store/useTutorialStore';
import { useThemeStore, useEffectiveTimelineView } from '../store/useThemeStore';
import type { PartyMember } from '../types';

import { useJobs, useMitigations } from '../hooks/useSkillsData';
import clsx from 'clsx';
import { DEFAULT_FIGHT_DURATION_SEC } from '../constants/timeline';
import { EMPTY_ROW_LAYOUT, type RowLayout } from './timeline/rowLayout';
import { useTimelineMobileScrollChrome } from './timeline/useTimelineMobileScrollChrome';
import { useTimelineAaEscape, useTimelineShortcutKeys, useTimelineEscapeKeys } from './timeline/useTimelineKeyboard';
import { useTimelineEditing } from './timeline/useTimelineEditing';
import { useTimelineMitigationEditing } from './timeline/useTimelineMitigationEditing';
import { useTimelineDialogs } from './timeline/useTimelineDialogs';
import { useTimelineAutoPlan } from './timeline/useTimelineAutoPlan';
import { useTimelineHeaderEvents, useTimelineTutorialEvents, useTimelineProgressJump, useTimelineResetUiEvent, useTimelineClearMenuOutsideClick } from './timeline/useTimelineWindowEvents';
import { useTimelineViewMode, useTimelineSheetWidth, useTimelineColumnCollapse, useTimelineRowLayout, useTimelinePartyOrder, useTimelineMemberXMap, useTimelineHoverGeom } from './timeline/useTimelineLayout';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import type { RecastRowHandle } from './RecastRow';
import { useTimelineDamage } from './timeline/useTimelineDamage';
import { useTimelinePreviewHighlight } from './timeline/useTimelinePreviewHighlight';
import { useTimelinePip } from './timeline/useTimelinePip';
import { TimelinePipLayer } from './timeline/TimelinePipLayer';
import './timeline/sheet/sheet.css';
import { TimelineControlBar } from './timeline/TimelineControlBar';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelinePopovers } from './timeline/TimelinePopovers';
import { TimelineDialogs, TimelineDialogsLower } from './timeline/TimelineDialogs';
import { TimelineMobileSheets } from './timeline/TimelineMobileSheets';
import { TimelineMobileTools } from './timeline/TimelineMobileTools';
import { TimelineModeBars } from './timeline/TimelineModeBars';
import './Timeline.css';
import { TimelineEmptyGlass } from './timeline/TimelineEmptyGlass';
import { useTimelineConflictPoints } from './timeline/useTimelineConflictPoints';
import { useTimelineStoreBindings } from './timeline/useTimelineStoreBindings';
import { useTimelineNavJump, useTimelinePlanScrollReset, useTimelineScrollSync } from './timeline/useTimelineScrollSync';
import { useCollabPresenceStore } from '../store/useCollabPresenceStore';

import { useTimelineMemo, useTimelineCursorSend } from './timeline/useTimelineMemoCursor';
import { useTimelineSheetViewState, useTimelineSheetTap, useTimelineSheetColumns, useTimelineSheetHover } from './timeline/useTimelineSheetView';
import { resolveContentId, isJoinerReadonly } from './timelineJoinerState';
import { matchesMobile } from '../hooks/useIsMobile';

const Timeline: React.FC = () => {
    const { contentLanguage, mobileEffectBarMode } = useThemeStore();
    const { t } = useTranslation();
    const MITIGATIONS = useMitigations();
    const JOBS = useJobs();
    const {
        mobilePartyOpen, setMobilePartyOpen,
        mobileToolsOpen, setMobileToolsOpen,
        setMobileMenuOpen,
    } = useContext(MobileTriggersContext);

    // ⑤-3b: ジョイナー読み取り専用。roomToken があれば全編集アフォーダンスを無効化/非表示。
    // ref も保持し、宣言より前(ファイル上方)に定義された編集ハンドラからも deps なしで現在値を読む。
    const joinerRoomToken = useCollabJoinerSession(s => s.roomToken);
    const joinerCanEdit = useCollabJoinerSession(s => s.canEdit);
    const readOnly = isJoinerReadonly(joinerRoomToken, joinerCanEdit);
    const readOnlyRef = useRef(readOnly);
    readOnlyRef.current = readOnly;

    const {
        aaSettings, partyMembers, timelineMitigations, timelineEvents, phases,
        clipboardEvent, hideEmptyRows: storedHideEmptyRows, currentLevel, laneRowBorders, sheetRowBorders, hiddenPartyMemberIds,
        partySortOrder, collabReadonly, canUndo, canRedo, toolMode, memos,
        addEvent, updateEvent, removeEvent, addMitigation, setMemberJob, setAaSettings, removeMitigation, updateMitigationTime,
        addPhase, updatePhase, removePhase, updatePhaseEndTime, updatePhaseStartTime,
        labels, addLabel, updateLabel, removeLabel, updateLabelEndTime, updateLabelStartTime,
        changeMemberJobWithMitigations, setClipboardEvent, lastPlacedMitigationId,
    } = useTimelineStoreBindings();
    const isMemoMode = toolMode === 'memo';
    // スプシ表示か(PC・WIP権限のみ。それ以外は常に 'lanes')。メモ/カーソルの横位置変換にだけ使う。
    const isSheetView = useEffectiveTimelineView() === 'sheet';
    // 罫線はふつう表示とスプシ表示で別の設定(スプシ側の既定は ON)。以降は表示中の側の値を showRowBorders として使う
    const showRowBorders = isSheetView ? sheetRowBorders : laneRowBorders;
    const toggleRowBorders = useCallback(() => {
        const st = useMitigationStore.getState();
        if (isSheetView) st.setSheetRowBorders(!st.sheetRowBorders);
        else st.setShowRowBorders(!st.showRowBorders);
    }, [isSheetView]);
    const { sheetColumnMapRef, sheetToast, setSheetToast, sheetPopover, setSheetPopover } = useTimelineSheetViewState({ isSheetView });
    // メモ・カーソルの横位置変換(保存・送信する xRatio は常にレーン表示の座標)。
    // 実体は memberLayout が決まった後(下方)で毎 render 差し替える。ハンドラは ref 経由で読む。
    const memberXMapRef = useRef<{ toPx: (xRatio: number) => number; toRatio: (px: number) => number }>({
        toPx: (r) => r,
        toRatio: (px) => px,
    });
    // PiP カンペビュー
    const [videoModalOpen, setVideoModalOpen] = useState(false);
    const {
        pipWindow, pipContainer, pipMenuOpen, setPipMenuOpen, pipMenuPos, pipMenuRef, pipSupported,
        handleOpenPip, handleClosePip, openPipMenu, scheduleClosePipMenu, cancelClosePipMenu,
    } = useTimelinePip();

    // 窓(モーダル・ポップオーバー・ドロップダウン・選択モード)の開閉 state
    const {
        isModalOpen, setIsModalOpen, selectedEvent, setSelectedEvent, selectedTime, setSelectedTime,
        eventModalPosition, setEventModalPosition, eventPopover, setEventPopover,
        isPhaseModalOpen, setIsPhaseModalOpen, selectedPhase, setSelectedPhase, selectedPhaseTime, setSelectedPhaseTime,
        phaseModalPosition, setPhaseModalPosition, timelineSelectMode, setTimelineSelectMode, labelSelectMode, setLabelSelectMode,
        phasePopover, setPhasePopover,
        isLabelModalOpen, setIsLabelModalOpen, selectedLabel, setSelectedLabel, selectedLabelTime, setSelectedLabelTime,
        labelModalPosition, setLabelModalPosition, labelPopover, setLabelPopover,
        mobileMitiFlow, setMobileMitiFlow, mobileContextMenu, setMobileContextMenu,
        mitigationSelectorOpen, setMitigationSelectorOpen, selectorPosition, setSelectorPosition,
        selectedMemberId, setSelectedMemberId, selectedMitigationTime, setSelectedMitigationTime,
        jobPickerOpen, setJobPickerOpen, jobPickerPosition, setJobPickerPosition, jobPickerMemberId, setJobPickerMemberId,
        phaseDropdownOpen, setPhaseDropdownOpen, gimmickDropdownOpen, setGimmickDropdownOpen,
        timeInputOpen, setTimeInputOpen, mechanicSearchOpen, setMechanicSearchOpen,
        migrationConfig, setMigrationConfig,
        importModalOpen, setImportModalOpen, showGridImport, setShowGridImport, confirmDialog, setConfirmDialog,
        clearMenuOpen, setClearMenuOpen,
    } = useTimelineDialogs();
    const [showPreStart] = useState(true);
    const { isMobileTimeline, isMilspecTable, rowUnitPx } = useTimelineViewMode();
    // プレビュー強調フックが参照する ref(scrollContainerRef / rowLayoutRef は宣言位置のみここへ前出し)
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    // 行の配置係の最新値。コールバック(スクロール同期・ジャンプ・範囲選択)は描画後にこれを読む。
    // 書き込みは rowLayout の useMemo の直後(描画中)で 1 回だけ。
    const rowLayoutRef = useRef<RowLayout>(EMPTY_ROW_LAYOUT);
    const { overlayRef, throttledUpdatePreview } = useTimelinePreviewHighlight({
        scrollContainerRef, rowLayoutRef, timelineSelectMode, labelSelectMode, showPreStart,
    });
    const sheetContainerRef = useRef<HTMLDivElement>(null);
    const { sheetWidth, sheetWidthRef, maxMitiIconsPerRow } = useTimelineSheetWidth({ sheetContainerRef });


    const {
        phaseColumnCollapsed, labelColumnCollapsed, recastRowVisible,
        handleTogglePhaseCollapse, handleToggleLabelCollapse, handleToggleRecastRowVisible,
    } = useTimelineColumnCollapse();
    const phaseHeaderRef = useRef<HTMLDivElement>(null);
    const gimmickHeaderRef = useRef<HTMLDivElement>(null);
    const timeHeaderRef = useRef<HTMLDivElement>(null);
    const mechanicHeaderRef = useRef<HTMLDivElement>(null);


    const fightDuration = DEFAULT_FIGHT_DURATION_SEC;

    const hasLabels = labels.length > 0;
    const labelColumnVisible = !labelColumnCollapsed && !(phaseColumnCollapsed && !hasLabels);

    const { handleNavJump } = useTimelineNavJump({ scrollContainerRef, rowLayoutRef });


    // 現在のプラン(sheetImportDefault と currentContentId の元)。使う位置(上)へ元の宣言位置から移動(store 購読のみ・順序影響なし)。
    const currentPlan = usePlanStore(s => s.plans.find(p => p.id === s.currentPlanId));
    // ⑤-3b: ジョイナー(SavedPlan 無し)は一時セッションの contentId にフォールバック。
    const joinerContentId = useCollabJoinerSession(s => s.contentId);
    const currentContentId = resolveContentId(currentPlan?.contentId ?? null, joinerContentId);

    const {
        handleAutoPlan, sheetImportDefault, handleSheetImport,
        isAaModeEnabled, setIsAaModeEnabled,
        aaSettingsOpen, setAaSettingsOpen,
    } = useTimelineAutoPlan({ readOnlyRef, setConfirmDialog, currentContentId, currentPlan, t });

    useTimelineHeaderEvents({ handleAutoPlan, setImportModalOpen, setShowGridImport });

    // メモ・カーソル送信フックへ渡すため、元の宣言位置(後方)からここへ移動(useRef のみ・順序影響なし)。
    const timeToYMapRef = useRef(new Map<number, number>());
    const {
        memoInput, setMemoInput, handleSheetClick,
        handleMemoSave, handleMemoDragEnd, handleMemoDelete, handleMemoClick,
    } = useTimelineMemo({
        sheetContainerRef, timeToYMapRef, memberXMapRef, readOnlyRef,
        isMemoMode, memos, isSheetView, sheetWidth, t,
    });


    // パーティ設定: PC用のローカルstate + モバイル用のContext
    const [partySettingsOpenLocal, setPartySettingsOpenLocal] = useState(false);
    // モバイルではContext経由、PCではローカルstate
    const isMobileView = matchesMobile(window);
    const partySettingsOpen = isMobileView ? mobilePartyOpen : partySettingsOpenLocal;
    const setPartySettingsOpen = isMobileView ? setMobilePartyOpen : setPartySettingsOpenLocal;

    // ツール: モバイルではContext経由
    const mobileToolsSheetOpen = mobileToolsOpen;
    const setMobileToolsSheetOpen = setMobileToolsOpen;

    // Tutorial auto-open logic
    const { isActive: tutorialActive, currentStepIndex: tutorialStepIndex } = useTutorialStore();
    useTimelineTutorialEvents({
        tutorialActive, tutorialStepIndex, mobilePartyOpen, isMobileView,
        setIsAaModeEnabled, setAaSettingsOpen, setPartySettingsOpenLocal, setMobilePartyOpen,
        setMitigationSelectorOpen, setIsModalOpen, setPhaseDropdownOpen, setGimmickDropdownOpen, setMechanicSearchOpen,
    });

    useTimelineProgressJump({ handleNavJump, timeToYMapRef });


    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const aaSettingsButtonRef = useRef<HTMLButtonElement>(null);
    // 切り替えた直後の描画から切り替え後の値で描く(全行を作って捨てない)。以降の hideEmptyRows はこれ
    const hideEmptyRows = useTimelinePlanScrollReset({ scrollContainerRef, currentPlanId, joinerRoomToken, hideEmptyRows: storedHideEmptyRows });
    const headerRef = useRef<HTMLDivElement>(null);
    const controlBarRef = useRef<HTMLDivElement>(null);
    // syncRecastRow がスクロール毎にY最近傍の時刻を逆引きするための索引。
    // timeToYMapをforEachで毎回全走査していたのをY昇順ソート済み配列+二分探索に変える
    // (2026-08-14ユーザー実機報告「スマホでスクロールが重い/変身アニメがとびとび」対応。
    // 長い戦闘ほどtimeToYMapの要素数が増え、毎スクロールイベントでの全走査コストが
    // 積み重なりメインスレッドを塞いでいた)。中身はtimeToYMapと同じタイミング(レイアウト
    // 再計算時)でのみ作り直し、スクロール中は読むだけ。
    const sortedTimeYRef = useRef<[number, number][]>([]);
    const recastRowRef = useRef<RecastRowHandle>(null);

    // ④-b-2: 他者カーソル描画は CursorOverlay に隔離。Timeline は roster も byClient(高頻度)も購読しない。
    // (ここで byClient を購読すると「カーソル1パケットごとに Timeline 全体が再描画」され激重になる。)
    // CursorOverlay 自身が roster を購読し、受信座標は rAF で getState() 直読みする。
    // ここで cursorEnabled を購読するのは自分のカーソル送信判定(下の送信ループ)にだけ使うため。
    const myCursorEnabled = useCollabPresenceStore(s => s.cursorEnabled);

    // ④-b-2: 自分のカーソル送信。pointermove は ref に書くだけ(setState しない)。
    // ~15Hz の rAF 間引きで (timeSec,xRatio) に変換し、前回から動いた時だけ P2P broadcast。
    // cursorEnabled が ON のときだけリスナと送信ループを張る(OFF=送信ゼロ=IP 露出ゼロ)。
    useTimelineCursorSend({
        sheetContainerRef, timeToYMapRef, memberXMapRef, myCursorEnabled, sheetWidth,
    });

    const { handleScrollSync, syncRecastRow } = useTimelineScrollSync({
        scrollContainerRef, headerRef, controlBarRef, recastRowRef, timeToYMapRef, sortedTimeYRef,
        hideEmptyRows, showPreStart, recastRowVisible, timelineMitigations,
    });

    // スマホのフェーズ名スクラブ表示・エフェクト棒/FAB のスクロール連動(useEffect 4 本もここに含む)
    const { mobilePhaseCurRef, mobilePhaseNextRef, undoRedoWrapRef, syncMobilePhaseLabel } = useTimelineMobileScrollChrome({
        scrollContainerRef, rowLayoutRef, phases, contentLanguage, t, isMobileTimeline,
        mobileEffectBarMode, timelineMitigations, timelineEvents,
    });

    useTimelineAaEscape({ isAaModeEnabled, setIsAaModeEnabled });




    const { eventsByTime, rowLayout } = useTimelineRowLayout({
        fightDuration, timelineEvents, timelineMitigations, hideEmptyRows, rowUnitPx,
        rowLayoutRef, timeToYMapRef, sortedTimeYRef,
    });

    // 行の位置が変わったら(攻撃の追加・空の行を隠すの切り替えなど)、スクロールを待たずに
    // リキャスト行とスマホのフェーズ表示を今の行の位置で合わせ直す(どちらもふだんはスクロール時にしか更新されない)
    useEffect(() => {
        syncRecastRow();
        syncMobilePhaseLabel();
    }, [rowLayout, syncRecastRow, syncMobilePhaseLabel]);

    const {
        handleAddClick, handlePhaseAdd, handlePhaseEdit, handlePhaseSave, handlePhaseDelete,
        handleLabelAdd, handleLabelEdit, handleLabelSave, handleLabelDelete,
        handleEventClick, handlePopoverEdit, handlePopoverAdd, handlePopoverDelete,
        handleSave, handleDelete,
    } = useTimelineEditing({
        selectedEvent, setSelectedEvent, setSelectedTime, setEventModalPosition, setIsModalOpen,
        eventPopover, setEventPopover, setConfirmDialog,
        selectedPhase, setSelectedPhase, selectedPhaseTime, setSelectedPhaseTime,
        setPhaseModalPosition, setIsPhaseModalOpen, setPhasePopover,
        selectedLabel, setSelectedLabel, selectedLabelTime, setSelectedLabelTime,
        setLabelModalPosition, setIsLabelModalOpen, setLabelPopover,
        addEvent, updateEvent, removeEvent,
        addPhase, updatePhase, removePhase, updatePhaseStartTime, updatePhaseEndTime,
        addLabel, updateLabel, removeLabel, updateLabelStartTime, updateLabelEndTime,
        readOnlyRef, isAaModeEnabled, setIsAaModeEnabled, phases, labels, scrollContainerRef, timeToYMapRef, t,
    });

    const { handleSheetCellTap, handleSheetPopoverPick, handleSheetPopoverClose } = useTimelineSheetTap({
        t, MITIGATIONS, readOnlyRef, sheetToast, setSheetToast, sheetPopover, setSheetPopover,
    });

    const {
        handleCellClick,
        stableAddClick, stablePhaseAdd, stableLabelAdd, stableEventClick, stableCellClick,
        stableMobileDamageClick, stableMobileLongPress, stableTimelineSelect, stableTimelineSelectHover,
        handleContextEdit, handleContextAdd, handleContextDelete,
        handleMitigationSelect, handleJobIconClick, handleJobSelect,
        handleMigrationConfirm, handleMigrationCancel,
    } = useTimelineMitigationEditing({
        setSelectedEvent, setSelectedTime, setIsModalOpen, setConfirmDialog,
        setSelectorPosition, setSelectedMemberId, setSelectedMitigationTime, setMitigationSelectorOpen,
        selectedMemberId, selectedMitigationTime,
        setMobileMitiFlow, mobileContextMenu, setMobileContextMenu,
        labelSelectMode, setLabelSelectMode, timelineSelectMode, setTimelineSelectMode,
        setJobPickerPosition, setJobPickerMemberId, setJobPickerOpen, jobPickerMemberId,
        migrationConfig, setMigrationConfig,
        removeEvent, addMitigation, setMemberJob, changeMemberJobWithMitigations,
        updateLabelStartTime, updateLabelEndTime, updatePhaseStartTime, updatePhaseEndTime,
        readOnlyRef, sheetColumnMapRef, handleSheetCellTap,
        handleAddClick, handlePhaseAdd, handleLabelAdd, handleEventClick,
        setMobilePartyOpen, setMobileToolsOpen, setMobileMenuOpen, throttledUpdatePreview,
        partyMembers, timelineMitigations, t,
    });

    const {
        maxTime, conflictingIds, mobileConflictingIds, damageMap, rowSwapMarkers, rowLabels,
        livingDeadTriggers, shieldExhaustedAt, barrierOverwrittenAt,
    } = useTimelineDamage({ timelineEvents, timelineMitigations, partyMembers, phases, eventsByTime, lastPlacedMitigationId });

    const clearMenuButtonRef = useRef<HTMLButtonElement>(null);

    useTimelineShortcutKeys({
        readOnlyRef, phaseDropdownOpen, gimmickDropdownOpen,
        setPhaseDropdownOpen, setGimmickDropdownOpen, setTimeInputOpen, setMechanicSearchOpen,
        handleTogglePhaseCollapse, handleToggleLabelCollapse,
    });

    useTimelineResetUiEvent({ setIsAaModeEnabled });

    useTimelineEscapeKeys({
        eventPopover, setEventPopover, clipboardEvent, setClipboardEvent,
        timelineSelectMode, setTimelineSelectMode, labelSelectMode, setLabelSelectMode,
        throttledUpdatePreview,
    });

    useTimelineClearMenuOutsideClick({ clearMenuOpen, setClearMenuOpen });

    const { sortedPartyMembers, visiblePartyMembers } = useTimelinePartyOrder({ partyMembers, partySortOrder, hiddenPartyMemberIds });

    const {
        sheetColumnMap, sheetHiddenColumns, sheetHiddenPopover, setSheetHiddenPopover,
        handleOpenSheetHidden, handleCloseSheetHidden, handleHideSheetColumn, sheetCols,
    } = useTimelineSheetColumns({ isSheetView, visiblePartyMembers, MITIGATIONS, currentLevel, sheetColumnMapRef });

    // 軍事の表: リキャスト中のアイコンが無い列の見出し = ロール色の短い線 + ジョブ略号(見本 v11 css:472-475)
    const renderMilspecIdle = useCallback((m: PartyMember) => {
        const job = m.jobId ? JOBS.find((j) => j.id === m.jobId) : null;
        return (
            <>
                <i className="milspec-mh-rl" />
                <small>{job ? job.id.toUpperCase() : ''}</small>
            </>
        );
    }, [JOBS]);

    // DOM 計測ベースの memberLayout・横位置変換
    const { getMemberRefCallback, memberLayout, memberXMap } = useTimelineMemberXMap({
        sortedPartyMembers, visiblePartyMembers, isSheetView, sheetWidth, sheetContainerRef, scrollContainerRef, memberXMapRef,
    });

    const { sheetColHover, handleSheetPointerMove, handleSheetPointerLeave } = useTimelineSheetHover({
        sheetContainerRef, sheetColumnMap, visiblePartyMembers, memberLayout,
    });
    const { hoverGeomRef, cursorToLocalXRef } = useTimelineHoverGeom({
        isSheetView, visiblePartyMembers, memberLayout, sheetColumnMap, rowLayout, memberXMap, sheetWidthRef,
    });

    const conflictPoints = useTimelineConflictPoints({
        timelineMitigations, conflictingIds, lastPlacedMitigationId, hiddenPartyMemberIds,
        rowLayout, isMobileTimeline, sheetWidth, memberLayout, sheetColumnMap, MITIGATIONS,
    });

    const getJobIcon = (jobId: string | null) => {
        if (!jobId) return null;
        const job = JOBS.find(j => j.id === jobId);
        return job ? job.icon : null;
    };

    return (
        <>
            {/* ── Main Content Column ── */}
            {/* container max-width は Layout.tsx の data-app-shell に適用済み (全体中央寄せ) */}
            <div data-timeline-root className="flex flex-col h-full w-full bg-transparent overflow-hidden relative z-[1]">
                <div className="absolute inset-0 pointer-events-none"></div>

                <div className={clsx(
                    "relative flex-1 flex flex-col pt-0 glass-panel overflow-hidden transition-all duration-300 ease-out",
                    "h-full z-[1]",
                    isMobileTimeline
                        ? "rounded-none mx-0 mt-0"
                        : "mx-0 mt-0 mb-0 rounded-none"
                )}>
                    <TimelineEmptyGlass />
                    <TimelineControlBar
                        controlBarRef={controlBarRef} t={t} isMilspecTable={isMilspecTable} isSheetView={isSheetView} readOnly={readOnly} contentLanguage={contentLanguage}
                        hideEmptyRows={hideEmptyRows} isMemoMode={isMemoMode} showRowBorders={showRowBorders} toggleRowBorders={toggleRowBorders}
                        pipSupported={pipSupported} pipWindow={pipWindow} pipMenuOpen={pipMenuOpen} pipMenuRef={pipMenuRef} openPipMenu={openPipMenu} scheduleClosePipMenu={scheduleClosePipMenu} handleClosePip={handleClosePip}
                        recastRowVisible={recastRowVisible} handleToggleRecastRowVisible={handleToggleRecastRowVisible}
                        isAaModeEnabled={isAaModeEnabled} setIsAaModeEnabled={setIsAaModeEnabled} aaSettingsOpen={aaSettingsOpen} setAaSettingsOpen={setAaSettingsOpen} aaSettingsButtonRef={aaSettingsButtonRef} aaSettings={aaSettings} setAaSettings={setAaSettings}
                        canUndo={canUndo} canRedo={canRedo} clearMenuOpen={clearMenuOpen} setClearMenuOpen={setClearMenuOpen} clearMenuButtonRef={clearMenuButtonRef}
                        partyMembers={partyMembers} timelineMitigations={timelineMitigations} setConfirmDialog={setConfirmDialog}
                        visiblePartyMembers={visiblePartyMembers} partySortOrder={partySortOrder} memberLayout={memberLayout} getJobIcon={getJobIcon} JOBS={JOBS} handleJobIconClick={handleJobIconClick} getMemberRefCallback={getMemberRefCallback}
                        sheetCols={sheetCols} sheetHiddenColumns={sheetHiddenColumns} handleOpenSheetHidden={handleOpenSheetHidden}
                    />

                    <TimelineHeader
                        headerRef={headerRef} t={t} isMobileTimeline={isMobileTimeline} isMobileView={isMobileView} isMilspecTable={isMilspecTable}
                        phases={phases} phaseColumnCollapsed={phaseColumnCollapsed} labelColumnVisible={labelColumnVisible}
                        phaseHeaderRef={phaseHeaderRef} gimmickHeaderRef={gimmickHeaderRef} timeHeaderRef={timeHeaderRef} mechanicHeaderRef={mechanicHeaderRef} recastRowRef={recastRowRef}
                        phaseDropdownOpen={phaseDropdownOpen} setPhaseDropdownOpen={setPhaseDropdownOpen} gimmickDropdownOpen={gimmickDropdownOpen} setGimmickDropdownOpen={setGimmickDropdownOpen}
                        timeInputOpen={timeInputOpen} setTimeInputOpen={setTimeInputOpen} mechanicSearchOpen={mechanicSearchOpen} setMechanicSearchOpen={setMechanicSearchOpen}
                        handleTogglePhaseCollapse={handleTogglePhaseCollapse} handleToggleLabelCollapse={handleToggleLabelCollapse}
                        sheetColumnMap={sheetColumnMap} visiblePartyMembers={visiblePartyMembers} handleHideSheetColumn={handleHideSheetColumn}
                        timelineMitigations={timelineMitigations} MITIGATIONS={MITIGATIONS} renderMilspecIdle={renderMilspecIdle}
                    />

                    <TimelineScrollArea
                        t={t} scrollContainerRef={scrollContainerRef} currentPlanId={currentPlanId} isMobileTimeline={isMobileTimeline} collabReadonly={collabReadonly} handleScrollSync={handleScrollSync} isMobileView={isMobileView}
                        phases={phases} mobilePhaseCurRef={mobilePhaseCurRef} mobilePhaseNextRef={mobilePhaseNextRef} conflictPoints={conflictPoints}
                        sheetContainerRef={sheetContainerRef} handleSheetClick={handleSheetClick} isSheetView={isSheetView} handleSheetPointerMove={handleSheetPointerMove} handleSheetPointerLeave={handleSheetPointerLeave} rowLayout={rowLayout}
                        timelineMitigations={timelineMitigations} showPreStart={showPreStart} sheetWidth={sheetWidth} hiddenPartyMemberIds={hiddenPartyMemberIds} MITIGATIONS={MITIGATIONS} hideEmptyRows={hideEmptyRows} maxTime={maxTime} eventsByTime={eventsByTime}
                        shieldExhaustedAt={shieldExhaustedAt} barrierOverwrittenAt={barrierOverwrittenAt} mobileConflictingIds={mobileConflictingIds}
                        damageMap={damageMap} sortedPartyMembers={sortedPartyMembers} visiblePartyMembers={visiblePartyMembers}
                        stableMobileDamageClick={stableMobileDamageClick} stableMobileLongPress={stableMobileLongPress} stablePhaseAdd={stablePhaseAdd} stableLabelAdd={stableLabelAdd} stableAddClick={stableAddClick}
                        stableEventClick={stableEventClick} stableCellClick={stableCellClick} stableTimelineSelect={stableTimelineSelect} stableTimelineSelectHover={stableTimelineSelectHover}
                        phaseColumnCollapsed={phaseColumnCollapsed} labelColumnVisible={labelColumnVisible} timelineSelectMode={timelineSelectMode} labelSelectMode={labelSelectMode}
                        showRowBorders={showRowBorders} sheetCols={sheetCols} rowSwapMarkers={rowSwapMarkers} rowLabels={rowLabels} maxMitiIconsPerRow={maxMitiIconsPerRow}
                        hoverGeomRef={hoverGeomRef} labels={labels} contentLanguage={contentLanguage} overlayRef={overlayRef}
                        partyMembers={partyMembers} memberLayout={memberLayout} sheetColumnMap={sheetColumnMap} livingDeadTriggers={livingDeadTriggers} readOnly={readOnly} removeMitigation={removeMitigation} updateMitigationTime={updateMitigationTime}
                        partySortOrder={partySortOrder} conflictingIds={conflictingIds} lastPlacedMitigationId={lastPlacedMitigationId} handleCellClick={handleCellClick} isMilspecTable={isMilspecTable}
                        memos={memos} timeToYMapRef={timeToYMapRef} memberXMap={memberXMap} isMemoMode={isMemoMode} handleMemoDragEnd={handleMemoDragEnd} handleMemoClick={handleMemoClick} handleMemoDelete={handleMemoDelete}
                        sheetWidthRef={sheetWidthRef} cursorToLocalXRef={cursorToLocalXRef} memoInput={memoInput} handleMemoSave={handleMemoSave} setMemoInput={setMemoInput}
                    />
                </div>
            </div>

            <TimelineDialogs
                t={t} contentLanguage={contentLanguage} isMemoMode={isMemoMode} memos={memos} clipboardEvent={clipboardEvent} setClipboardEvent={setClipboardEvent}
                isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} handleSave={handleSave} handleDelete={handleDelete} selectedEvent={selectedEvent}
                selectedTime={selectedTime} eventModalPosition={eventModalPosition} mobileContextMenu={mobileContextMenu} setMobileContextMenu={setMobileContextMenu}
                handleContextEdit={handleContextEdit} handleContextAdd={handleContextAdd} handleContextDelete={handleContextDelete}
                isPhaseModalOpen={isPhaseModalOpen} setIsPhaseModalOpen={setIsPhaseModalOpen} selectedPhase={selectedPhase} handlePhaseSave={handlePhaseSave}
                handlePhaseDelete={handlePhaseDelete} setTimelineSelectMode={setTimelineSelectMode} phases={phases} phaseModalPosition={phaseModalPosition}
                isLabelModalOpen={isLabelModalOpen} setIsLabelModalOpen={setIsLabelModalOpen} selectedLabel={selectedLabel} handleLabelSave={handleLabelSave}
                handleLabelDelete={handleLabelDelete} setLabelSelectMode={setLabelSelectMode} labels={labels} labelModalPosition={labelModalPosition}
                phaseDropdownOpen={phaseDropdownOpen} setPhaseDropdownOpen={setPhaseDropdownOpen} gimmickDropdownOpen={gimmickDropdownOpen}
                setGimmickDropdownOpen={setGimmickDropdownOpen} timeInputOpen={timeInputOpen} setTimeInputOpen={setTimeInputOpen}
                mechanicSearchOpen={mechanicSearchOpen} setMechanicSearchOpen={setMechanicSearchOpen} handleNavJump={handleNavJump}
                phaseColumnCollapsed={phaseColumnCollapsed} labelColumnCollapsed={labelColumnCollapsed} handleTogglePhaseCollapse={handleTogglePhaseCollapse}
                handleToggleLabelCollapse={handleToggleLabelCollapse} phaseHeaderRef={phaseHeaderRef} gimmickHeaderRef={gimmickHeaderRef}
                timeHeaderRef={timeHeaderRef} mechanicHeaderRef={mechanicHeaderRef} maxTime={maxTime} timelineEvents={timelineEvents}
            />

            <TimelineMobileSheets
                t={t} contentLanguage={contentLanguage} mobileMitiFlow={mobileMitiFlow} setMobileMitiFlow={setMobileMitiFlow} timelineEvents={timelineEvents}
                timelineMitigations={timelineMitigations} partyMembers={partyMembers} currentLevel={currentLevel} MITIGATIONS={MITIGATIONS} JOBS={JOBS}
                sortedPartyMembers={sortedPartyMembers} addMitigation={addMitigation} removeMitigation={removeMitigation}
            />

            <TimelineDialogsLower
                t={t} JOBS={JOBS} isSheetView={isSheetView} isMobileView={isMobileView} sheetToast={sheetToast} sheetColHover={sheetColHover}
                sheetPopover={sheetPopover} sheetHiddenPopover={sheetHiddenPopover} setSheetHiddenPopover={setSheetHiddenPopover}
                sheetHiddenColumns={sheetHiddenColumns} handleCloseSheetHidden={handleCloseSheetHidden} handleSheetPopoverPick={handleSheetPopoverPick}
                handleSheetPopoverClose={handleSheetPopoverClose} mitigationSelectorOpen={mitigationSelectorOpen}
                setMitigationSelectorOpen={setMitigationSelectorOpen} handleMitigationSelect={handleMitigationSelect} removeMitigation={removeMitigation}
                selectedMemberId={selectedMemberId} partyMembers={partyMembers} selectorPosition={selectorPosition} timelineMitigations={timelineMitigations}
                selectedMitigationTime={selectedMitigationTime} jobPickerOpen={jobPickerOpen} setJobPickerOpen={setJobPickerOpen} handleJobSelect={handleJobSelect}
                jobPickerPosition={jobPickerPosition} jobPickerMemberId={jobPickerMemberId} partySettingsOpen={partySettingsOpen}
                setPartySettingsOpen={setPartySettingsOpen} importModalOpen={importModalOpen} setImportModalOpen={setImportModalOpen} showGridImport={showGridImport}
                setShowGridImport={setShowGridImport} handleSheetImport={handleSheetImport} sheetImportDefault={sheetImportDefault} migrationConfig={migrationConfig}
                handleMigrationConfirm={handleMigrationConfirm} handleMigrationCancel={handleMigrationCancel} confirmDialog={confirmDialog}
                setConfirmDialog={setConfirmDialog}
            />
            <TimelineMobileTools
                t={t} tutorialActive={tutorialActive} undoRedoWrapRef={undoRedoWrapRef} canUndo={canUndo} canRedo={canRedo} readOnly={readOnly}
                mobileToolsSheetOpen={mobileToolsSheetOpen} setMobileToolsSheetOpen={setMobileToolsSheetOpen} setImportModalOpen={setImportModalOpen}
            />
            <TimelinePopovers
                t={t} phasePopover={phasePopover} setPhasePopover={setPhasePopover} handlePhaseEdit={handlePhaseEdit} setPhaseModalPosition={setPhaseModalPosition}
                setSelectedPhaseTime={setSelectedPhaseTime} setSelectedPhase={setSelectedPhase} setIsPhaseModalOpen={setIsPhaseModalOpen} removePhase={removePhase}
                labelPopover={labelPopover} setLabelPopover={setLabelPopover} handleLabelEdit={handleLabelEdit} setLabelModalPosition={setLabelModalPosition}
                setSelectedLabelTime={setSelectedLabelTime} setSelectedLabel={setSelectedLabel} setIsLabelModalOpen={setIsLabelModalOpen} removeLabel={removeLabel}
                eventPopover={eventPopover} setEventPopover={setEventPopover} handlePopoverEdit={handlePopoverEdit} handlePopoverAdd={handlePopoverAdd}
                handlePopoverDelete={handlePopoverDelete} setMobilePartyOpen={setMobilePartyOpen} setMobileToolsOpen={setMobileToolsOpen}
                setMobileMenuOpen={setMobileMenuOpen} setMobileMitiFlow={setMobileMitiFlow}
            />

            <TimelineModeBars
                t={t} isAaModeEnabled={isAaModeEnabled} setIsAaModeEnabled={setIsAaModeEnabled} setAaSettingsOpen={setAaSettingsOpen} aaSettings={aaSettings}
                timelineSelectMode={timelineSelectMode} setTimelineSelectMode={setTimelineSelectMode} labelSelectMode={labelSelectMode}
                setLabelSelectMode={setLabelSelectMode} throttledUpdatePreview={throttledUpdatePreview} videoModalOpen={videoModalOpen}
                setVideoModalOpen={setVideoModalOpen}
            />

            <TimelinePipLayer
                t={t} pipWindow={pipWindow} pipContainer={pipContainer} pipMenuOpen={pipMenuOpen} pipMenuPos={pipMenuPos} setPipMenuOpen={setPipMenuOpen}
                cancelClosePipMenu={cancelClosePipMenu} scheduleClosePipMenu={scheduleClosePipMenu} handleOpenPip={handleOpenPip} handleClosePip={handleClosePip}
                onOpenVideoModal={() => setVideoModalOpen(true)}
            />
        </>
    );
};

export default Timeline;