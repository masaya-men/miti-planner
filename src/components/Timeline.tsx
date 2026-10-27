import React, { useState, useMemo, useEffect, useRef, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MobileContextMenu } from './MobileContextMenu';
import { MobileEffectBarLayer } from './MobileEffectBarLayer';

import { useMitigationStore } from '../store/useMitigationStore';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../store/usePlanStore';
import { useCollabJoinerSession } from '../store/useCollabJoinerSession';
import { useTutorialStore } from '../store/useTutorialStore';
import { useThemeStore, useEffectiveTimelineView } from '../store/useThemeStore';
import type { PartyMember, AppliedMitigation } from '../types';
import { getPhaseName } from '../types';
import { EventModal } from './EventModal';
import { BoundaryEditModal } from './BoundaryEditModal';

import { MitigationSelector } from './MitigationSelector';
import { JobPicker } from './JobPicker';
import { PartySettingsModal } from './PartySettingsModal';
import { JobMigrationModal } from './JobMigrationModal';
import {
    computeMobileEffectBars,
    MOBILE_EFFECT_BAR_ROW_INSET,
    MOBILE_EFFECT_BAR_SLOT_PITCH,
} from '../utils/mobileEffectBar';
import {
    Pencil, Trash2, Plus, X, Undo2, Redo2, CloudDownload, Sword, ChevronLeft, Settings, Crosshair
} from 'lucide-react';
import VideoRecorderModal from './VideoRecorderModal';
import { useJobs, useMitigations, getMitigationPriority } from '../hooks/useSkillsData';
import clsx from 'clsx';
import { DEFAULT_FIGHT_DURATION_SEC } from '../constants/timeline';
import { FFLogsImportModal } from './FFLogsImportModal';
import { validateMitigationPlacement } from '../utils/resourceTracker';
import { ConflictOffscreenArrows } from './timeline/ConflictOffscreenArrows';
import type { ConflictPoint } from './timeline/conflictArrows';
import { EMPTY_ROW_LAYOUT, barStartY, barEndY, childIconCutY } from './timeline/rowLayout';
import type { RowLayout } from './timeline/rowLayout';
import { calculateLinkedShieldValue } from '../utils/calculator';
import { isLivingDeadStyle } from '../utils/livingDead';
import { resolveMitigationTap } from '../utils/mitigationTapResolver';
import { resolveSeraphismMitigation } from '../utils/scholarShieldRules';
import { useTimelineMobileScrollChrome } from './timeline/useTimelineMobileScrollChrome';
import { useTimelineAaEscape, useTimelineShortcutKeys, useTimelineEscapeKeys } from './timeline/useTimelineKeyboard';
import { useTimelineEditing, useTimelineMitigationEditing } from './timeline/useTimelineEditing';
import { useTimelineDialogs } from './timeline/useTimelineDialogs';
import { useTimelineAutoPlan } from './timeline/useTimelineAutoPlan';
import { useTimelineHeaderEvents, useTimelineTutorialEvents, useTimelineProgressJump, useTimelineResetUiEvent, useTimelineClearMenuOutsideClick } from './timeline/useTimelineWindowEvents';
import { useTimelineViewMode, useTimelineSheetWidth, useTimelineColumnCollapse, useTimelineRowLayout, useTimelinePartyOrder, useTimelineMemberXMap, useTimelineHoverGeom } from './timeline/useTimelineLayout';
import { ConfirmDialog } from './ConfirmDialog';
import { MobileTriggersContext } from '../contexts/MobileTriggersContext';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
import { Tooltip } from './ui/Tooltip';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MitigationSheet } from './MitigationSheet';
import { HeaderPhaseDropdown } from './HeaderPhaseDropdown';
import { HeaderGimmickDropdown } from './HeaderGimmickDropdown';
import { HeaderTimeInput } from './HeaderTimeInput';
import { HeaderMechanicSearch } from './HeaderMechanicSearch';
import type { RecastRowHandle } from './RecastRow';
import { sheetColumnIndex, SHEET_ICON_PX } from './timeline/sheet/sheetColumns';
import { sheetIconLeft } from './timeline/sheet/sheetGeometry';
import { useTimelineDamage } from './timeline/useTimelineDamage';
import { useTimelinePreviewHighlight } from './timeline/useTimelinePreviewHighlight';
import { useTimelinePip } from './timeline/useTimelinePip';
import { TimelinePipLayer } from './timeline/TimelinePipLayer';
import { placementsWithColumn } from './timeline/sheet/sheetCooldown';
import { SheetCooldownLines } from './timeline/sheet/SheetCooldownLines';
import { useSheetHiddenSkillsStore } from '../store/useSheetHiddenSkillsStore';
import { SheetHiddenPopover } from './timeline/sheet/SheetHiddenPopover';
import { SheetColumnTooltip } from './timeline/sheet/SheetColumnTooltip';
import { SheetTargetPopover } from './timeline/sheet/SheetTargetPopover';
import './timeline/sheet/sheet.css';
import { TimelineControlBar } from './timeline/TimelineControlBar';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineRows } from './timeline/TimelineRows';
import { TimelineBands } from './timeline/TimelineBands';

// 軍事専用部品は標準テーマに配信しないよう遅延読み込み(useSortSlide は軽い hook なので静的のまま)
const MilspecReticle = React.lazy(() => import('./military/table/MilspecReticle').then(m => ({ default: m.MilspecReticle })));
const MilspecRowPrinter = React.lazy(() => import('./military/table/MilspecRowPrinter').then(m => ({ default: m.MilspecRowPrinter })));
import { MemoOverlay } from './Memo/MemoOverlay';
import { MemoInputBox } from './Memo/MemoInputBox';
import { MemoFloatingBar } from './Memo/MemoFloatingBar';
import { useTimelineNavJump, useTimelinePlanScrollReset, useTimelineScrollSync } from './timeline/useTimelineScrollSync';
import { CursorOverlay } from './collab/CursorOverlay';
import { useCollabPresenceStore } from '../store/useCollabPresenceStore';
import { useProgressRecording } from './progress/useProgressRecording';
import { SpreadsheetGridImportModal } from './SpreadsheetGridImportModal';
import { shieldEffectBarEndsOnBarrierExhaustion } from '../utils/barrierStacking';

