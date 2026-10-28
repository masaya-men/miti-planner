import React, { useState, useMemo, useEffect, useRef, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MobileEffectBarLayer } from './MobileEffectBarLayer';

import { useMitigationStore } from '../store/useMitigationStore';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../store/usePlanStore';
import { useCollabJoinerSession } from '../store/useCollabJoinerSession';
import { useTutorialStore } from '../store/useTutorialStore';
import { useThemeStore, useEffectiveTimelineView } from '../store/useThemeStore';
import type { PartyMember, AppliedMitigation } from '../types';

import {
    computeMobileEffectBars,
    MOBILE_EFFECT_BAR_ROW_INSET,
    MOBILE_EFFECT_BAR_SLOT_PITCH,
} from '../utils/mobileEffectBar';
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import clsx from 'clsx';
import { DEFAULT_FIGHT_DURATION_SEC } from '../constants/timeline';
import { ConflictOffscreenArrows } from './timeline/ConflictOffscreenArrows';
import type { ConflictPoint } from './timeline/conflictArrows';
import { EMPTY_ROW_LAYOUT, type RowLayout } from './timeline/rowLayout';
import { useTimelineMobileScrollChrome } from './timeline/useTimelineMobileScrollChrome';
import { useTimelineAaEscape, useTimelineShortcutKeys, useTimelineEscapeKeys } from './timeline/useTimelineKeyboard';
import { useTimelineEditing, useTimelineMitigationEditing } from './timeline/useTimelineEditing';
import { useTimelineDialogs } from './timeline/useTimelineDialogs';
import { useTimelineAutoPlan } from './timeline/useTimelineAutoPlan';
import { useTimelineHeaderEvents, useTimelineTutorialEvents, useTimelineProgressJump, useTimelineResetUiEvent, useTimelineClearMenuOutsideClick } from './timeline/useTimelineWindowEvents';
import { useTimelineViewMode, useTimelineSheetWidth, useTimelineColumnCollapse, useTimelineRowLayout, useTimelinePartyOrder, useTimelineMemberXMap, useTimelineHoverGeom } from './timeline/useTimelineLayout';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
import type { RecastRowHandle } from './RecastRow';
import { sheetColumnIndex, SHEET_ICON_PX } from './timeline/sheet/sheetColumns';
import { sheetIconLeft } from './timeline/sheet/sheetGeometry';
import { useTimelineDamage } from './timeline/useTimelineDamage';
import { useTimelinePreviewHighlight } from './timeline/useTimelinePreviewHighlight';
import { useTimelinePip } from './timeline/useTimelinePip';
import { TimelinePipLayer } from './timeline/TimelinePipLayer';
import './timeline/sheet/sheet.css';
import { TimelineControlBar } from './timeline/TimelineControlBar';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineRows } from './timeline/TimelineRows';
import { TimelineBands } from './timeline/TimelineBands';
import { TimelineMitigationLayer } from './timeline/TimelineMitigationLayer';
import { TimelinePopovers } from './timeline/TimelinePopovers';
import { TimelineDialogs, TimelineDialogsLower } from './timeline/TimelineDialogs';
import { TimelineMobileSheets, TimelineMobileTools } from './timeline/TimelineMobileSheets';
import { TimelineModeBars } from './timeline/TimelineModeBars';
import './Timeline.css';

// 軍事専用部品は標準テーマに配信しないよう遅延読み込み(useSortSlide は軽い hook なので静的のまま)
const MilspecReticle = React.lazy(() => import('./military/table/MilspecReticle').then(m => ({ default: m.MilspecReticle })));
const MilspecRowPrinter = React.lazy(() => import('./military/table/MilspecRowPrinter').then(m => ({ default: m.MilspecRowPrinter })));
import { MemoOverlay } from './Memo/MemoOverlay';
import { MemoInputBox } from './Memo/MemoInputBox';
import { useTimelineNavJump, useTimelinePlanScrollReset, useTimelineScrollSync } from './timeline/useTimelineScrollSync';
import { CursorOverlay } from './collab/CursorOverlay';
import { useCollabPresenceStore } from '../store/useCollabPresenceStore';
import { useProgressRecording } from './progress/useProgressRecording';