import { PlacementToast } from './timeline/sheet/PlacementToast';
import { backdropClose } from '../utils/backdropClose';
import { useTimelineMemo, useTimelineCursorSend } from './timeline/useTimelineMemoCursor';
import { useTimelineSheetViewState, useTimelineSheetTap, useTimelineSheetColumns, useTimelineSheetHover } from './timeline/useTimelineSheetView';
import { MitigationItem, getMitigationColorClasses } from './timeline/MitigationItem';

function genId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id_' + Math.random().toString(36).substring(2, 9);
}

/** ⑤-3b: contentId 解決。SavedPlan 優先、無ければジョイナー一時セッションの値。 */
export function resolveContentId(planContentId: string | null, joinerContentId: string | null): string | null {
    return planContentId ?? joinerContentId ?? null;
}

/** ⑤-3b/⑤-3c: ジョイナー読み取り専用か(部屋参加中 && 編集不可)。canEdit なら編集可＝false。 */
export function isJoinerReadonly(roomToken: string | null, canEdit: boolean): boolean {
    return roomToken !== null && !canEdit;
}

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
        isMitiSheetOpen, setIsMitiSheetOpen,
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
                                        {!isMobileTimeline && (() => {
                                            // 表示/非表示スイッチで隠したメンバーの軽減バーはここで除外する。memberLayout 経由
                                            // (ヘッダー列の DOM ref 未登録→undefined)に頼ると colStart=0 の初回マウント用
                                            // fallback に乗って左端に誤描画されるため、必ずソースの時点で弾く。
                                            const visibleMitigations = timelineMitigations.filter(m =>
                                                (showPreStart || (m.time + m.duration > 0)) && (!hideEmptyRows || !m.autoHidden)
                                                && !hiddenPartyMemberIds.includes(m.ownerId)
                                            );

                                            const mitigationsByOwner: Record<string, typeof timelineMitigations> = {};

                                            visibleMitigations.forEach(m => {
                                                if (!mitigationsByOwner[m.ownerId]) mitigationsByOwner[m.ownerId] = [];
                                                mitigationsByOwner[m.ownerId].push(m);
                                            });

                                            const renderedItems: React.ReactElement[] = [];

                                            Object.entries(mitigationsByOwner).forEach(([, ownerMitigations]) => {
                                                const getRecast = (mitigationId: string): number => {
                                                    const def = MITIGATIONS.find((m: any) => m.id === mitigationId);
                                                    return def ? (def.recast || def.recast || 999) : 999;
                                                };

                                                const displayItems: any[] = [];
                                                ownerMitigations.forEach(m => {
                                                    const def = MITIGATIONS.find((d: any) => d.id === m.mitigationId);
                                                    displayItems.push({ ...m, isVirtual: false, parentId: null });

                                                    if (def?.id === 'horoscope') {
                                                        const heliosEvents = ownerMitigations.filter((am: any) =>
                                                            (am.mitigationId === 'aspected_helios' || am.mitigationId === 'helios_conjunction') &&
                                                            am.ownerId === m.ownerId &&
                                                            am.time >= m.time &&
                                                            am.time < m.time + m.duration
                                                        );
                                                        heliosEvents.forEach(he => {
                                                            const displayTime = he.time + 1;
                                                            displayItems.push({
                                                                ...he,
                                                                id: `virtual-horo-${he.id}`,
                                                                time: displayTime,
                                                                duration: 29,
                                                                mitigationId: m.mitigationId,
                                                                isVirtual: true,
                                                                iconOverride: "/icons/horoscope_helios.png",
                                                                parentId: m.id
                                                            });
                                                        });
                                                    }
                                                    if (def?.id === 'earthly_star') {
                                                        const giantTime = m.time + 10;
                                                        if (giantTime < m.time + m.duration) {
                                                            displayItems.push({
                                                                ...m,
                                                                id: `virtual-giant-${m.id}`,
                                                                time: giantTime,
                                                                duration: m.duration - 10,
                                                                isVirtual: true,
                                                                iconOverride: "/icons/Giant_Dominance.png",
                                                                parentId: m.id
                                                            });
                                                        }
                                                    }
                                                    if (def && isLivingDeadStyle(def)) {
                                                        const tT = livingDeadTriggers.get(m.id);
                                                        if (tT !== undefined) {
                                                            // 原則、死亡時刻 tT(=致死被弾でウォーキングデッド発動)ちょうどに白黒アイコンを表示。
                                                            // 例外: tT がリビデ詠唱時刻(m.time)と同時刻=「使った瞬間に死亡」のときだけ、親リビデアイコンと
                                                            // 同じセルで重なるため 1 行下げる(ホロスコープ→ヘリオスの +1 と同じ重なり回避)。
                                                            // 効果窓の終端 tT+walkingDeadDuration は不変(下げた分 duration を縮める)。
                                                            const wdStart = tT === m.time ? tT + 1 : tT;
                                                            displayItems.push({
                                                                ...m,
                                                                id: `virtual-wd-${m.id}`,
                                                                time: wdStart,
                                                                duration: Math.max(1, def.walkingDeadDuration! - (wdStart - tT)),
                                                                isVirtual: true,
                                                                iconOverride: def.icon,
                                                                grayscale: true,
                                                                parentId: m.id,
                                                            });
                                                        }
                                                    }
                                                });

                                                // 時刻順を最優先 — 旧実装は recast 順を最優先していたため、 後の時刻に置かれた
                                                // 短 recast の異時刻アイコンが先に配置され、 先の時刻の長 recast アイコンが
                                                // 後から衝突回避で右にずれる現象が起きていた。 時刻順に並べることで「先に置いた
                                                // アイコンが後で押されない」 を保証する。
                                                displayItems.sort((a, b) => {
                                                    if (a.time !== b.time) return a.time - b.time;
                                                    // 同時刻のみタイブレーカー: horoscope/earthly_star (親) を先に
                                                    const isA_Base = a.mitigationId === 'horoscope' || a.mitigationId === 'earthly_star';
                                                    const isB_Base = b.mitigationId === 'horoscope' || b.mitigationId === 'earthly_star';
                                                    if (isA_Base && !isB_Base) return -1;
                                                    if (!isA_Base && isB_Base) return 1;
                                                    // 同時刻 / 同種別なら recast 短い順 → id 順
                                                    const rA = getRecast(a.mitigationId);
                                                    const rB = getRecast(b.mitigationId);
                                                    if (rA !== rB) return rA - rB;
                                                    return a.mitigationId.localeCompare(b.mitigationId);
                                                });

                                                const PLACEMENT_STEP = 12;
                                                const FULL_LANE_WIDTH = 24;
                                                const HALF_LANE_WIDTH = 12;
                                                const ICON_WIDTH = 24;
                                                const VISUAL_OFFSET = 2;  // 列左端からアイコンまでの視覚的オフセット (= 列幅設計の左右余白 L)
                                                const member = partyMembers.find(m => m.id === ownerMitigations[0]?.ownerId);
                                                const layout = memberLayout.get(ownerMitigations[0]?.ownerId);
                                                // 初回マウント時 layout 未確定 (refs が null) のため fallback 値で 1 フレーム描画。 2pass 目で実測値に上書きされる
                                                // セッション 17: T/H=151 (N=6 対称), DPS=53 (N=2 維持)
                                                // 詳細は src/index.css のコメント参照
                                                const fallbackColWidth = member?.role === 'tank' || member?.role === 'healer' ? 151 : 53;
                                                const colStart = layout?.left ?? 0;
                                                const colWidth = layout?.width ?? fallbackColWidth;
                                                // アイコン右端を「列右端 - VISUAL_OFFSET」 にキャップするため、 配置可能な最大 left は colWidth - VISUAL_OFFSET - ICON_WIDTH
                                                const MAX_LEFT = colWidth - VISUAL_OFFSET - ICON_WIDTH;
                                                // スプシ表示: 1 スキル = 1 列。レーン詰め(Phase 1)は通さず、列番号から left を決める
                                                const ownerSheetCols = sheetColumnMap ? (sheetColumnMap.get(ownerMitigations[0]?.ownerId) ?? []) : null;

                                                // ── Phase 1: 全アイコンの配置位置 (candidateLeft) を確定 ──
                                                // 既存のレーン詰めロジックを Phase 1 として分離。 時間重複を avoid して左から詰める
                                                const assignedPositions: { m: any, left: number }[] = [];

                                                if (!ownerSheetCols) displayItems.forEach(mitigation => {
                                                    // duration:0 のマーカー(挑発等)も最低1行分の footprint を持つ扱いにし、
                                                    // 同時刻の他アイコンとの重なり回避(レーン分け)を効かせる
                                                    const ovDur = (d: number) => Math.max(1, d);
                                                    const timeOverlaps = assignedPositions.filter(a =>
                                                        (a.m.time < mitigation.time + ovDur(mitigation.duration)) &&
                                                        (a.m.time + ovDur(a.m.duration) > mitigation.time)
                                                    );

                                                    let candidateLeft = 0;
                                                    if (mitigation.isVirtual) {
                                                        const parentPos = assignedPositions.find(a => a.m.id === mitigation.parentId);
                                                        if (parentPos) {
                                                            candidateLeft = parentPos.left;
                                                        }
                                                    } else {
                                                        while (candidateLeft <= MAX_LEFT) {
                                                            const hasCollision = timeOverlaps.some(a => {
                                                                if (a.m.isVirtual && a.m.parentId === mitigation.id) return false;
                                                                const isSameTime = Math.abs(a.m.time - mitigation.time) < 1;
                                                                const threshold = isSameTime ? FULL_LANE_WIDTH : HALF_LANE_WIDTH;
                                                                return Math.abs(a.left - candidateLeft) < threshold;
                                                            });
                                                            if (!hasCollision) break;
                                                            candidateLeft += PLACEMENT_STEP;
                                                        }
                                                    }

                                                    if (candidateLeft > MAX_LEFT) candidateLeft = MAX_LEFT;

                                                    assignedPositions.push({ m: mitigation, left: candidateLeft });
                                                });

                                                // ── Phase 2: rendering ──
                                                // 列幅自体を「左右余白 2px + N×ICON_WIDTH」 で対称設計しているため、
                                                // クラスタシフトは不要 (T/H=124 / DPS=52 で N=5 / N=2 が完全フィット)。
                                                const positionByMitId = new Map<string, number>();
                                                assignedPositions.forEach(p => positionByMitId.set(p.m.id, p.left));

                                                displayItems.forEach(mitigation => {
                                                    const candidateLeft = positionByMitId.get(mitigation.id) ?? 0;

                                                    // スプシ表示: 描く列(仮想アイテムは親の配置の列)。どの列にも寄せられなければ描かない
                                                    let sheetLeft: number | null = null;
                                                    if (ownerSheetCols) {
                                                        const colMitId = mitigation.isVirtual
                                                            ? (displayItems.find(d => d.id === mitigation.parentId)?.mitigationId ?? mitigation.mitigationId)
                                                            : mitigation.mitigationId;
                                                        const ci = sheetColumnIndex(ownerSheetCols, colMitId, MITIGATIONS);
                                                        if (ci < 0) {
                                                            if (import.meta.env.DEV) console.warn('[sheet] no column', mitigation.mitigationId);
                                                            return;
                                                        }
                                                        sheetLeft = sheetIconLeft(colStart, ci);
                                                    }

                                                    const durationSeconds = Math.max(1, mitigation.duration);
                                                    const durationEndTime = mitigation.time + durationSeconds - 1;

                                                    // コンパクトモード: 終了時間が空行なら、その前の可視行に切り詰める
                                                    let effectiveEndTime = durationEndTime;
                                                    if (hideEmptyRows) {
                                                        const isEndVisible = eventsByTime.has(durationEndTime) || mitStartsByTime.has(durationEndTime);
                                                        if (!isEndVisible) {
                                                            // durationEndTime以下の最大の可視行を探す
                                                            let prevVisible = mitigation.time;
                                                            for (let t = durationEndTime; t >= mitigation.time; t--) {
                                                                if (eventsByTime.has(t) || mitStartsByTime.has(t)) {
                                                                    prevVisible = t;
                                                                    break;
                                                                }
                                                            }
                                                            effectiveEndTime = prevVisible;
                                                        }
                                                    }
                                                    // エフェクト棒もタイムライン末尾 (= maxTime = 行追加用空白行) でクリップ。
                                                    // 持続時間の長い学者スキル (鼓舞 30s 等) が末尾を超えて伸びる問題を防ぐ。
                                                    effectiveEndTime = Math.min(effectiveEndTime, maxTime);

                                                    // 縦位置はすべて rowLayout から(行の高さが攻撃数で変わっても帯が正しく伸びる)。
                                                    // top = 開始の秒の行の上端(MitigationItem の基準)。帯は最上段の中央(アイコン中央)から、
                                                    // 「効果がかかる最後の秒」の行の下端の 1px 上まで。
                                                    const top = rowLayout.topOf(mitigation.time);
                                                    const barTop = barStartY(rowLayout, mitigation.time);
                                                    const def = MITIGATIONS.find((m: any) => m.id === mitigation.mitigationId);
                                                    let height = Math.max(0, Math.round(barEndY(rowLayout, effectiveEndTime) - barTop));

                                                    if (!mitigation.isVirtual) {
                                                        if (def?.id === 'horoscope') {
                                                            const heliosInHoro = displayItems.filter((am: any) =>
                                                                am.isVirtual && am.parentId === mitigation.id
                                                            ).sort((a: any, b: any) => a.time - b.time);
                                                            if (heliosInHoro.length > 0) {
                                                                height = Math.max(0, Math.round(childIconCutY(rowLayout, heliosInHoro[0].time) - barTop));
                                                            }
                                                        }
                                                        if (def?.id === 'earthly_star' && durationSeconds > 10) {
                                                            height = Math.max(0, Math.round(childIconCutY(rowLayout, mitigation.time + 10) - barTop));
                                                        }
                                                        if (def && isLivingDeadStyle(def)) {
                                                            // WD 仮想アイコンの実際の開始(tT、重なり回避時は tT+1)で親バーを切る(ホロスコープと同じく仮想の time を参照)。
                                                            const wd = displayItems.find((am: any) => am.isVirtual && am.parentId === mitigation.id);
                                                            if (wd) {
                                                                height = Math.max(0, Math.round(childIconCutY(rowLayout, wd.time) - barTop));
                                                            }
                                                        }
                                                        // バリア(シールド)が吸収量を使い切ったら、その時点で棒を止める。
                                                        // スタック制シールド(ハイマ等)は damageMapResult 側で除外済み(壊れても継続扱い)。
                                                        // バリア + 持続 % 軽減の複合スキル(ホーリズム/原初の血気・猛り)は棒を切らない
                                                        // (バリアが割れても効果時間いっぱい % 軽減が乗り続けるため・2026-08-31 実機報告)。
                                                        // 既存の horoscope/earthly_star/WD クリップとは Math.min で共存させる。
                                                        if (def && shieldEffectBarEndsOnBarrierExhaustion(def) && shieldExhaustedAt.has(mitigation.id)) {
                                                            height = Math.min(height, Math.max(0, Math.round(barEndY(rowLayout, shieldExhaustedAt.get(mitigation.id)!) - barTop)));
                                                        }
                                                        // 上書き負けしたバリア: 負けた時刻で棒を止める(方式a)。overwritten に入るのはバリアのみなので def?.isShield 判定は不要。
                                                        if (barrierOverwrittenAt.has(mitigation.id)) {
                                                            height = Math.min(height, Math.max(0, Math.round(barEndY(rowLayout, barrierOverwrittenAt.get(mitigation.id)!) - barTop)));
                                                        }
                                                    }

                                                    const absoluteLeft = sheetLeft ?? colStart + VISUAL_OFFSET + candidateLeft;

                                                    renderedItems.push(
                                                        <MitigationItem
                                                            key={mitigation.id}
                                                            mitigation={mitigation}
                                                            rowLayout={rowLayout}
                                                            onRemove={(mitigation.isVirtual || readOnly) ? () => { } : removeMitigation}
                                                            onUpdateTime={(mitigation.isVirtual || readOnly) ? () => { } : updateMitigationTime}
                                                            top={top}
                                                            height={height}
                                                            left={absoluteLeft}
                                                            laneIndex={candidateLeft / PLACEMENT_STEP}
                                                            partySortOrder={partySortOrder}
                                                            scrollContainerRef={scrollContainerRef}
                                                            activeMitigations={ownerMitigations}
                                                            overlapOffset={0}
                                                            isVirtual={mitigation.isVirtual}
                                                            grayscale={mitigation.grayscale}
                                                            iconOverride={mitigation.iconOverride}
                                                            layoutReady={layout !== undefined}
                                                            isConflicting={conflictingIds.has(mitigation.id) && mitigation.id !== lastPlacedMitigationId}
                                                            onCellClick={handleCellClick}
                                                            slideOnSort={isMilspecTable}
                                                            iconPx={ownerSheetCols ? SHEET_ICON_PX : undefined}
                                                            onIconTap={ownerSheetCols && !mitigation.isVirtual ? handleCellClick : undefined}
                                                        />
                                                    );
                                                });

                                                // スプシ表示: リキャスト線(配置 1 件ごと・共有リキャストの列にも)
                                                if (ownerSheetCols) {
                                                    const ownerId = ownerMitigations[0]?.ownerId;
                                                    const ownerUses = timelineMitigations.filter(m => m.ownerId === ownerId);
                                                    // 線を引くのは「表に列がある配置」だけ(列が見つからない自動配置のドロー等は、押せるマス自体が無いので線も出さない)
                                                    const lineItems = placementsWithColumn(ownerUses, ownerSheetCols, MITIGATIONS);
                                                    renderedItems.push(
                                                        <SheetCooldownLines
                                                            key={`sheet-cd-${ownerId}`}
                                                            // autoHidden(戦闘前の自動配置)も判定(validateMitigationPlacement)には含まれるので線も引く。
                                                            // 表の折りたたみ(hideEmptyRows)で ownerMitigations から外れていても、持ち主の全配置から引く(ただし列がある配置だけ)
                                                            items={lineItems}
                                                            ownerUses={ownerUses}
                                                            cols={ownerSheetCols}
                                                            defs={MITIGATIONS}
                                                            colStart={colStart}
                                                            layout={rowLayout}
                                                            maxTime={maxTime}
                                                            isRowVisible={(t) => !hideEmptyRows || eventsByTime.has(t) || mitStartsByTime.has(t)}
                                                            layoutReady={layout !== undefined}
                                                        />
                                                    );
                                                }
                                            });

                                            return renderedItems;
                                        })()}
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

            {/* メモモード フローティングバー */}
            {isMemoMode && (
                <MemoFloatingBar
                    memoCount={memos.length}
                    onExit={() => useMitigationStore.getState().setToolMode('idle')}
                />
            )}

            {clipboardEvent && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5 bg-app-bg border border-app-text/15 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,.6)] transition-all duration-300 pointer-events-auto">
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

            {/* ── モバイル軽減一覧シート: 全メンバーの軽減を一画面で表示 ── */}
            <MobileBottomSheet
                isOpen={mobileMitiFlow.isOpen}
                onClose={() => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }))}
                title={
                    <span className="flex flex-col min-w-0 items-start gap-0.5">
                        <span className="text-app-base font-black text-app-text-muted uppercase tracking-widest">{t('timeline.add_mitigation_here')}</span>
                        <span className="text-app-md text-app-text font-mono">
                            {(() => {
                                const flowTime = mobileMitiFlow.time;
                                const eventsAtTime = timelineEvents.filter(e => e.time === flowTime);
                                const timeStr = Math.floor(Math.abs(flowTime) / 60) + ':' + (Math.abs(flowTime) % 60).toString().padStart(2, '0');
                                const eventName = eventsAtTime.length > 0
                                    ? (eventsAtTime[0].name ? getPhaseName(eventsAtTime[0].name, contentLanguage) : null)
                                    : null;
                                return <>{timeStr}{eventName ? ` — ${eventName}` : ''}</>;
                            })()}
                        </span>
                    </span>
                }
                height="80dvh"
                fillContent
                swipeArea="handle"
            >
                <div className="flex-1 min-h-0 flex flex-col relative">
                        {/* この時間に配置済みの軽減アイコン — 専用行(長い攻撃名と競合して見えなくなるのを防ぐ)。
                            「ちょうどこの秒に置かれたもの」だけでなく「効果が続いていて今も効いているもの」も含める
                            (タイムライン本体行の mitigationsByTime と同じ判定 = mit.time <= t < mit.time+duration)。 */}
                        {(() => {
                            const placed = timelineMitigations.filter(am =>
                                !am.autoHidden && am.time <= mobileMitiFlow.time && mobileMitiFlow.time < am.time + am.duration
                            );
                            if (placed.length === 0) return null;
                            return (
                                <div className="px-4 pb-2 flex items-center gap-1 flex-wrap">
                                    {placed.map(am => {
                                        const def = MITIGATIONS.find(m => m.id === am.mitigationId);
                                        if (!def) return null;
                                        return <img key={am.id} src={def.icon} className="w-[22px] h-[22px] rounded-sm object-contain opacity-80" />;
                                    })}
                                </div>
                            );
                        })()}
                        {/* 対象/鼓舞の選択サブビュー (対象指定スキル・展開戦術等)。pending 中はスキル一覧に重ねて表示 */}
                        {mobileMitiFlow.pending && (() => {
                            const pending = mobileMitiFlow.pending;
                            if (!pending) return null;
                            const place = (extra: { targetId?: string; linkedMitigationId?: string }) => {
                                addMitigation({
                                    id: genId(),
                                    mitigationId: pending.mit.id,
                                    time: mobileMitiFlow.time,
                                    duration: pending.mit.duration,
                                    ownerId: pending.ownerId,
                                    ...extra,
                                });
                                setMobileMitiFlow(prev => ({ ...prev, pending: null }));
                            };
                            const skillName = getPhaseName(pending.mit.name, contentLanguage);
                            return (
                                <div className="absolute inset-0 z-10 bg-app-bg flex flex-col" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-app-border shrink-0">
                                        <button
                                            onClick={() => setMobileMitiFlow(prev => ({ ...prev, pending: null }))}
                                            className="flex items-center gap-1 text-app-base font-black text-app-text-sec uppercase tracking-tighter active:scale-95 cursor-pointer"
                                        >
                                            <ChevronLeft size={16} />
                                            {pending.mode === 'target'
                                                ? t('mitigation.select_target', '対象を選択')
                                                : t('mitigation.select_shield', '展開する鼓舞を選択')}
                                        </button>
                                        <span className="text-app-sm text-app-text-muted truncate ml-1">{skillName}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3">
                                        {pending.mode === 'target' ? (
                                            <div className="grid grid-cols-4 gap-2">
                                                {sortedPartyMembers.map(member => {
                                                    const job = JOBS.find(j => j.id === member.jobId);
                                                    const isSelfRestricted = pending.mit.targetCannotBeSelf && member.id === pending.ownerId;
                                                    return (
                                                        <button
                                                            key={member.id}
                                                            disabled={isSelfRestricted}
                                                            onClick={() => { if (!isSelfRestricted) place({ targetId: member.id }); }}
                                                            className={clsx(
                                                                "aspect-square rounded-xl border flex items-center justify-center transition-all",
                                                                isSelfRestricted
                                                                    ? "opacity-30 grayscale border-app-border cursor-not-allowed"
                                                                    : "bg-app-surface2 border-app-border active:scale-90 cursor-pointer"
                                                            )}
                                                        >
                                                            {job ? (
                                                                <img src={job.icon} className="w-9 h-9 object-contain rounded" />
                                                            ) : (
                                                                <span className={clsx(
                                                                    "text-app-lg font-black uppercase tracking-tighter",
                                                                    member.role === 'tank' ? 'text-app-role-tank'
                                                                        : member.role === 'healer' ? 'text-app-role-healer'
                                                                            : 'text-app-role-dps'
                                                                )}>
                                                                    {t(`modal.${member.id.toLowerCase()}`, member.id)}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {pending.shields.length === 0 ? (
                                                    <button
                                                        onClick={() => place({})}
                                                        className="w-full p-3 rounded-xl border border-app-border bg-app-surface2 text-app-base text-app-text-sec active:scale-95 cursor-pointer"
                                                    >
                                                        {t('mitigation.no_shield', '有効な鼓舞がありません')}（{t('mitigation.shield_value', { value: 0 })}）
                                                    </button>
                                                ) : (
                                                    pending.shields.map(shield => {
                                                        const shieldOwner = partyMembers.find(p => p.id === shield.ownerId);
                                                        const targetMember = shield.targetId
                                                            ? partyMembers.find(p => p.id === shield.targetId)
                                                            : shieldOwner;
                                                        const targetJob = targetMember?.jobId ? JOBS.find(j => j.id === targetMember.jobId) : null;
                                                        const barrierValue = calculateLinkedShieldValue(shield, timelineMitigations, partyMembers, MITIGATIONS);
                                                        return (
                                                            <button
                                                                key={shield.id}
                                                                onClick={() => place({ linkedMitigationId: shield.id })}
                                                                className="flex items-center gap-3 p-3 rounded-xl border border-app-border bg-app-surface2 active:scale-95 cursor-pointer"
                                                            >
                                                                {targetJob ? (
                                                                    <img src={targetJob.icon} className="w-8 h-8 object-contain rounded shrink-0" />
                                                                ) : (
                                                                    <span className="w-8 h-8 flex items-center justify-center text-app-lg font-black tracking-tighter uppercase shrink-0">
                                                                        {t(`modal.${(targetMember?.id || '').toLowerCase()}`, targetMember?.id || '')}
                                                                    </span>
                                                                )}
                                                                <div className="flex flex-col items-start min-w-0">
                                                                    <span className="text-app-base font-bold text-app-text truncate">
                                                                        {t(`modal.${(targetMember?.id || '').toLowerCase()}`, targetMember?.id || '')}
                                                                    </span>
                                                                    <span className="text-app-sm text-app-text-sec">
                                                                        {t('mitigation.shield_value', { value: barrierValue.toLocaleString() })}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                        {/* ジョブごとセクション化 (パーティ編成順 MT→D4)、 各セクション内は PC モーダルと同じ並び順 */}
                        <div className="flex-1 overflow-y-auto px-2 pb-4">
                            <div className="flex flex-col gap-3">
                                {sortedPartyMembers.map(member => {
                                    const job = JOBS.find(j => j.id === member.jobId);
                                    if (!job) return null;
                                    const memberMitis = timelineMitigations.filter(m => m.ownerId === member.id);
                                    const mitis = MITIGATIONS
                                        .filter(m =>
                                            m.jobId === job.id
                                            && !m.hidden
                                            && (!m.minLevel || m.minLevel <= currentLevel)
                                            && (!m.maxLevel || m.maxLevel >= currentLevel)
                                        )
                                        // ソートは「すり替え前」の id で行う(PC版と同じ理由: セラフィズムの
                                        // 発動/終了のたびに一覧内の表示位置が飛ぶのを防ぐ)
                                        .sort((a, b) => getMitigationPriority(a.id) - getMitigationPriority(b.id))
                                        .map(m => resolveSeraphismMitigation(m, mobileMitiFlow.time, memberMitis, MITIGATIONS));
                                    if (mitis.length === 0) return null;

                                    return (
                                        <section key={member.id}>
                                            {/* セクションヘッダー: スロット記号 + ジョブアイコン + ジョブ名 */}
                                            <div className="flex items-center gap-2 px-1 mb-1.5">
                                                <span className="text-app-base font-black text-app-text-muted uppercase tracking-widest">
                                                    {t(`modal.${member.id.toLowerCase()}`, member.id)}
                                                </span>
                                                <img src={job.icon} className="w-5 h-5 object-contain rounded" />
                                                <span className="text-app-sm font-bold text-app-text">
                                                    {getPhaseName(job.name, contentLanguage)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-5 gap-1.5">
                                                {mitis.map(mit => {
                                                    const isAlreadyPlaced = memberMitis.some(am => am.mitigationId === mit.id && am.time === mobileMitiFlow.time);
                                                    const status = validateMitigationPlacement(
                                                        mit, mobileMitiFlow.time, memberMitis, t
                                                    );
                                                    // PC の MitigationSelector と同じ判定に統一(競合時も配置可能に)。
                                                    // conflictOverride: 既存CD中(forward)でも見た目は赤のままクリックだけ解放。
                                                    const isClickable = status.available || status.conflictOverride || isAlreadyPlaced;

                                                    return (
                                                        <button
                                                            key={`${member.id}-${mit.id}`}
                                                            disabled={!isClickable}
                                                            onClick={() => {
                                                                if (isAlreadyPlaced) {
                                                                    const amToRemove = memberMitis.find(am => am.mitigationId === mit.id && am.time === mobileMitiFlow.time);
                                                                    if (amToRemove) removeMitigation(amToRemove.id);
                                                                    return;
                                                                }
                                                                if (!status.available && !status.conflictOverride) return;
                                                                // 対象指定スキル(インターベンション等)/鼓舞コピー(展開戦術等)は
                                                                // 即配置せず、サブ選択ビューへ。それ以外は即配置。
                                                                const resolution = resolveMitigationTap(mit, mobileMitiFlow.time, timelineMitigations);
                                                                if (resolution.kind === 'selectTarget') {
                                                                    setMobileMitiFlow(prev => ({ ...prev, pending: { mode: 'target', mit, ownerId: member.id } }));
                                                                    return;
                                                                }
                                                                if (resolution.kind === 'selectShield') {
                                                                    setMobileMitiFlow(prev => ({ ...prev, pending: { mode: 'shield', mit, ownerId: member.id, shields: resolution.shields } }));
                                                                    return;
                                                                }
                                                                addMitigation({
                                                                    id: genId(),
                                                                    mitigationId: mit.id,
                                                                    time: mobileMitiFlow.time,
                                                                    duration: mit.duration,
                                                                    ownerId: member.id,
                                                                    linkedMitigationId: resolution.linkedMitigationId,
                                                                });
                                                            }}
                                                            className={clsx(
                                                                "aspect-square rounded-xl border flex items-center justify-center relative overflow-hidden transition-all active:scale-90",
                                                                isAlreadyPlaced
                                                                    ? "bg-app-text/20 border-app-text"
                                                                    : status.warning
                                                                        ? "bg-app-amber-dim border-app-amber opacity-60"
                                                                        : status.available
                                                                            ? "bg-app-surface2 border-app-border"
                                                                            : "bg-black/20 border-app-red-border opacity-60"
                                                            )}
                                                        >
                                                            <img src={mit.icon} className="w-9 h-9 object-contain rounded" />
                                                            {/* リキャスト/使用不可メッセージ — 軽くグレーアウト + 文字を下端に詰める */}
                                                            {!status.available && !isAlreadyPlaced && status.message && (
                                                                <div className="absolute inset-0 bg-black/30">
                                                                    <span className="absolute bottom-0.5 left-0 right-0 text-app-base leading-tight font-bold text-app-red text-center px-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                                                        {status.message}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {/* リキャスト競合警告 — 軽くグレーアウト + 文字を下端に詰める */}
                                                            {status.warning && (status.shortMessage || status.message) && (
                                                                <div className="absolute inset-0 bg-black/30">
                                                                    <span className="absolute bottom-0.5 left-0 right-0 text-app-base leading-tight font-bold text-app-amber text-center px-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                                                                        {status.shortMessage || status.message}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {isAlreadyPlaced && (
                                                                <div className="absolute top-1 right-1">
                                                                    <X size={12} className="text-app-text drop-shadow-sm" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        </div>
                </div>
            </MobileBottomSheet>

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
            {/* スマホ: 画面左端に Undo/Redo 常設（編集系は常設ツールバー・ナビ枠を消費しない。チュートリアル中は FAB と同様に隠す）。
                以前は FAB のすぐ左(右端寄り)に置いていたが、スクロールする親指の可動域に重なるという
                実機FBがあり、反対側の左端に移動(2026-08-13)。右端のFABと見た目を揃えるため、
                スクロール中はこちらも同じように隠す(ユーザー要望・2026-08-13)。 */}
            {!tutorialActive && <div
                ref={undoRedoWrapRef}
                className="mobile-undo-redo-wrap fixed z-[300] md:hidden flex items-center gap-2"
                style={{
                    // ボトムナビゲーションになるべく近づける(2026-08-13ユーザー要望)。MobileFAB.tsx の
                    // FAB本体と同じ計算式(bottomNav.height + 少しの余白)に揃える。
                    bottom: `calc(${MOBILE_TOKENS.bottomNav.height}px + 0.5rem)`,
                    left: '1rem',
                }}
            >
                <button
                    onClick={() => useMitigationStore.getState().undo()}
                    disabled={!canUndo || readOnly}
                    aria-label={t('timeline.undo')}
                    className="flex items-center justify-center border text-app-text shadow-xl active:scale-90 transition-transform duration-100 disabled:opacity-40 disabled:pointer-events-none"
                    style={{
                        width: MOBILE_TOKENS.fab.itemSize,
                        height: MOBILE_TOKENS.fab.itemSize,
                        borderRadius: MOBILE_TOKENS.fab.radius,
                        backgroundColor: 'var(--color-fab-bg)',
                        borderColor: 'var(--color-fab-border)',
                    }}
                >
                    <Undo2 size={18} />
                </button>
                <button
                    onClick={() => useMitigationStore.getState().redo()}
                    disabled={!canRedo || readOnly}
                    aria-label={t('timeline.redo')}
                    className="flex items-center justify-center border text-app-text shadow-xl active:scale-90 transition-transform duration-100 disabled:opacity-40 disabled:pointer-events-none"
                    style={{
                        width: MOBILE_TOKENS.fab.itemSize,
                        height: MOBILE_TOKENS.fab.itemSize,
                        borderRadius: MOBILE_TOKENS.fab.radius,
                        backgroundColor: 'var(--color-fab-bg)',
                        borderColor: 'var(--color-fab-border)',
                    }}
                >
                    <Redo2 size={18} />
                </button>
            </div>}

            <MobileBottomSheet
                isOpen={mobileToolsSheetOpen}
                onClose={() => setMobileToolsSheetOpen(false)}
                title={t('mobile.import_title')}
                height="55vh"
                swipeArea="handle"
            >
                <div className="flex flex-col gap-3">
                    {/* FFLogs Import */}
                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            setImportModalOpen(true);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-app-text/5 border border-app-border text-app-text hover:bg-app-text/10 cursor-pointer"
                    >
                        <CloudDownload size={20} />
                        <div className="text-left">
                            <div className="text-app-2xl font-bold">FF Logs</div>
                            <div className="text-app-base text-app-text-muted">{t('fflogs.tooltip_generate')}</div>
                        </div>
                    </button>
                    {/* スプレッドシート取込: スマホでは非表示(有名スプシのマトリクス構造はスマホ貼付で
                        構造的に取り込めず、URL直読みは「あらゆるスプシ対応」を目指す前提で棚上げ。2026-06-30 判断)。
                        PC の入口(menu イベント→setShowGridImport)は別経路で維持。 */}
                    {/* Popular Plans — みんなの軽減表ボトムシートを開く */}
                    <button
                        onClick={() => {
                            setMobileToolsSheetOpen(false);
                            setIsMitiSheetOpen(true);
                        }}
                        className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border border-app-border hover:bg-app-surface2 transition-colors"
                    >
                        <div>
                            <p className="text-app-2xl font-bold text-app-text">{t('popular.open_popular')}</p>
                            <p className="text-app-lg text-app-text-muted">{t('popular.subtitle')}</p>
                        </div>
                    </button>
                </div>
            </MobileBottomSheet>
            <MitigationSheet
                isOpen={isMitiSheetOpen}
                onClose={() => setIsMitiSheetOpen(false)}
                currentContentId={currentContentId}
            />
            {phasePopover && createPortal(
                <div
                    className="fixed inset-0 z-[9998] cursor-default md:bg-transparent bg-black/50 md:backdrop-blur-none backdrop-blur-[2px]"
                    {...backdropClose(() => setPhasePopover(null))}
                >
                    <div
                        className={clsx(
                            "min-w-[200px] rounded-xl py-1.5 glass-tier3 glass-panel",
                            "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]",
                            "md:static md:absolute md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:w-auto"
                        )}
                        style={{
                            ...(window.innerWidth >= 768 ? {
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
                    className="fixed inset-0 z-[9998] cursor-default md:bg-transparent bg-black/50 md:backdrop-blur-none backdrop-blur-[2px]"
                    {...backdropClose(() => setLabelPopover(null))}
                >
                    <div
                        className={clsx(
                            "min-w-[200px] rounded-xl py-1.5 glass-tier3 glass-panel",
                            "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]",
                            "md:static md:absolute md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:w-auto"
                        )}
                        style={{
                            ...(window.innerWidth >= 768 ? {
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
                    className="fixed inset-0 z-[9998] cursor-default md:bg-transparent bg-black/50 md:backdrop-blur-none backdrop-blur-[2px]"
                    {...backdropClose(() => setEventPopover(null))}
                >
                    <div
                        className={clsx(
                            "min-w-[200px] rounded-xl py-1.5 glass-tier3 glass-panel",
                            "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]",
                            // モバイル: 画面中央、PC: クリック位置
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)]",
                            "md:static md:absolute md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:w-auto"
                        )}
                        style={{
                            // PCのみ位置を適用
                            ...(window.innerWidth >= 768 ? {
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
                        {typeof window !== 'undefined' && window.innerWidth < 768 && (
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

            {/* AA 配置モード フローティングバー */}
            {createPortal(
                <div className={clsx(
                    "fixed bottom-6 left-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5",
                    "bg-app-bg border border-app-text/15 rounded-2xl",
                    "shadow-[0_8px_32px_rgba(0,0,0,.6)]",
                    "transition-all duration-300",
                    isAaModeEnabled
                        ? "opacity-100 -translate-x-1/2 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-x-1/2 translate-y-10 pointer-events-none"
                )}>
                    {/* 現在の設定ラベル */}
                    <span className="text-app-md font-black text-app-text whitespace-nowrap">
                        <Sword size={12} className="inline mr-1.5 -mt-0.5" />
                        {t('aa_settings.floating_label', {
                            damage: aaSettings.damage.toLocaleString(),
                            target: aaSettings.target,
                            type: t(`aa_settings.${aaSettings.type === 'magical' ? 'magic' : aaSettings.type === 'physical' ? 'phys' : 'dark'}`)
                        })}
                    </span>
                    <div className="w-px h-5 bg-app-text/10 shrink-0" />
                    {/* 設定変更ボタン */}
                    <button
                        onClick={() => setAaSettingsOpen(true)}
                        className="py-1.5 px-3 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                        <Settings size={12} className="inline mr-1 -mt-0.5" />
                        {t('aa_settings.change_settings')}
                    </button>
                    <div className="w-px h-5 bg-app-text/10 shrink-0" />
                    {/* 終了ボタン */}
                    <button
                        onClick={() => setIsAaModeEnabled(false)}
                        className="py-1.5 px-3 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                        <X size={12} className="inline mr-1 -mt-0.5" />
                        {t('aa_settings.end_mode')}
                    </button>
                </div>,
                document.body
            )}

            {/* TL選択モード フローティングバー */}
            {createPortal(
                <div className={clsx(
                    "fixed bottom-6 left-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5",
                    "bg-app-bg border border-app-blue/30 rounded-2xl",
                    "shadow-[0_8px_32px_rgba(0,0,0,.6)]",
                    "transition-all duration-300",
                    (timelineSelectMode || labelSelectMode)
                        ? "opacity-100 -translate-x-1/2 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-x-1/2 translate-y-10 pointer-events-none"
                )}>
                    <Crosshair size={14} className="text-app-blue shrink-0" />
                    <span className="text-app-md font-black text-app-text whitespace-nowrap">
                        {(timelineSelectMode?.field === 'startTime' || labelSelectMode?.field === 'startTime')
                            ? t('boundary_modal.select_banner_start')
                            : t('boundary_modal.select_banner')}
                    </span>
                    <div className="w-px h-5 bg-app-text/10 shrink-0" />
                    <button
                        onClick={() => {
                            if (timelineSelectMode) {
                                setTimelineSelectMode(null);
                                throttledUpdatePreview(null);
                            }
                            if (labelSelectMode) {
                                setLabelSelectMode(null);
                                throttledUpdatePreview(null);
                            }
                        }}
                        className="py-1.5 px-3 rounded-lg text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                        <X size={12} className="inline mr-1 -mt-0.5" />
                        {t('modal.cancel')}
                    </button>
                </div>,
                document.body
            )}

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

            {/* 動画埋め込み式タイムライン作成モーダル */}
            <VideoRecorderModal isOpen={videoModalOpen} onClose={() => setVideoModalOpen(false)} />
        </>
    );
};

export default Timeline;