import { useTimelineMemo, useTimelineCursorSend } from './timeline/useTimelineMemoCursor';
import { useTimelineSheetViewState, useTimelineSheetTap, useTimelineSheetColumns, useTimelineSheetHover } from './timeline/useTimelineSheetView';
import { getMitigationColorClasses } from './timeline/mitigationItemColors';
import { resolveContentId, isJoinerReadonly } from './timelineJoinerState';

// MYジョブハイライトの ON/OFF を「親コンテナの属性1個」に橋渡しするだけの小コンポーネント。
// これ自身だけが myJobHighlight を購読して再描画される（null を返すだけ＝軽い）。
// 各アイコン側は購読しないので、トグルしても一斉再描画されない（薄暗くは CSS が担当）。
const MyJobHighlightAttrBridge: React.FC<{ targetRef: React.RefObject<HTMLDivElement | null> }> = ({ targetRef }) => {
    const on = useMitigationStore(s => s.myJobHighlight && s.myMemberId != null);
    React.useLayoutEffect(() => {
        const el = targetRef.current;
        if (el) el.setAttribute('data-myjob-highlight', on ? '1' : '0');
    }, [on, targetRef]);
    return null;
};

// 進捗記録モードの ON/OFF を親コンテナの属性1個に橋渡し（これ自身だけ購読・軽い）。
// 記録モード中は CSS で「行のどこをクリックしても打点できる」ことを示す（行ハイライト + 専用カーソル）。
const RecordModeAttrBridge: React.FC<{ targetRef: React.RefObject<HTMLDivElement | null> }> = ({ targetRef }) => {
    const on = useProgressRecording(s => s.recordMode);
    React.useLayoutEffect(() => {
        const el = targetRef.current;
        if (el) el.setAttribute('data-record-mode', on ? '1' : '0');
    }, [on, targetRef]);
    return null;
};

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

    // データ（useShallowで浅い比較 → 値が変わったときだけ再レンダー）
    const {
        aaSettings, partyMembers,
        timelineMitigations, timelineEvents, phases,
        clipboardEvent, hideEmptyRows, currentLevel, showRowBorders: laneRowBorders, sheetRowBorders,
        hiddenPartyMemberIds,
    } = useMitigationStore(useShallow(s => ({
        aaSettings: s.aaSettings,
        partyMembers: s.partyMembers,
        timelineMitigations: s.timelineMitigations,
        timelineEvents: s.timelineEvents,
        phases: s.phases,
        clipboardEvent: s.clipboardEvent,
        hideEmptyRows: s.hideEmptyRows,
        currentLevel: s.currentLevel,
        showRowBorders: s.showRowBorders,
        sheetRowBorders: s.sheetRowBorders,
        hiddenPartyMemberIds: s.hiddenPartyMemberIds,
    })));
    const partySortOrder = useMitigationStore(s => s.timelineSortOrder);
    // ジョイナー閲覧/編集中フラグ。モバイルで currentPlanId が無くても表を隠さないために参照する
    // (本体アプリでは常に false ＝ 影響なし。true になるのは /collab ジョイナーのみ)。
    const collabReadonly = useMitigationStore(s => s._collabReadonly);
    // Undo/Redo可否（リアクティブに監視して disabled 状態を正しく反映する）
    // 共同編集中は Y.UndoManager の可否(_collabCanUndo/Redo)、それ以外はローカル履歴を見る(②-c)。
    const canUndo = useMitigationStore(s => s._collabActive ? s._collabCanUndo : s._history.length > 0);
    const canRedo = useMitigationStore(s => s._collabActive ? s._collabCanRedo : s._future.length > 0);
    // メモモード
    const toolMode = useMitigationStore(s => s.toolMode);
    const isMemoMode = toolMode === 'memo';
    const memos = useMitigationStore(s => s.memos);
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
    // アクション（参照安定・再レンダー不発火）
    const addEvent = useMitigationStore(s => s.addEvent);
    const updateEvent = useMitigationStore(s => s.updateEvent);
    const removeEvent = useMitigationStore(s => s.removeEvent);
    const addMitigation = useMitigationStore(s => s.addMitigation);
    const setMemberJob = useMitigationStore(s => s.setMemberJob);
    const setAaSettings = useMitigationStore(s => s.setAaSettings);
    const removeMitigation = useMitigationStore(s => s.removeMitigation);
    const updateMitigationTime = useMitigationStore(s => s.updateMitigationTime);
    const addPhase = useMitigationStore(s => s.addPhase);
    const updatePhase = useMitigationStore(s => s.updatePhase);
    const removePhase = useMitigationStore(s => s.removePhase);
    const updatePhaseEndTime = useMitigationStore(s => s.updatePhaseEndTime);
    const updatePhaseStartTime = useMitigationStore(s => s.updatePhaseStartTime);
    const labels = useMitigationStore(s => s.labels);
    const addLabel = useMitigationStore(s => s.addLabel);
    const updateLabel = useMitigationStore(s => s.updateLabel);
    const removeLabel = useMitigationStore(s => s.removeLabel);
    const updateLabelEndTime = useMitigationStore(s => s.updateLabelEndTime);
    const updateLabelStartTime = useMitigationStore(s => s.updateLabelStartTime);
    const changeMemberJobWithMitigations = useMitigationStore(s => s.changeMemberJobWithMitigations);
    const setClipboardEvent = useMitigationStore(s => s.setClipboardEvent);

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

    // 「置いた時は既存の相手だけ光る」: 直前に手動配置したインスタンスは脈動/矢印から除外する。
    // リロードで null に戻るため、開き直した時は既存競合が両方光る(自己責任)。
    const lastPlacedMitigationId = useMitigationStore(s => s.lastPlacedMitigationId);


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
    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
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
    useTimelinePlanScrollReset({ scrollContainerRef, currentPlanId, joinerRoomToken });
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

    // 画面外ガイド矢印用: 競合中インスタンスの列中央X + コンテンツ内絶対Y を算出。
    // Y は rowLayout(同じレンダーで計算済みの行の配置)から得る。旧実装の「直前レンダーの
    // timeToYMap を ref 経由で読む 1 レンダー分のラグ」は無くなった。
    // 初回マウント時の 1 フレームずれは ConflictOffscreenArrows 側で viewportHeight===0 中は
    // 描画しないことで緩和している。
    const conflictPoints = useMemo<ConflictPoint[]>(() => {
        return timelineMitigations
            // 表示/非表示スイッチで隠したメンバーの競合は、列自体が描画されないため画面外
            // ガイド矢印の対象からも除外する(競合検知=conflictingIds 自体は不変・見た目だけ)。
            .filter(m => conflictingIds.has(m.id) && m.id !== lastPlacedMitigationId && !hiddenPartyMemberIds.includes(m.ownerId))
            .map(m => {
                const y = rowLayout.topOf(m.time);
                if (isMobileTimeline) {
                    // モバイルは担当者ごとの列が無い(1本の行に全員分のアイコンが並ぶ)ため、
                    // ownerId を固定値にして矢印を「上下1個ずつ」に集約する(PCのように
                    // 担当者ごとにバラバラ出ると窮屈になるため)。x は行の水平中央。
                    return { id: m.id, ownerId: '__mobile__', y, columnCenterX: sheetWidth / 2 };
                }
                const layout = memberLayout.get(m.ownerId);
                // スプシ表示: そのスキルの列の中央(列が無ければメンバー列の中央)
                const sheetCi = sheetColumnMap ? sheetColumnIndex(sheetColumnMap.get(m.ownerId) ?? [], m.mitigationId, MITIGATIONS) : -1;
                return {
                    id: m.id,
                    ownerId: m.ownerId,
                    y,
                    // 列幅の中央 (ジョブ種別で列幅が変わるので width の中央)。
                    columnCenterX: !layout ? 0
                        : sheetCi >= 0 ? layout.left + sheetIconLeft(0, sheetCi) + SHEET_ICON_PX / 2
                        : layout.left + layout.width / 2,
                };
            });
    // memberLayout は Map で参照同一・中身が変化するため refVersion を直接含められない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timelineMitigations, conflictingIds, lastPlacedMitigationId, memberLayout, rowLayout, isMobileTimeline, sheetWidth, sheetColumnMap, MITIGATIONS]);

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
                    {/* プラン未選択時 — Liquid Glass オーバーレイ（CSSクラス .no-plan で表示制御） */}
                    <div className="empty-liquid-glass">
                        <div className="empty-glass-corner empty-glass-corner-tl" />
                        <div className="empty-glass-corner empty-glass-corner-tr" />
                        <div className="empty-glass-corner empty-glass-corner-bl" />
                        <div className="empty-glass-corner empty-glass-corner-br" />
                        <div className="empty-glass-sheen" />
                        {/* PC: 左端の呼吸する光 */}
                        <div className="hidden md:block">
                            <div className="empty-glow-left" />
                            <div className="empty-glow-left-spread" />
                        </div>
                        {/* スマホ: 左下L字の呼吸する光 */}
                        <div className="md:hidden">
                            <div className="empty-glow-bl-h" />
                            <div className="empty-glow-bl-v" />
                            <div className="empty-glow-bl-spread" />
                        </div>
                    </div>
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

                    {/* MYジョブハイライト: 親コンテナに data-myjob-highlight を立てるだけ(CSS で薄暗く) */}
                    <MyJobHighlightAttrBridge targetRef={scrollContainerRef} />
                    {/* 進捗記録モード: 親コンテナに data-record-mode を立てるだけ(CSS で行ハイライト+カーソル) */}
                    <RecordModeAttrBridge targetRef={scrollContainerRef} />
                    <div
                        ref={scrollContainerRef}
                        className={clsx(
                            "timeline-scroll-container flex-1 overflow-y-auto overflow-x-hidden md:overflow-x-auto relative custom-scrollbar bg-white dark:bg-[var(--color-bg-primary)] duration-200",
                            // 通常アプリ: モバイルでプラン未選択なら空状態のため隠す。
                            // ジョイナー(_collabReadonly=true)はプラン未選択でも部屋の表を出すので隠さない。
                            !currentPlanId && isMobileTimeline && !collabReadonly && "hidden"
                        )}
                        onScroll={handleScrollSync}
                        style={{
                            // sticky なフェーズバー(下)は通常フローの実要素なので、padding では
                            // ヘッダー分だけ確保すれば十分(バーの高さは自身の実高さで自動的に押し出す)。
                            // ここに phaseBarHeight を足すと二重計上になりヘッダーとバーの間に隙間ができるので入れない。
                            paddingTop: isMobileView ? MOBILE_TOKENS.header.compactHeight : undefined,
                        }}
                    >
                        {/* モバイル: ヘッダー直下に隙間なく固定した現在フェーズ名。ヘッダーと同じガラス背景で1枚のパネルに見せる。
                            境界に近づくスクロール量そのものに連動して横スライド(syncMobilePhaseLabelがscroll毎にtransform直書き)。
                            PC 側の行ごと回転ラベルはモバイルでは出さずこちらに一本化。 */}
                        {isMobileTimeline && phases.length > 0 && (
                            <div
                                className="sticky top-0 z-20 overflow-hidden backdrop-blur-md"
                                style={{
                                    height: MOBILE_TOKENS.header.phaseBarHeight,
                                    backgroundColor: 'var(--color-nav-bg)',
                                    borderBottom: '0.5px solid var(--color-nav-border)',
                                }}
                            >
                                <span
                                    ref={mobilePhaseCurRef}
                                    className="absolute inset-0 flex items-center justify-center text-app-base font-bold text-app-text leading-none"
                                />
                                <span
                                    ref={mobilePhaseNextRef}
                                    className="absolute inset-0 flex items-center justify-center text-app-base font-bold text-app-text leading-none"
                                />
                            </div>
                        )}
                        {/* 画面外競合ガイド矢印: sticky + height:0 で viewport 端に固定、コンテンツと一緒に流れない */}
                        {/* 常時マウントにすることで scroll/ResizeObserver の付け外し churn を防ぐ。
                            points が空のときは ConflictOffscreenArrows が何も描画しない。PC/モバイル共通。 */}
                        <div className="sticky top-0 z-30 h-0 overflow-visible pointer-events-none">
                            <ConflictOffscreenArrows
                                points={conflictPoints}
                                scrollContainerRef={scrollContainerRef}
                                topInset={isMobileTimeline && phases.length > 0 ? MOBILE_TOKENS.header.phaseBarHeight : 0}
                                // +compactHeight: 矢印のsticky土台自体がスクロールコンテナのpadding-top
                                // (compactHeight分)だけ画面上端からずれた位置を基準点にしているため、
                                // 下矢印を「本当の画面下端」基準で置くにはその分も追加で引く必要がある
                                // (実測で判明。上矢印側は偶然この基準ズレとフェーズバーの位置が一致するため
                                // 補正不要だった)。
                                bottomInset={isMobileTimeline ? MOBILE_TOKENS.bottomNav.height + 2 + MOBILE_TOKENS.header.compactHeight : 0}
                            />
                        </div>
                        {/* isolate: 内部の mix-blend-mode(モバイルのエフェクト棒⇄アイコンのクロスフェード)を
                            このコンテナ内だけに閉じ込め、ページ全体の背景と混ざらないようにする。 */}
                        <div ref={sheetContainerRef} onClick={handleSheetClick} onPointerMove={isSheetView ? handleSheetPointerMove : undefined} onPointerLeave={isSheetView ? handleSheetPointerLeave : undefined} className="relative isolate bg-transparent md:w-max md:min-w-full" style={{
                            // 表全体の高さ = 行の配置係の合計(描画と同じ計算。旧実装は別ループで数えていて、
                            // スマホの同時刻 2 件行を 1 段分少なく数えていた)
                            height: `calc(${rowLayout.totalHeight}px + 50vh)`
                        }}>
                            {(() => {
                                // 🚀 Performance Optimization: Pre-calculate mitigations map
                                const mitigationsByTime = new Map<number, AppliedMitigation[]>();
                                const mitStartsByTime = new Map<number, boolean>();
                                timelineMitigations.forEach(mit => {
                                    if (!mit.autoHidden) {
                                        mitStartsByTime.set(mit.time, true);
                                    }
                                    for (let t = mit.time; t < mit.time + mit.duration; t++) {
                                        if (!mitigationsByTime.has(t)) mitigationsByTime.set(t, []);
                                        if (!mit.autoHidden) {
                                            mitigationsByTime.get(t)!.push(mit);
                                        }
                                    }
                                });

                                return (
                                    <>
                                        {isMobileTimeline && (() => {
                                            // 行の文字(攻撃名・ダメージ等)より奥に描画するため、renderItems(行本体)より
                                            // 前にマウントする(z-index を持たない同士は DOM 順で手前/奥が決まる)。
                                            // このFragment内の他の兄弟ブロック(フェーズ/ラベルオーバーレイ)と同じく、
                                            // 各IIFEは自分のスコープなので offsetTime をローカルで再計算する。
                                            const offsetTime = showPreStart ? -10 : 0;
                                            // 画面幅から横に並べられる最大同時本数を算出。
                                            // sheetWidth 未計測時(初回フレーム)はモバイル最小幅を仮定した安全値にフォールバック。
                                            const availableWidth = sheetWidth > 0 ? sheetWidth : 350;
                                            const maxConcurrent = Math.max(
                                                1,
                                                Math.floor((availableWidth - MOBILE_EFFECT_BAR_ROW_INSET * 2) / MOBILE_EFFECT_BAR_SLOT_PITCH)
                                            );
                                            // 表示/非表示スイッチで隠したメンバーの効果棒は除外(見た目だけの絞り込み・2026-08-19)。
                                            const visibleTimelineMitigationsForBars = hiddenPartyMemberIds.length === 0
                                                ? timelineMitigations
                                                : timelineMitigations.filter(m => !hiddenPartyMemberIds.includes(m.ownerId));
                                            const mobileBars = computeMobileEffectBars({
                                                timelineMitigations: visibleTimelineMitigationsForBars,
                                                mitigationDefs: MITIGATIONS,
                                                timeToYMap: rowLayout.timeToY,
                                                pixelsPerSecond: rowLayout.unitPx,
                                                offsetTime,
                                                hideEmptyRows,
                                                maxTime,
                                                eventsByTime,
                                                mitStartsByTime,
                                                showPreStart,
                                                maxConcurrent,
                                                getColorClasses: (jobId, ownerId) => getMitigationColorClasses(jobId, ownerId, 'role'),
                                                shieldExhaustedAt,
                                                barrierOverwrittenAt,
                                            });
                                            return <MobileEffectBarLayer bars={mobileBars} conflictingIds={mobileConflictingIds} />;
                                        })()}
                                        <TimelineRows
                                            rowLayout={rowLayout} eventsByTime={eventsByTime} damageMap={damageMap} mitigationsByTime={mitigationsByTime}
                                            isMobileTimeline={isMobileTimeline} sortedPartyMembers={sortedPartyMembers} visiblePartyMembers={visiblePartyMembers}
                                            hiddenPartyMemberIds={hiddenPartyMemberIds}
                                            stableMobileDamageClick={stableMobileDamageClick} stableMobileLongPress={stableMobileLongPress}
                                            stablePhaseAdd={stablePhaseAdd} stableLabelAdd={stableLabelAdd} stableAddClick={stableAddClick}
                                            stableEventClick={stableEventClick} stableCellClick={stableCellClick}
                                            stableTimelineSelect={stableTimelineSelect} stableTimelineSelectHover={stableTimelineSelectHover}
                                            phaseColumnCollapsed={phaseColumnCollapsed} labelColumnVisible={labelColumnVisible}
                                            timelineSelectMode={timelineSelectMode} labelSelectMode={labelSelectMode}
                                            showRowBorders={showRowBorders} sheetCols={sheetCols} rowSwapMarkers={rowSwapMarkers} rowLabels={rowLabels}
                                            phases={phases} maxMitiIconsPerRow={maxMitiIconsPerRow} mobileConflictingIds={mobileConflictingIds}
                                        />

                                        <TimelineBands
                                            t={t} isMobileTimeline={isMobileTimeline} isMobileView={isMobileView} sheetContainerRef={sheetContainerRef}
                                            hoverGeomRef={hoverGeomRef} phases={phases} labels={labels} phaseColumnCollapsed={phaseColumnCollapsed}
                                            labelColumnVisible={labelColumnVisible} showPreStart={showPreStart} contentLanguage={contentLanguage}
                                            rowLayout={rowLayout} labelSelectMode={labelSelectMode} overlayRef={overlayRef}
                                        />

                                        {/* スマホは MitiIcons (各行内) が軽減表示を担うので PC 用 MitigationItem は呼ばない (呼ぶと colStart=0 で左フェーズ列に見切れ流入) */}
                                        {!isMobileTimeline && (
                                            <TimelineMitigationLayer
                                                timelineMitigations={timelineMitigations} showPreStart={showPreStart} hideEmptyRows={hideEmptyRows}
                                                hiddenPartyMemberIds={hiddenPartyMemberIds} MITIGATIONS={MITIGATIONS} partyMembers={partyMembers}
                                                memberLayout={memberLayout} sheetColumnMap={sheetColumnMap} livingDeadTriggers={livingDeadTriggers}
                                                eventsByTime={eventsByTime} mitStartsByTime={mitStartsByTime} maxTime={maxTime} rowLayout={rowLayout}
                                                shieldExhaustedAt={shieldExhaustedAt} barrierOverwrittenAt={barrierOverwrittenAt} readOnly={readOnly}
                                                removeMitigation={removeMitigation} updateMitigationTime={updateMitigationTime}
                                                partySortOrder={partySortOrder} scrollContainerRef={scrollContainerRef} conflictingIds={conflictingIds}
                                                lastPlacedMitigationId={lastPlacedMitigationId} handleCellClick={handleCellClick} isMilspecTable={isMilspecTable}
                                            />
                                        )}
                                    </>
                                );
                            })()}
                        {/* メモオーバーレイ (= 既存メモをシート上に表示)。
                            メモ機能自体がスマホ非対応(作成ボタンも hidden md:flex)のため、
                            既存メモの読み取り専用表示もスマホでは出さない(2026-08-14実機報告)。 */}
                        {!isMobileTimeline && (
                            <MemoOverlay
                                memos={memos}
                                timeToYMap={timeToYMapRef.current}
                                sheetWidth={sheetWidth}
                                xRatioToPxFn={memberXMap.toPx}
                                pxToXRatioFn={memberXMap.toRatio}
                                interactive={isMemoMode}
                                onMemoDragEnd={handleMemoDragEnd}
                                onMemoClick={handleMemoClick}
                                onMemoDelete={handleMemoDelete}
                            />
                        )}
                        {/* ④-b-2: 他者カーソル(P2P 受信)。CursorOverlay が自分で roster を購読して
                            描く相手の有無を判定する(ソロ/閲覧者なら自前で null を返し rAF も回さない)。
                            map/width は ref で渡し、Timeline 再描画なしでも rAF が最新を読める。 */}
                        <CursorOverlay
                            timeToYMapRef={timeToYMapRef}
                            sheetWidthRef={sheetWidthRef}
                            toLocalXRef={cursorToLocalXRef}
                        />
                        {/* メモ入力ボックス (新規 / 編集 共用) */}
                        {memoInput && (
                            <MemoInputBox
                                topPx={memoInput.topPx}
                                leftPx={memoInput.leftPx}
                                initialText={memoInput.initialText}
                                onSave={handleMemoSave}
                                onCancel={() => setMemoInput(null)}
                            />
                        )}
                        {/* 軍事の表: 指した所に吸い付く照準(見本 v11 js:1027-1053)。標準では出さない */}
                        {isMilspecTable && (
                            <React.Suspense fallback={null}><MilspecReticle rootRef={sheetContainerRef} /></React.Suspense>
                        )}
                        {/* 軍事の表: プラン・コンテンツの切替と電源投入で、見えている行を上から描き込む */}
                        {isMilspecTable && (
                            <React.Suspense fallback={null}><MilspecRowPrinter scrollRef={scrollContainerRef} /></React.Suspense>
                        )}
                        </div>
                    </div>
                </div>
            </div>

            <TimelineDialogs
                t={t}
                contentLanguage={contentLanguage}
                isMemoMode={isMemoMode}
                memos={memos}
                clipboardEvent={clipboardEvent}
                setClipboardEvent={setClipboardEvent}
                isModalOpen={isModalOpen}
                setIsModalOpen={setIsModalOpen}
                handleSave={handleSave}
                handleDelete={handleDelete}
                selectedEvent={selectedEvent}
                selectedTime={selectedTime}
                eventModalPosition={eventModalPosition}
                mobileContextMenu={mobileContextMenu}
                setMobileContextMenu={setMobileContextMenu}
                handleContextEdit={handleContextEdit}
                handleContextAdd={handleContextAdd}
                handleContextDelete={handleContextDelete}
                isPhaseModalOpen={isPhaseModalOpen}
                setIsPhaseModalOpen={setIsPhaseModalOpen}
                selectedPhase={selectedPhase}
                handlePhaseSave={handlePhaseSave}
                handlePhaseDelete={handlePhaseDelete}
                setTimelineSelectMode={setTimelineSelectMode}
                phases={phases}
                phaseModalPosition={phaseModalPosition}
                isLabelModalOpen={isLabelModalOpen}
                setIsLabelModalOpen={setIsLabelModalOpen}
                selectedLabel={selectedLabel}
                handleLabelSave={handleLabelSave}
                handleLabelDelete={handleLabelDelete}
                setLabelSelectMode={setLabelSelectMode}
                labels={labels}
                labelModalPosition={labelModalPosition}
                phaseDropdownOpen={phaseDropdownOpen}
                setPhaseDropdownOpen={setPhaseDropdownOpen}
                gimmickDropdownOpen={gimmickDropdownOpen}
                setGimmickDropdownOpen={setGimmickDropdownOpen}
                timeInputOpen={timeInputOpen}
                setTimeInputOpen={setTimeInputOpen}
                mechanicSearchOpen={mechanicSearchOpen}
                setMechanicSearchOpen={setMechanicSearchOpen}
                handleNavJump={handleNavJump}
                phaseColumnCollapsed={phaseColumnCollapsed}
                labelColumnCollapsed={labelColumnCollapsed}
                handleTogglePhaseCollapse={handleTogglePhaseCollapse}
                handleToggleLabelCollapse={handleToggleLabelCollapse}
                phaseHeaderRef={phaseHeaderRef}
                gimmickHeaderRef={gimmickHeaderRef}
                timeHeaderRef={timeHeaderRef}
                mechanicHeaderRef={mechanicHeaderRef}
                maxTime={maxTime}
                timelineEvents={timelineEvents}
            />

            <TimelineMobileSheets
                t={t}
                contentLanguage={contentLanguage}
                mobileMitiFlow={mobileMitiFlow}
                setMobileMitiFlow={setMobileMitiFlow}
                timelineEvents={timelineEvents}
                timelineMitigations={timelineMitigations}
                partyMembers={partyMembers}
                currentLevel={currentLevel}
                MITIGATIONS={MITIGATIONS}
                JOBS={JOBS}
                sortedPartyMembers={sortedPartyMembers}
                addMitigation={addMitigation}
                removeMitigation={removeMitigation}
            />

            <TimelineDialogsLower
                t={t}
                JOBS={JOBS}
                isSheetView={isSheetView}
                isMobileView={isMobileView}
                sheetToast={sheetToast}
                sheetColHover={sheetColHover}
                sheetPopover={sheetPopover}
                sheetHiddenPopover={sheetHiddenPopover}
                setSheetHiddenPopover={setSheetHiddenPopover}
                sheetHiddenColumns={sheetHiddenColumns}
                handleCloseSheetHidden={handleCloseSheetHidden}
                handleSheetPopoverPick={handleSheetPopoverPick}
                handleSheetPopoverClose={handleSheetPopoverClose}
                mitigationSelectorOpen={mitigationSelectorOpen}
                setMitigationSelectorOpen={setMitigationSelectorOpen}
                handleMitigationSelect={handleMitigationSelect}
                removeMitigation={removeMitigation}
                selectedMemberId={selectedMemberId}
                partyMembers={partyMembers}
                selectorPosition={selectorPosition}
                timelineMitigations={timelineMitigations}
                selectedMitigationTime={selectedMitigationTime}
                jobPickerOpen={jobPickerOpen}
                setJobPickerOpen={setJobPickerOpen}
                handleJobSelect={handleJobSelect}
                jobPickerPosition={jobPickerPosition}
                jobPickerMemberId={jobPickerMemberId}
                partySettingsOpen={partySettingsOpen}
                setPartySettingsOpen={setPartySettingsOpen}
                importModalOpen={importModalOpen}
                setImportModalOpen={setImportModalOpen}
                showGridImport={showGridImport}
                setShowGridImport={setShowGridImport}
                handleSheetImport={handleSheetImport}
                sheetImportDefault={sheetImportDefault}
                migrationConfig={migrationConfig}
                handleMigrationConfirm={handleMigrationConfirm}
                handleMigrationCancel={handleMigrationCancel}
                confirmDialog={confirmDialog}
                setConfirmDialog={setConfirmDialog}
            />
            <TimelineMobileTools
                t={t}
                tutorialActive={tutorialActive}
                undoRedoWrapRef={undoRedoWrapRef}
                canUndo={canUndo}
                canRedo={canRedo}
                readOnly={readOnly}
                mobileToolsSheetOpen={mobileToolsSheetOpen}
                setMobileToolsSheetOpen={setMobileToolsSheetOpen}
                setImportModalOpen={setImportModalOpen}
            />
            <TimelinePopovers
                t={t}
                phasePopover={phasePopover}
                setPhasePopover={setPhasePopover}
                handlePhaseEdit={handlePhaseEdit}
                setPhaseModalPosition={setPhaseModalPosition}
                setSelectedPhaseTime={setSelectedPhaseTime}
                setSelectedPhase={setSelectedPhase}
                setIsPhaseModalOpen={setIsPhaseModalOpen}
                removePhase={removePhase}
                labelPopover={labelPopover}
                setLabelPopover={setLabelPopover}
                handleLabelEdit={handleLabelEdit}
                setLabelModalPosition={setLabelModalPosition}
                setSelectedLabelTime={setSelectedLabelTime}
                setSelectedLabel={setSelectedLabel}
                setIsLabelModalOpen={setIsLabelModalOpen}
                removeLabel={removeLabel}
                eventPopover={eventPopover}
                setEventPopover={setEventPopover}
                handlePopoverEdit={handlePopoverEdit}
                handlePopoverAdd={handlePopoverAdd}
                handlePopoverDelete={handlePopoverDelete}
                setMobilePartyOpen={setMobilePartyOpen}
                setMobileToolsOpen={setMobileToolsOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                setMobileMitiFlow={setMobileMitiFlow}
            />

            <TimelineModeBars
                t={t}
                isAaModeEnabled={isAaModeEnabled}
                setIsAaModeEnabled={setIsAaModeEnabled}
                setAaSettingsOpen={setAaSettingsOpen}
                aaSettings={aaSettings}
                timelineSelectMode={timelineSelectMode}
                setTimelineSelectMode={setTimelineSelectMode}
                labelSelectMode={labelSelectMode}
                setLabelSelectMode={setLabelSelectMode}
                throttledUpdatePreview={throttledUpdatePreview}
                videoModalOpen={videoModalOpen}
                setVideoModalOpen={setVideoModalOpen}
            />

            <TimelinePipLayer
                t={t}
                pipWindow={pipWindow}
                pipContainer={pipContainer}
                pipMenuOpen={pipMenuOpen}
                pipMenuPos={pipMenuPos}
                setPipMenuOpen={setPipMenuOpen}
                cancelClosePipMenu={cancelClosePipMenu}
                scheduleClosePipMenu={scheduleClosePipMenu}
                handleOpenPip={handleOpenPip}
                handleClosePip={handleClosePip}
                onOpenVideoModal={() => setVideoModalOpen(true)}
            />
        </>
    );
};

export default Timeline;