import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { TimelineRow } from './TimelineRow';
import { MobileTimelineRow } from './MobileTimelineRow';
import { MobileContextMenu } from './MobileContextMenu';
import { MobileEffectBarLayer } from './MobileEffectBarLayer';

import { useMitigationStore } from '../store/useMitigationStore';
import { useRenderPendingStore } from '../store/useRenderPendingStore';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../store/usePlanStore';
import { useCollabJoinerSession } from '../store/useCollabJoinerSession';
import { useTutorialStore } from '../store/useTutorialStore';
import { useThemeStore, useEffectiveThemeStyle, useEffectiveTimelineView } from '../store/useThemeStore';
import { useStableCallback } from '../hooks/useStableCallback';
import type { TimelineEvent, Mitigation, PartyMember, AppliedMitigation, LocalizedString, Phase, Label } from '../types';
import { getPhaseName } from '../types';
import { EventModal } from './EventModal';
import { ClearMitigationsPopover } from './ClearMitigationsPopover';
import { BoundaryEditModal } from './BoundaryEditModal';

import { MitigationSelector } from './MitigationSelector';
import { JobPicker } from './JobPicker';
import { PartySettingsModal } from './PartySettingsModal';
import { JobMigrationModal } from './JobMigrationModal';
import { migrateMitigations } from '../utils/jobMigration';
import {
    computeMobileEffectBars,
    MOBILE_EFFECT_BAR_ROW_INSET,
    MOBILE_EFFECT_BAR_SLOT_PITCH,
    MOBILE_MITI_ICON_PITCH_PX,
    MOBILE_MITI_ICONS_ROW_PADDING_PX,
} from '../utils/mobileEffectBar';
import { AASettingsPopover } from './AASettingsPopover';
import {
    Pencil, Trash2, Plus, X, Undo2, Redo2, AlignJustify, CloudDownload, Sword, ChevronDown, ChevronLeft, Rows3, Settings, Crosshair, PictureInPicture2, Clock
} from 'lucide-react';
import VideoRecorderModal from './VideoRecorderModal';
import { useJobs, useMitigations, getMitigationPriority } from '../hooks/useSkillsData';
import { useSmoothWheelScroll } from '../lib/scroll/useSmoothWheelScroll';
import clsx from 'clsx';
import { getSortedPartyMemberIds } from '../constants/party';
import { DEFAULT_FIGHT_DURATION_SEC } from '../constants/timeline';
import { FFLogsImportModal } from './FFLogsImportModal';
import { validateMitigationPlacement } from '../utils/resourceTracker';
import { ConflictOffscreenArrows } from './timeline/ConflictOffscreenArrows';
import type { ConflictPoint } from './timeline/conflictArrows';
import { computeRowLayout, EMPTY_ROW_LAYOUT, ROW_UNIT_PX, barStartY, barEndY, childIconCutY } from './timeline/rowLayout';
import type { RowLayout } from './timeline/rowLayout';
import { calculateLinkedShieldValue } from '../utils/calculator';
import { isLivingDeadStyle } from '../utils/livingDead';
import { resolveMitigationTap } from '../utils/mitigationTapResolver';
import { resolveSeraphismMitigation } from '../utils/scholarShieldRules';
import { useTimelineMobileScrollChrome } from './timeline/useTimelineMobileScrollChrome';
import { useTimelineAaEscape, useTimelineShortcutKeys, useTimelineEscapeKeys } from './timeline/useTimelineKeyboard';
import { useTimelineAutoPlan } from './timeline/useTimelineAutoPlan';
import { useTimelineHeaderEvents, useTimelineTutorialEvents, useTimelineProgressJump, useTimelineResetUiEvent, useTimelineClearMenuOutsideClick } from './timeline/useTimelineWindowEvents';
import { useMeasuredMemberLayout } from './Timeline.layoutHooks';
import type { MemberRefEntry } from './Timeline.layoutHooks';
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
import { RecastRow, type RecastRowHandle } from './RecastRow';
import { SheetColumnHeader } from './timeline/sheet/SheetColumnHeader';
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
import { JobPickerRow } from './JobPickerRow';
// 軍事専用部品は標準テーマに配信しないよう遅延読み込み(useSortSlide は軽い hook なので静的のまま)
const MilspecControlDeck = React.lazy(() => import('./military/table/MilspecControlDeck').then(m => ({ default: m.MilspecControlDeck })));
const MilspecJackBoard = React.lazy(() => import('./military/table/MilspecJackBoard').then(m => ({ default: m.MilspecJackBoard })));
const MilspecReticle = React.lazy(() => import('./military/table/MilspecReticle').then(m => ({ default: m.MilspecReticle })));
const MilspecRowPrinter = React.lazy(() => import('./military/table/MilspecRowPrinter').then(m => ({ default: m.MilspecRowPrinter })));
import { MemoOverlay } from './Memo/MemoOverlay';
import { MemoInputBox } from './Memo/MemoInputBox';
import { MemoFloatingBar } from './Memo/MemoFloatingBar';
import { yToTimeSec, pxToXRatio, xRatioToPx, reanchorScrollTop } from './Memo/coords';
import { CursorOverlay } from './collab/CursorOverlay';
import { useCollabPresenceStore } from '../store/useCollabPresenceStore';
import { useProgressRecording } from './progress/useProgressRecording';
import { SpreadsheetGridImportModal } from './SpreadsheetGridImportModal';
import { shieldEffectBarEndsOnBarrierExhaustion } from '../utils/barrierStacking';

import { PlacementToast } from './timeline/sheet/PlacementToast';
import { backdropClose } from '../utils/backdropClose';
import { TableHoverHighlight, type HoverGeom } from './timeline/sheet/TableHoverHighlight';
import { lanesBands, sheetBands, convertMemberX, lanesSheetWidth, readLanesColumnVars } from './timeline/sheet/memberX';
import { buildAppliedMitigation } from './timeline/sheet/sheetTap';
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

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
    const [selectedTime, setSelectedTime] = useState<number>(0);
    const [eventModalPosition, setEventModalPosition] = useState({ x: 0, y: 0 });
    const [eventPopover, setEventPopover] = useState<{ event: TimelineEvent; position: { x: number; y: number } } | null>(null);

    const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState<{ id: string; name: LocalizedString; startTime: number; endTime: number } | null>(null);
    const [selectedPhaseTime, setSelectedPhaseTime] = useState<number>(0);
    const [phaseModalPosition, setPhaseModalPosition] = useState({ x: 0, y: 0 });
    const [timelineSelectMode, setTimelineSelectMode] = useState<{ phaseId: string; startTime: number; field: 'startTime' | 'endTime' } | null>(null);
    const [labelSelectMode, setLabelSelectMode] = useState<{ labelId: string; startTime: number; field: 'startTime' | 'endTime' } | null>(null);
    const [showPreStart] = useState(true);
    const isMobileTimeline = typeof window !== 'undefined' && window.innerWidth < 768;
    // PC 軍事モードのときだけ true。標準では常に false = 従来 DOM のまま (標準モード不変)。
    const themeStyle = useEffectiveThemeStyle();
    const isMilspecTable = themeStyle === 'military' && !isMobileTimeline;
    // 1 段の高さ(PC=攻撃 1 つ分 / スマホ=カード 1 枚)。縦位置は rowLayout(下で計算)から得る
    const rowUnitPx = isMobileTimeline ? ROW_UNIT_PX.mobile : ROW_UNIT_PX.pc;
    // プレビュー強調フックが参照する ref(scrollContainerRef / rowLayoutRef は宣言位置のみここへ前出し)
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    // 行の配置係の最新値。コールバック(スクロール同期・ジャンプ・範囲選択)は描画後にこれを読む。
    // 書き込みは rowLayout の useMemo の直後(描画中)で 1 回だけ。
    const rowLayoutRef = useRef<RowLayout>(EMPTY_ROW_LAYOUT);
    const { overlayRef, throttledUpdatePreview } = useTimelinePreviewHighlight({
        scrollContainerRef, rowLayoutRef, timelineSelectMode, labelSelectMode, showPreStart,
    });
    const sheetContainerRef = useRef<HTMLDivElement>(null);
    // sheetWidth を state 化 + ResizeObserver で動的更新 (初期 0 で left=0 に固まる問題を解決)
    const [sheetWidth, setSheetWidth] = useState(0);
    useLayoutEffect(() => {
        const el = sheetContainerRef.current;
        if (!el) return;
        const updateWidth = () => setSheetWidth(el.getBoundingClientRect().width);
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    // ④-b-2: CursorOverlay の rAF が再描画なしで最新幅を読めるよう ref ミラーを保持(sheetWidth は低頻度更新)。
    const sheetWidthRef = useRef(sheetWidth);
    sheetWidthRef.current = sheetWidth;

    // モバイル軽減アイコン専用行: 1行に入りきる最大アイコン数(画面幅から算出、maxConcurrentと
    // 同じ考え方)。あふれた分は折り返さず「+N」バッジにする(2026-08-13ユーザー要望=
    // 行の高さを固定コマからはみ出させないため、2段折り返しは絶対にしない)。
    const maxMitiIconsPerRow = useMemo(() => {
        const availableWidth = (sheetWidth > 0 ? sheetWidth : 350) - MOBILE_MITI_ICONS_ROW_PADDING_PX * 2;
        return Math.max(1, Math.floor(availableWidth / MOBILE_MITI_ICON_PITCH_PX));
    }, [sheetWidth]);

    const [phasePopover, setPhasePopover] = useState<{ phase: Phase; position: { x: number; y: number }; clickTime: number } | null>(null);

    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState<{ id: string; name: LocalizedString; startTime: number; endTime: number } | null>(null);
    const [selectedLabelTime, setSelectedLabelTime] = useState<number>(0);
    const [labelModalPosition, setLabelModalPosition] = useState({ x: 0, y: 0 });
    const [labelPopover, setLabelPopover] = useState<{ label: Label; position: { x: number; y: number }; clickTime: number } | null>(null);

    const [mobileMitiFlow, setMobileMitiFlow] = useState<{
        isOpen: boolean;
        time: number;
        step: 'job' | 'skill';
        selectedMemberId: string | null;
        // 対象/鼓舞の選択が必要なスキルをタップしたとき、サブ選択ビューに渡す情報。null = 通常のスキル一覧。
        pending?:
            | { mode: 'target'; mit: Mitigation; ownerId: string }
            | { mode: 'shield'; mit: Mitigation; ownerId: string; shields: AppliedMitigation[] }
            | null;
    }>({ isOpen: false, time: 0, step: 'job', selectedMemberId: null, pending: null });

    const [mobileContextMenu, setMobileContextMenu] = useState<{
        isOpen: boolean;
        event: TimelineEvent | null;
        time: number;
    } | null>(null);

    const [mitigationSelectorOpen, setMitigationSelectorOpen] = useState(false);
    const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedMitigationTime, setSelectedMitigationTime] = useState<number>(0);

    const [jobPickerOpen, setJobPickerOpen] = useState(false);
    const [jobPickerPosition, setJobPickerPosition] = useState({ x: 0, y: 0 });
    const [jobPickerMemberId, setJobPickerMemberId] = useState<string | null>(null);

    // ヘッダーナビゲーション
    const [phaseDropdownOpen, setPhaseDropdownOpen] = useState(false);
    const [gimmickDropdownOpen, setGimmickDropdownOpen] = useState(false);
    const [timeInputOpen, setTimeInputOpen] = useState(false);
    const [mechanicSearchOpen, setMechanicSearchOpen] = useState(false);
    const [phaseColumnCollapsed, setPhaseColumnCollapsed] = useState(() => {
        try { return localStorage.getItem('lopo-phase-col-collapsed') === 'true'; } catch { return false; }
    });
    const [labelColumnCollapsed, setLabelColumnCollapsed] = useState(() => {
        try { return localStorage.getItem('lopo-label-col-collapsed') === 'true'; } catch { return false; }
    });
    // リキャスト行の表示 ON/OFF (セッション 18 案 C1 物理移動)。 デフォルト ON。
    const [recastRowVisible, setRecastRowVisible] = useState(() => {
        try {
            const v = localStorage.getItem('lopo-recast-row-visible');
            return v === null ? true : v === 'true';
        } catch { return true; }
    });
    const phaseHeaderRef = useRef<HTMLDivElement>(null);
    const gimmickHeaderRef = useRef<HTMLDivElement>(null);
    const timeHeaderRef = useRef<HTMLDivElement>(null);
    const mechanicHeaderRef = useRef<HTMLDivElement>(null);

    const [migrationConfig, setMigrationConfig] = useState<{
        isOpen: boolean;
        memberId: string;
        oldJobId: string;
        newJobId: string;
    } | null>(null);

    const fightDuration = DEFAULT_FIGHT_DURATION_SEC;

    const handleTogglePhaseCollapse = () => {
        setPhaseColumnCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('lopo-phase-col-collapsed', String(next)); } catch {}
            return next;
        });
    };

    const handleToggleLabelCollapse = () => {
        setLabelColumnCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('lopo-label-col-collapsed', String(next)); } catch {}
            return next;
        });
    };

    const handleToggleRecastRowVisible = () => {
        setRecastRowVisible(prev => {
            const next = !prev;
            try { localStorage.setItem('lopo-recast-row-visible', String(next)); } catch {}
            return next;
        });
    };

    const hasLabels = labels.length > 0;
    const labelColumnVisible = !labelColumnCollapsed && !(phaseColumnCollapsed && !hasLabels);

    // useCallback で包む: progress:jump-to-time リスナが最新版を参照するため。
    // 縦位置は rowLayoutRef(常に最新の行の配置)から得るので deps 不要。
    const handleNavJump = useCallback((time: number) => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollTo({ top: rowLayoutRef.current.topOf(time), behavior: 'smooth' });
    }, []);

    // 「置いた時は既存の相手だけ光る」: 直前に手動配置したインスタンスは脈動/矢印から除外する。
    // リロードで null に戻るため、開き直した時は既存競合が両方光る(自己責任)。
    const lastPlacedMitigationId = useMitigationStore(s => s.lastPlacedMitigationId);

    // 取り込み・確認ダイアログの state(effect を渡すフックより前で必要なため、元の宣言位置から上へ移動。useState のみ・順序影響なし)。
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [showGridImport, setShowGridImport] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'warning'; confirmLabel?: string; cancelLabel?: string } | null>(null);

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


    // プラン切替時に縦横スクロールをトップ・左端へ、空行非表示をデフォルト(コンパクト)にリセット
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, left: 0 });
        }
        // 共同編集ルーム表示中(ジョイナー)は currentPlanId が参加者自身の無関係な個人プランを
        // 指したままになる(部屋を開いても更新されない)。その個人プランの空/非空を部屋の表示に
        // 持ち込まないよう、常にコンパクト表示から開始する。
        if (joinerRoomToken) {
            useMitigationStore.getState().setHideEmptyRows(true);
            return;
        }
        // チュートリアル中: NewPlanModal が hideEmptyRows を制御しているのでスキップ
        // 空プラン (新規作成直後・テンプレ未整備コンテンツ等): 軽減配置時刻を見せたいので強制的に展開状態へ
        const isTutorial = useTutorialStore.getState().isActive;
        const plan = usePlanStore.getState().plans.find(p => p.id === currentPlanId);
        const isEmptyPlan = plan ? (plan.data?.timelineEvents?.length ?? 0) === 0 : false;
        if (isTutorial) return;
        if (isEmptyPlan) {
            useMitigationStore.getState().setHideEmptyRows(false);
        } else {
            useMitigationStore.getState().setHideEmptyRows(true);
        }
    }, [currentPlanId, joinerRoomToken]);

    const aaSettingsButtonRef = useRef<HTMLButtonElement>(null);
    useSmoothWheelScroll(scrollContainerRef, { horizontalScrollOnShift: true, stiffness: 80, wheelMultiplier: 1.5 });
    const headerRef = useRef<HTMLDivElement>(null);
    const controlBarRef = useRef<HTMLDivElement>(null);
    // syncRecastRow がスクロール毎にY最近傍の時刻を逆引きするための索引。
    // timeToYMapをforEachで毎回全走査していたのをY昇順ソート済み配列+二分探索に変える
    // (2026-08-14ユーザー実機報告「スマホでスクロールが重い/変身アニメがとびとび」対応。
    // 長い戦闘ほどtimeToYMapの要素数が増え、毎スクロールイベントでの全走査コストが
    // 積み重なりメインスレッドを塞いでいた)。中身はtimeToYMapと同じタイミング(レイアウト
    // 再計算時)でのみ作り直し、スクロール中は読むだけ。
    const sortedTimeYRef = useRef<[number, number][]>([]);
    // handleScrollSync がヘッダー/コントロールバー内の対象要素を毎スクロールイベントで
    // querySelector していたのをキャッシュする(2026-08-14、実測プロファイルでスクロール毎の
    // 負荷の一因と判明)。要素が差し替わった場合のみ(isConnected/contains チェックで検知して)
    // 再検索するので、挙動(idヒット→firstElementChildフォールバック)は変えていない。
    const scrollSyncInnerElsRef = useRef<{ header: HTMLElement | null; controls: HTMLElement | null }>({ header: null, controls: null });
    // 表の展開/折りたたみ前後でスクロールアンカーを維持するため、直近のビューポート中央の時刻を保持
    const lastCenterTimeRef = useRef<number | null>(null);
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

    const handleScrollSync = () => {
        if (!scrollContainerRef.current) return;
        const scrollLeft = scrollContainerRef.current.scrollLeft;

        // 縦: 表の展開/折りたたみでアンカーを維持するため、ビューポート中央の時刻を記録
        const sc = scrollContainerRef.current;
        const centerT = yToTimeSec(sc.scrollTop + sc.clientHeight / 2, timeToYMapRef.current);
        if (centerT !== null) lastCenterTimeRef.current = centerT;

        // Use transform for more reliable sync across different content widths
        const containers = [
            { ref: headerRef, id: 'timeline-header-inner', cacheKey: 'header' as const },
            { ref: controlBarRef, id: 'timeline-controls-inner', cacheKey: 'controls' as const },
        ];

        containers.forEach(({ ref, id, cacheKey }) => {
            if (!ref.current) return;
            let inner = scrollSyncInnerElsRef.current[cacheKey];
            if (!inner || !inner.isConnected || !ref.current.contains(inner)) {
                inner = (ref.current.querySelector(`#${id}`) as HTMLElement | null)
                    ?? (ref.current.firstElementChild as HTMLElement | null);
                scrollSyncInnerElsRef.current[cacheKey] = inner;
            }
            if (inner) inner.style.transform = `translateX(-${scrollLeft}px)`;
        });
    };

    // 表の展開/折りたたみ (hideEmptyRows) で全行の高さ・Y が変わると、scrollTop 数値は
    // 保持されても指す時刻がズレて画面が飛ぶ。直前に見ていた中央の時刻を新しい配置で
    // 計算し直してスクロールを合わせ、アンカーを維持する (desktop/mobile 両トグル経路に有効)。
    const reanchorMountedRef = useRef(false);
    useLayoutEffect(() => {
        if (!reanchorMountedRef.current) { reanchorMountedRef.current = true; return; }
        const c = scrollContainerRef.current;
        const anchor = lastCenterTimeRef.current;
        if (!c || anchor === null) return;
        c.scrollTop = reanchorScrollTop(anchor, timeToYMapRef.current, c.clientHeight);
    }, [hideEmptyRows]);


    useEffect(() => {
        const syncPadding = () => {
            if (scrollContainerRef.current && headerRef.current) {
                const scrollbarWidth = scrollContainerRef.current.offsetWidth - scrollContainerRef.current.clientWidth;
                headerRef.current.style.paddingRight = `${scrollbarWidth}px`;
                if (controlBarRef.current) controlBarRef.current.style.paddingRight = `${scrollbarWidth}px`;
            }
        };

        syncPadding();
        window.addEventListener('resize', syncPadding);
        return () => window.removeEventListener('resize', syncPadding);
    }, []);

    // リキャスト行: スクロールに連動して current time を更新 (GPU 描画、 React 再レンダーなし)
    // セッション 18 案 C1: RecastRow は header (scroll container の外) に物理移動したので、
    // scrollTop はそのまま wrapper 座標系として扱える (recastRowHeight 控除は不要)。
    // 現在のスクロール位置を currentTime に変換し、 RecastRow.update() へ反映する関数。
    // スクロールハンドラと「配置変化時の再同期」 effect の両方から呼ぶため useCallback で共有する。
    const syncRecastRow = useCallback(() => {
        // OFF 時はアイコンを全部隠す (セルは残るので罫線維持)
        if (!recastRowVisible) {
            recastRowRef.current?.hideAll();
            return;
        }
        const container = scrollContainerRef.current;
        if (!container) return;
        const scrollTop = container.scrollTop;
        const offsetTime = showPreStart ? -10 : 0;
        let currentTime: number;
        if (sortedTimeYRef.current.length > 0) {
            // 上端が scrollTop に最も近い行の時刻を逆引き(行の高さが可変でも、空の行を隠す設定でも同じ方法)。
            // Y昇順ソート済み配列(sortedTimeYRef)を二分探索する。以前はtimeToYMapを毎回
            // forEachで全走査しており、戦闘が長い(=行数が多い)ほどスクロール1回ごとの
            // コストが積み重なりメインスレッドを塞いでいた(2026-08-14ユーザー実機報告
            // 「スマホでスクロールが重い/変身アニメがとびとび」の主因)。
            const arr = sortedTimeYRef.current;
            let lo = 0, hi = arr.length - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (arr[mid][1] < scrollTop) lo = mid + 1; else hi = mid;
            }
            let closestIdx = lo;
            if (lo > 0 && Math.abs(arr[lo - 1][1] - scrollTop) <= Math.abs(arr[lo][1] - scrollTop)) {
                closestIdx = lo - 1;
            }
            currentTime = arr[closestIdx][0];
        } else {
            currentTime = offsetTime;
        }
        recastRowRef.current?.update(currentTime);
    }, [showPreStart, recastRowVisible]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        syncRecastRow(); // 初期化
        container.addEventListener('scroll', syncRecastRow, { passive: true });
        return () => container.removeEventListener('scroll', syncRecastRow);
    }, [syncRecastRow]);

    // 配置 (timelineMitigations) が変わったら、 スクロールを待たずに即リキャスト行を再同期する。
    // update() はスクロール時にしか呼ばれないため、 これが無いと「現在のスクロール位置では
    // 本来クロックが出るべき新規配置」 が、 ユーザーが一度スクロールするまで --cd-display:none の
    // まま表示されない (特にターゲットシールド系チャージ技は同じ位置で置いて確認するため顕在化)。
    useEffect(() => {
        syncRecastRow();
    }, [syncRecastRow, timelineMitigations]);

    // スマホのフェーズ名スクラブ表示・エフェクト棒/FAB のスクロール連動(useEffect 4 本もここに含む)
    const { mobilePhaseCurRef, mobilePhaseNextRef, undoRedoWrapRef, syncMobilePhaseLabel } = useTimelineMobileScrollChrome({
        scrollContainerRef, rowLayoutRef, phases, contentLanguage, t, isMobileTimeline,
        mobileEffectBarMode, timelineMitigations, timelineEvents,
    });

    useTimelineAaEscape({ isAaModeEnabled, setIsAaModeEnabled });




    const gridLines = useMemo(() => {
        const lines = [];
        const start = -10;
        const end = fightDuration;
        for (let i = start; i <= end; i++) {
            lines.push(i);
        }
        return lines;
    }, [fightDuration]);

    const eventsByTime = useMemo(() => {
        const targetOrder = { MT: 0, ST: 1 } as const;
        const map = new Map<number, TimelineEvent[]>();
        timelineEvents.forEach(event => {
            const t = event.time;
            if (!map.has(t)) map.set(t, []);
            map.get(t)?.push(event);
        });
        // 同一時刻内: MT → ST → AoE の順を保証
        map.forEach(events => {
            if (events.length > 1) {
                events.sort((a, b) =>
                    (targetOrder[a.target as keyof typeof targetOrder] ?? 2) -
                    (targetOrder[b.target as keyof typeof targetOrder] ?? 2)
                );
            }
        });
        return map;
    }, [timelineEvents]);

    // 行の配置係: 各秒の行の位置と高さ・表全体の高さを 1 か所で決める(縦位置の答えはすべてここから)。
    // 行の高さ = 1 段 × max(1, 攻撃数)。空の行を隠す設定の可視判定もここ(旧: 表全体の高さと描画ループで二重に計算)。
    const forceShowTime0 = useTutorialStore(s => s.isActive && s.getCurrentStep()?.id === 'create-6-add-event');
    const rowLayout = useMemo(() => {
        let maxPopulatedTime = -11;
        if (hideEmptyRows) {
            timelineEvents.forEach(e => { if (e.time > maxPopulatedTime) maxPopulatedTime = e.time; });
            timelineMitigations.forEach(m => { if (m.time > maxPopulatedTime) maxPopulatedTime = m.time; });
        }
        const mitStartTimes = new Set<number>();
        timelineMitigations.forEach(m => { if (!m.autoHidden) mitStartTimes.add(m.time); });
        return computeRowLayout({
            times: gridLines,
            eventCountAt: t => eventsByTime.get(t)?.length ?? 0,
            hasMitigationStartAt: t => mitStartTimes.has(t),
            hideEmptyRows,
            maxPopulatedTime,
            forceVisibleTimes: forceShowTime0 ? new Set([0]) : undefined,
            unitPx: rowUnitPx,
        });
    }, [gridLines, eventsByTime, timelineEvents, timelineMitigations, hideEmptyRows, forceShowTime0, rowUnitPx]);
    // 縦位置を使うコールバック(スクロール同期・ジャンプ・範囲選択・メモ・カーソル)は ref 経由で最新を読む
    rowLayoutRef.current = rowLayout;
    timeToYMapRef.current = rowLayout.timeToY;
    sortedTimeYRef.current = rowLayout.sortedTimeY;

    // 行の位置が変わったら(攻撃の追加・空の行を隠すの切り替えなど)、スクロールを待たずに
    // リキャスト行とスマホのフェーズ表示を今の行の位置で合わせ直す(どちらもふだんはスクロール時にしか更新されない)
    useEffect(() => {
        syncRecastRow();
        syncMobilePhaseLabel();
    }, [rowLayout, syncRecastRow, syncMobilePhaseLabel]);

    const handleAddClick = useCallback((time: number, e: React.MouseEvent) => {
        // 進捗記録モード中はクリックを横取りして到達点を記録（既存の配置/追加には入らない）
        if (useProgressRecording.getState().recordMode) {
            e.stopPropagation();
            e.preventDefault();
            useProgressRecording.getState().commitReachedPos(time);
            return;
        }
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();

        const currentClipboard = useMitigationStore.getState().clipboardEvent;
        if (currentClipboard) {
            const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
            useMitigationStore.getState().addEvent({
                ...currentClipboard,
                id: generateId(),
                time: time
            });
            return;
        }

        if (isAaModeEnabled) {
            // 同じ秒に何件あっても AA を追加する(旧: 2 件あると AA モードを解除してモーダルを開いていた)
            const currentAaSettings = useMitigationStore.getState().aaSettings;
            const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
            useMitigationStore.getState().addEvent({
                id: newId,
                time: time,
                name: { ja: 'AA', en: 'AA' },
                damageAmount: currentAaSettings.damage,
                damageType: currentAaSettings.type,
                target: currentAaSettings.target
            });
            return;
        }

        setEventModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedTime(time);
        setSelectedEvent(null);
        setIsModalOpen(true);
        useTutorialStore.getState().completeEvent('create:event-modal-opened');
    }, [isAaModeEnabled]);

    const handlePhaseAdd = useCallback((time: number, e: React.MouseEvent) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();
        // このtimeがどのフェーズに属するか判定
        const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
        const ownerPhase = sorted.slice().reverse().find(p => p.startTime <= time);
        if (ownerPhase) {
            // 既存フェーズ内クリック → コンテキストメニュー
            setPhasePopover({ phase: ownerPhase, position: { x: e.clientX, y: e.clientY }, clickTime: time });
        } else {
            // フェーズなし → 直接追加モーダル
            setPhaseModalPosition({ x: e.clientX, y: e.clientY });
            setSelectedPhaseTime(time);
            setSelectedPhase(null);
            setIsPhaseModalOpen(true);
        }
    }, [phases]);

    const handlePhaseEdit = (phase: Phase, e: React.MouseEvent) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();
        setPhaseModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedPhase({ id: phase.id, name: phase.name, startTime: phase.startTime, endTime: phase.endTime });
        setIsPhaseModalOpen(true);
    };

    const handlePhaseSave = (name: LocalizedString, startTime?: number, endTime?: number) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (selectedPhase) {
            updatePhase(selectedPhase.id, name);
            if (startTime !== undefined) {
                updatePhaseStartTime(selectedPhase.id, startTime);
            }
            if (endTime !== undefined) {
                updatePhaseEndTime(selectedPhase.id, endTime);
            }
        } else {
            if (selectedPhaseTime !== undefined) {
                addPhase(selectedPhaseTime, name);
            }
        }
    };

    const handlePhaseDelete = () => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (selectedPhase) {
            removePhase(selectedPhase.id);
            setIsPhaseModalOpen(false);
        }
    };

    // ラベル追加・編集・削除
    const handleLabelAdd = useCallback((time: number, e: React.MouseEvent) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();
        const sorted = [...labels].sort((a, b) => a.startTime - b.startTime);
        const ownerLabel = sorted.slice().reverse().find(l => l.startTime <= time);
        if (ownerLabel) {
            setLabelPopover({ label: ownerLabel, position: { x: e.clientX, y: e.clientY }, clickTime: time });
        } else {
            setLabelModalPosition({ x: e.clientX, y: e.clientY });
            setSelectedLabelTime(time);
            setSelectedLabel(null);
            setIsLabelModalOpen(true);
        }
    }, [labels]);

    const handleLabelEdit = (label: Label, e: React.MouseEvent) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();
        setLabelModalPosition({ x: e.clientX, y: e.clientY });
        setSelectedLabel({ id: label.id, name: label.name, startTime: label.startTime, endTime: label.endTime });
        setIsLabelModalOpen(true);
    };

    const handleLabelSave = (name: LocalizedString, startTime?: number, endTime?: number) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (selectedLabel) {
            updateLabel(selectedLabel.id, name);
            if (startTime !== undefined) {
                updateLabelStartTime(selectedLabel.id, startTime);
            }
            if (endTime !== undefined) {
                updateLabelEndTime(selectedLabel.id, endTime);
            }
        } else {
            if (selectedLabelTime !== undefined) {
                addLabel(selectedLabelTime, name);
            }
        }
    };

    const handleLabelDelete = () => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (selectedLabel) {
            removeLabel(selectedLabel.id);
            setIsLabelModalOpen(false);
        }
    };

    const handleEventClick = useCallback((event: TimelineEvent, e: React.MouseEvent) => {
        e.stopPropagation();

        if (isAaModeEnabled) {
            setIsAaModeEnabled(false);
        }

        setEventPopover({ event, position: { x: e.clientX, y: e.clientY } });
    }, [isAaModeEnabled]);

    const handlePopoverEdit = () => {
        if (!eventPopover) return;
        const { event, position } = eventPopover;
        setEventPopover(null);
        setEventModalPosition(position);
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const handlePopoverAdd = () => {
        if (!eventPopover) return;
        const { event, position } = eventPopover;
        setEventPopover(null);
        setEventModalPosition(position);
        setSelectedTime(event.time);
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handlePopoverDelete = () => {
        if (!eventPopover) return;
        const event = eventPopover.event;
        setEventPopover(null);
        setConfirmDialog({
            title: t('timeline.event_delete'),
            message: t('timeline.delete_event_confirm'),
            variant: 'danger',
            onConfirm: () => {
                removeEvent(event.id);
                setConfirmDialog(null);
            },
        });
    };

    const handleSave = (eventData: Omit<TimelineEvent, 'id'>) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        const generateId = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            return 'evt_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        };

        const newId = generateId();

        if (selectedEvent) {
            updateEvent(selectedEvent.id, eventData);
        } else {
            addEvent({
                ...eventData,
                id: newId,
            });
        }
        setIsModalOpen(false);

        setTimeout(() => {
            if (scrollContainerRef.current) {
                const targetY = timeToYMapRef.current.get(eventData.time);
                if (targetY !== undefined) {
                    scrollContainerRef.current.scrollTo({
                        top: targetY,
                        behavior: 'smooth'
                    });
                }
            }
        }, 100);
    };

    const handleDelete = () => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (selectedEvent) {
            setConfirmDialog({
                title: t('timeline.event_delete'),
                message: t('timeline.delete_event_confirm'),
                variant: 'danger',
                onConfirm: () => {
                    removeEvent(selectedEvent.id);
                    setIsModalOpen(false);
                    setConfirmDialog(null);
                },
            });
        }
    };

    const { handleSheetCellTap, handleSheetPopoverPick, handleSheetPopoverClose } = useTimelineSheetTap({
        t, MITIGATIONS, readOnlyRef, sheetToast, setSheetToast, sheetPopover, setSheetPopover,
    });

    const handleCellClick = useCallback((memberId: string, time: number, e: React.MouseEvent) => {
        // 進捗記録モード中はクリックを横取りして到達点を記録（既存の軽減配置には入らない）
        if (useProgressRecording.getState().recordMode) {
            e.stopPropagation();
            e.preventDefault();
            useProgressRecording.getState().commitReachedPos(time);
            return;
        }
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        // メモモード中は軽減配置選択を起動しない (= シート空白クリックでメモ作成に統一)
        if (useMitigationStore.getState().toolMode === 'memo') return;
        const member = useMitigationStore.getState().partyMembers.find(m => m.id === memberId);
        const isTutorial = useTutorialStore.getState().isActive;
        if (!member || (!member.jobId && !isTutorial)) return;

        // スプシ表示: モーダルを開かず、押した列の技をその場に置く / 消す / 弾く / 小窓で相手を選ぶ
        const sheetMap = sheetColumnMapRef.current;
        if (sheetMap) {
            handleSheetCellTap(sheetMap, memberId, time, e);
            return;
        }

        setSelectorPosition({ x: e.clientX, y: e.clientY });
        setSelectedMemberId(memberId);
        setSelectedMitigationTime(time);
        setMitigationSelectorOpen(true);
        // ── Tutorial: セルクリックイベント ──
        useTutorialStore.getState().completeEvent('mitigation:cell-clicked');
    }, [handleSheetCellTap]);

    const handleMobileDamageClick = useCallback((time: number, e: React.MouseEvent) => {
        e.stopPropagation();
        // 他のボトムメニューを閉じてから軽減シートを開く
        setMobilePartyOpen(false);
        setMobileToolsOpen(false);
        setMobileMenuOpen(false);
        setMobileMitiFlow({ isOpen: true, time, step: 'job', selectedMemberId: null, pending: null });
    }, [setMobilePartyOpen, setMobileToolsOpen, setMobileMenuOpen]);

    const handleMobileLongPress = useCallback((event: TimelineEvent | null, time: number) => {
        setMobilePartyOpen(false);
        setMobileToolsOpen(false);
        setMobileMenuOpen(false);
        if (event === null) {
            // 空行の長押し: PC の `+` ボタン相当として直接 EventModal を開く
            setSelectedEvent(null);
            setSelectedTime(time);
            setIsModalOpen(true);
            return;
        }
        setMobileContextMenu({ isOpen: true, event, time });
    }, [setMobilePartyOpen, setMobileToolsOpen, setMobileMenuOpen]);

    // 行(TimelineRow/MobileTimelineRow)の onTimelineSelect / onTimelineSelectHover。
    // PC・スマホで中身が同じなので1組にまとめる(元はレンダー行のループ内でそれぞれ別の
    // インライン関数として毎行・毎レンダー作っていたため、行の memo 比較を素通りできなかった)。
    const handleTimelineSelect = (time: number) => {
        if (labelSelectMode) {
            if (labelSelectMode.field === 'startTime') {
                updateLabelStartTime(labelSelectMode.labelId, time);
            } else {
                updateLabelEndTime(labelSelectMode.labelId, time);
            }
            setLabelSelectMode(null);
            throttledUpdatePreview(null);
            return;
        }
        if (timelineSelectMode) {
            if (timelineSelectMode.field === 'startTime') {
                updatePhaseStartTime(timelineSelectMode.phaseId, time);
            } else {
                updatePhaseEndTime(timelineSelectMode.phaseId, time);
            }
            setTimelineSelectMode(null);
            throttledUpdatePreview(null);
        }
    };
    const handleTimelineSelectHover = (time: number) => {
        if (timelineSelectMode || labelSelectMode) throttledUpdatePreview(time);
    };

    // perf(timeline-row-memo): 行に渡すコールバックは全部 useStableCallback で包み、参照を
    // 固定する。行の memo 比較(rowPropsEqual)が「関数の中身は同じだが参照が違うだけ」で
    // 毎回 false を返し全行描き直しになっていたのを防ぐ。呼び出し自体は if/ループの中ではなく
    // コンポーネント本体のトップレベルに置く(フックのルール)。
    const stableAddClick = useStableCallback(handleAddClick);
    const stablePhaseAdd = useStableCallback(handlePhaseAdd);
    const stableLabelAdd = useStableCallback(handleLabelAdd);
    const stableEventClick = useStableCallback(handleEventClick);
    const stableCellClick = useStableCallback(handleCellClick);
    const stableMobileDamageClick = useStableCallback(handleMobileDamageClick);
    const stableMobileLongPress = useStableCallback(handleMobileLongPress);
    const stableTimelineSelect = useStableCallback(handleTimelineSelect);
    const stableTimelineSelectHover = useStableCallback(handleTimelineSelectHover);

    const handleContextEdit = useCallback(() => {
        if (!mobileContextMenu?.event) return;
        setSelectedEvent(mobileContextMenu.event);
        setSelectedTime(mobileContextMenu.time);
        setIsModalOpen(true);
        setMobileContextMenu(null);
    }, [mobileContextMenu]);

    const handleContextAdd = useCallback(() => {
        if (!mobileContextMenu) return;
        setSelectedEvent(null);
        setSelectedTime(mobileContextMenu.time);
        setIsModalOpen(true);
        setMobileContextMenu(null);
    }, [mobileContextMenu]);

    const handleContextDelete = useCallback(() => {
        if (!mobileContextMenu?.event) return;
        setConfirmDialog({
            title: t('timeline.event_delete'),
            message: t('timeline.delete_event_confirm'),
            variant: 'danger',
            onConfirm: () => {
                removeEvent(mobileContextMenu.event!.id);
                setConfirmDialog(null);
                setMobileContextMenu(null);
            },
        });
    }, [mobileContextMenu, t, removeEvent]);

    // 他のボトムメニューが開いたら軽減追加シートを閉じる
    useEffect(() => {
        const close = () => setMobileMitiFlow(prev => ({ ...prev, isOpen: false }));
        window.addEventListener('mobile:close-miti-flow', close);
        return () => window.removeEventListener('mobile:close-miti-flow', close);
    }, []);

    const handleMitigationSelect = (mitigation: Mitigation & { _targetId?: string; _linkedMitigationId?: string }) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (!selectedMemberId) return;

        addMitigation(buildAppliedMitigation(mitigation, selectedMitigationTime, selectedMemberId, {
            targetId: mitigation._targetId,
            linkedMitigationId: mitigation._linkedMitigationId,
        }));
        setMitigationSelectorOpen(false);

    };

    const handleJobIconClick = (memberId: string, e: React.MouseEvent) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        e.stopPropagation();
        setJobPickerPosition({ x: e.clientX, y: e.clientY });
        setJobPickerMemberId(memberId);
        setJobPickerOpen(true);
    };

    type MigrationMode = 'inherit' | 'common_only' | 'reset';
    const handleJobSelect = (jobId: string) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (jobPickerMemberId) {
            const targetMember = partyMembers.find(m => m.id === jobPickerMemberId);
            if (targetMember) {
                if (targetMember.jobId === jobId) {
                    setJobPickerOpen(false);
                    return;
                }

                const hasMitigations = timelineMitigations.some(m => m.ownerId === targetMember.id);

                if (hasMitigations && targetMember.jobId) {
                    setMigrationConfig({
                        isOpen: true,
                        memberId: targetMember.id,
                        oldJobId: targetMember.jobId,
                        newJobId: jobId
                    });
                    setJobPickerOpen(false);
                    return;
                } else {
                    setMemberJob(targetMember.id, jobId);
                }
            }
        }
        setJobPickerOpen(false);
    };

    const handleMigrationConfirm = (mode: MigrationMode) => {
        if (!migrationConfig) return;

        const { memberId, oldJobId, newJobId } = migrationConfig;

        const memberMitis = timelineMitigations.filter(m => m.ownerId === memberId);
        const newMitis = migrateMitigations(oldJobId, newJobId, memberId, memberMitis, mode);

        changeMemberJobWithMitigations(memberId, newJobId, newMitis);
        setMigrationConfig(null);
    };

    const handleMigrationCancel = () => {
        setMigrationConfig(null);
    };

    const {
        maxTime, conflictingIds, mobileConflictingIds, damageMap, rowSwapMarkers, rowLabels,
        livingDeadTriggers, shieldExhaustedAt, barrierOverwrittenAt,
    } = useTimelineDamage({ timelineEvents, timelineMitigations, partyMembers, phases, eventsByTime, lastPlacedMitigationId });

    const [clearMenuOpen, setClearMenuOpen] = useState(false);
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

    // 注意: sortedPartyMembers は TimelineRow 等で「H1 の maxHp を引く」ような計算にも
    // partyMembers として渡って使われている(表示専用ではない)。表示/非表示スイッチは
    // 見た目だけの絞り込みという確定仕様のため、ここでは絶対にフィルタしない。
    // 非表示メンバーの列描画だけを絞り込みたい箇所は、必ず visiblePartyMembers
    // (この下で定義・hiddenPartyMemberIds を反映した派生リスト)の方を使うこと。
    const sortedPartyMembers = useMemo(() => {
        const order = getSortedPartyMemberIds(partySortOrder);

        return [...partyMembers].sort((a, b) => {
            const indexA = order.indexOf(a.id);
            const indexB = order.indexOf(b.id);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });
    }, [partyMembers, partySortOrder]);

    // 表示/非表示スイッチで隠したメンバーを除いた列描画専用リスト。JobPickerRow/RecastRow など
    // 「メンバーごとに1列描画するだけ」のコンポーネントにのみ渡す(見た目だけへの影響に限定するため)。
    const visiblePartyMembers = useMemo(
        () => sortedPartyMembers.filter((m) => !hiddenPartyMemberIds.includes(m.id)),
        [sortedPartyMembers, hiddenPartyMemberIds]
    );

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

    // DOM 計測ベースの memberLayout (CSS clamp() に追従)
    const [refVersion, setRefVersion] = useState(0);
    const memberHeaderRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

    const setMemberHeaderRef = useCallback((id: string, el: HTMLDivElement | null) => {
        const prev = memberHeaderRefs.current.get(id);
        if (prev !== el) {
            memberHeaderRefs.current.set(id, el);
            setRefVersion(v => v + 1);
        }
    }, []);

    // メンバーごとに安定した ref コールバックをキャッシュ。
    // JSX 内でインライン関数 `(el) => setMemberHeaderRef(id, el)` を書くと
    // 毎レンダーで新インスタンスが生成され React が detach→attach を繰り返し、
    // setRefVersion → 再レンダー → 無限ループを起こす。
    // useRef に id→callback をキャッシュすることで関数参照を安定化する。
    const memberRefCallbacks = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
    const getMemberRefCallback = useCallback((id: string) => {
        if (!memberRefCallbacks.current.has(id)) {
            memberRefCallbacks.current.set(id, (el: HTMLDivElement | null) => setMemberHeaderRef(id, el));
        }
        return memberRefCallbacks.current.get(id)!;
    }, [setMemberHeaderRef]);

    const memberRefEntries = useMemo(
        (): MemberRefEntry[] => sortedPartyMembers.map(m => ({ id: m.id, el: memberHeaderRefs.current.get(m.id) ?? null })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sortedPartyMembers, refVersion],
    );
    const memberLayout = useMeasuredMemberLayout(memberRefEntries);

    // 表示メンバー絞り込みトグル(PartyVisibilityMenu)が出す「更新中」インジケーターを消すタイミング。
    // memberLayout は列の増減(=表示切り替え)による再描画カスケードの最後に更新される値なので、
    // これが確定した = 一連の重い再描画が落ち着いた、とみなせる(2026-08-19実測で確認済み)。
    useEffect(() => {
        useRenderPendingStore.getState().hide();
    }, [memberLayout]);

    // メモ・カーソルの横位置: 保存/送信は常にレーン表示の xRatio。スプシ表示では「読む=レーン→スプシ、書く=スプシ→レーン」に
    // 変換し、同じメンバーの列の中に収める(列の外=左の情報列は両表示で同じなのでそのまま)。
    const [memberStartPx, setMemberStartPx] = useState(0);
    const [scrollViewportW, setScrollViewportW] = useState(0);
    useLayoutEffect(() => {
        if (!isSheetView) return; // レーン表示では不要(余計な再描画を避ける)
        const containerEl = sheetContainerRef.current;
        const firstMemberEl = document.querySelector('[data-member-id]') as HTMLElement | null;
        if (!containerEl || !firstMemberEl) return;
        setMemberStartPx(firstMemberEl.getBoundingClientRect().left - containerEl.getBoundingClientRect().left);
        setScrollViewportW(scrollContainerRef.current?.clientWidth ?? 0);
    }, [memberLayout, isSheetView, sheetWidth, scrollContainerRef]);
    const memberXMap = useMemo(() => {
        if (!isSheetView) {
            return {
                toPx: (r: number) => xRatioToPx(r, sheetWidth),
                toRatio: (px: number) => pxToXRatio(px, sheetWidth),
            };
        }
        const { thW, dpsW, padX } = readLanesColumnVars();
        const lanes = lanesBands(visiblePartyMembers, memberStartPx, thW, dpsW, padX);
        const sheet = sheetBands(visiblePartyMembers, memberLayout);
        const lanesWidth = lanesSheetWidth(scrollViewportW, sheetWidth);
        return {
            toPx: (r: number) => convertMemberX(r * lanesWidth, lanes, sheet),
            toRatio: (px: number) => (lanesWidth > 0 ? convertMemberX(px, sheet, lanes) / lanesWidth : 0),
        };
    }, [isSheetView, visiblePartyMembers, memberStartPx, memberLayout, sheetWidth, scrollViewportW]);
    memberXMapRef.current = memberXMap;

    const { sheetColHover, handleSheetPointerMove, handleSheetPointerLeave } = useTimelineSheetHover({
        sheetContainerRef, sheetColumnMap, visiblePartyMembers, memberLayout,
    });
    // ホバー強調(TableHoverHighlight)が pointermove で読む最新の幾何
    const hoverGeomRef = useRef<HoverGeom>({ mode: 'lanes', bands: [], columnMap: null, layout: EMPTY_ROW_LAYOUT });
    hoverGeomRef.current = {
        mode: isSheetView ? 'sheet' : 'lanes',
        // レーン表示の memberLayout は列の内側(左右の余白 padX を除いた幅)なので、帯は余白ぶん広げてセル全体に合わせる
        bands: isSheetView
            ? sheetBands(visiblePartyMembers, memberLayout)
            : (() => { const padX = readLanesColumnVars().padX; return sheetBands(visiblePartyMembers, memberLayout).map(b => ({ ...b, left: b.left - padX, width: b.width + padX * 2 })); })(),
        columnMap: sheetColumnMap,
        layout: rowLayout,
    };
    // レーン表示は従来どおり rAF 内で最新の sheetWidthRef を読む。スプシ表示だけ列変換。
    const cursorToLocalXRef = useRef(memberXMap.toPx);
    cursorToLocalXRef.current = isSheetView
        ? memberXMap.toPx
        : (r: number) => xRatioToPx(r, sheetWidthRef.current);

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
                    <div
                        ref={controlBarRef}
                        className={clsx(
                            "flex-shrink-0 z-[51] h-7 relative border-b select-none overflow-hidden",
                            "bg-app-surface2 border-app-border",
                            "hidden md:block"
                        )}
                    >
                        <div id="timeline-controls-inner" className="flex items-center gap-0 shrink-0 h-full w-full md:w-max md:min-w-max will-change-transform">
                            {/* MIL-SPEC v11: 操作列(表を展開〜軽減の削除メニュー)は軍事テーマ専用の装甲・スイッチ・キー。
                                標準テーマでは下の従来 JSX をそのまま描く */}
                            {isMilspecTable && (
                                <React.Suspense fallback={null}>
                                    <MilspecControlDeck
                                        hideEmptyRows={hideEmptyRows}
                                        onToggleHideEmpty={() => useMitigationStore.getState().setHideEmptyRows(!useMitigationStore.getState().hideEmptyRows)}
                                        isMemoMode={isMemoMode}
                                        onToggleMemo={() => useMitigationStore.getState().setToolMode(isMemoMode ? 'idle' : 'memo')}
                                        showRowBorders={showRowBorders}
                                        onToggleRowBorders={toggleRowBorders}
                                        pipSupported={pipSupported}
                                        pipActive={!!pipWindow}
                                        pipMenuRef={pipMenuRef}
                                        onPipEnter={openPipMenu}
                                        onPipLeave={scheduleClosePipMenu}
                                        onPipClick={() => { if (pipWindow) handleClosePip(); else openPipMenu(); }}
                                        recastRowVisible={recastRowVisible}
                                        onToggleRecast={handleToggleRecastRowVisible}
                                        isAaModeEnabled={isAaModeEnabled}
                                        onAaClick={() => {
                                            if (isAaModeEnabled) {
                                                setIsAaModeEnabled(false);
                                            } else {
                                                setAaSettingsOpen(!aaSettingsOpen);
                                            }
                                        }}
                                        aaKeyRef={aaSettingsButtonRef}
                                        canUndo={canUndo}
                                        canRedo={canRedo}
                                        readOnly={readOnly}
                                        onUndo={() => useMitigationStore.getState().undo()}
                                        onRedo={() => useMitigationStore.getState().redo()}
                                        onClearClick={() => { if (readOnly) return; setClearMenuOpen(!clearMenuOpen); }}
                                        clearKeyRef={clearMenuButtonRef}
                                    />
                                    <AASettingsPopover
                                        isOpen={aaSettingsOpen}
                                        onClose={() => setAaSettingsOpen(false)}
                                        settings={aaSettings}
                                        onSettingsChange={setAaSettings}
                                        triggerRef={aaSettingsButtonRef}
                                        onStartAdding={() => setIsAaModeEnabled(true)}
                                        isAaActive={isAaModeEnabled}
                                    />
                                    {clearMenuOpen && (
                                        <ClearMitigationsPopover
                                            isOpen={clearMenuOpen}
                                            onClose={() => setClearMenuOpen(false)}
                                            triggerRef={clearMenuButtonRef}
                                            partyMembers={partyMembers}
                                            timelineMitigations={timelineMitigations}
                                            contentLanguage={contentLanguage}
                                            setConfirmDialog={setConfirmDialog}
                                        />
                                    )}
                                </React.Suspense>
                            )}
                            {!isMilspecTable && (
                            <>
                            {/* Area A: PHASE+LABEL+TIME — テーブルカラムと幅を揃える (var(--col-header-chunk-w) - 1px divider) */}
                            <div className="w-[calc(var(--col-header-chunk-w)-1px)] min-w-[calc(var(--col-header-chunk-w)-1px)] flex-none flex items-center px-1 md:px-2 h-full">
                                <button
                                    onClick={() => useMitigationStore.getState().setHideEmptyRows(!useMitigationStore.getState().hideEmptyRows)}
                                    className={clsx(
                                        "flex items-center justify-center gap-2 px-1 md:px-3 py-0.5 my-auto rounded-md text-app-base font-black transition-all duration-300 group/btn cursor-pointer relative overflow-hidden h-6 w-full",
                                        !hideEmptyRows
                                            ? "bg-app-toggle text-app-toggle-text"
                                            : "text-app-text"
                                    )}
                                >
                                    <AlignJustify
                                        size={14}
                                        className="transition-all duration-300 group-hover/btn:scale-110 shrink-0"
                                    />
                                    <span className="uppercase tracking-wider hidden md:block">
                                        {hideEmptyRows ? t('app.fab_expand') : t('app.fab_collapse')}
                                    </span>
                                </button>
                            </div>

                            {/* 短い区切り線 — テーブルの Time|Event 境界と揃う */}
                            <div className="w-[1px] h-3 dark:bg-app-text/25 bg-app-text shrink-0 hidden md:block rounded-full" />

                            {/* Area B: MECHANIC — 敵の攻撃カラムと揃う (var(--col-mechanic-w) - 1px divider)。 AA 追加 + メモを 50/50 で並列配置、 トンマナ統一 */}
                            <div className="flex-1 md:flex-none md:w-[calc(var(--col-mechanic-w)-1px)] md:min-w-[calc(var(--col-mechanic-w)-1px)] flex items-center gap-1 px-1 md:px-2 h-full">
                                {/* AA 追加ボタン (Area B の左半分) */}
                                <div className={clsx(
                                    "flex-1 flex items-center gap-0 relative rounded-md transition-all duration-300 overflow-hidden h-6 min-w-0",
                                    isAaModeEnabled && "bg-app-toggle text-app-toggle-text"
                                )}>
                                    <button
                                        ref={aaSettingsButtonRef}
                                        onClick={() => {
                                            if (isAaModeEnabled) {
                                                setIsAaModeEnabled(false);
                                            } else {
                                                setAaSettingsOpen(!aaSettingsOpen);
                                            }
                                        }}
                                        className={clsx(
                                            "flex-1 flex items-center justify-center gap-2 px-2 md:px-3 h-full transition-all duration-300 group/btn cursor-pointer min-w-0",
                                            isAaModeEnabled
                                                ? "text-app-bg"
                                                : "text-app-text"
                                        )}
                                    >
                                        <Sword size={14} className="transition-transform duration-300 group-hover/btn:scale-110 shrink-0" />
                                        <span className="font-black text-app-base uppercase tracking-wider hidden md:block truncate">{t('aa_settings.title')}</span>
                                    </button>
                                </div>
                                <AASettingsPopover
                                    isOpen={aaSettingsOpen}
                                    onClose={() => setAaSettingsOpen(false)}
                                    settings={aaSettings}
                                    onSettingsChange={setAaSettings}
                                    triggerRef={aaSettingsButtonRef}
                                    onStartAdding={() => setIsAaModeEnabled(true)}
                                    isAaActive={isAaModeEnabled}
                                />
                                {/* AA とメモの間の短い区切り線 (= Area A/B 境界の divider と同パターン) */}
                                <div className="w-[1px] h-3 dark:bg-app-text/25 bg-app-text shrink-0 hidden md:block rounded-full" />
                                {/* メモモード切替 (Area B の右半分、 AA と完全同じ構造: 外側 div > Tooltip > button)。
                                    外側 div は AA と同形 (h-6 で白い箱の高さ固定)。 Tooltip は button だけをラップし、
                                    default の w-fit/h-fit を最小限の !w-full !h-full で打ち消す。 */}
                                <div className={clsx(
                                    "flex-1 hidden md:flex items-center gap-0 relative rounded-md transition-all duration-300 overflow-hidden h-6 min-w-0",
                                    isMemoMode && "bg-app-toggle text-app-toggle-text"
                                )}>
                                    <Tooltip
                                        content={t('memo.mode_toggle_tooltip')}
                                        wrapperClassName="!w-full !h-full"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                useMitigationStore.getState().setToolMode(isMemoMode ? 'idle' : 'memo');
                                            }}
                                            className={clsx(
                                                "flex flex-1 items-center justify-center gap-2 px-2 md:px-3 h-full w-full transition-all duration-300 group/btn cursor-pointer min-w-0",
                                                isMemoMode ? "text-app-bg" : "text-app-text"
                                            )}
                                        >
                                            <Pencil size={14} className="transition-transform duration-300 group-hover/btn:scale-110 shrink-0" />
                                            <span className="font-black text-app-base uppercase tracking-wider hidden md:block truncate">{t('memo.mode_toggle_label')}</span>
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>

                            {/* 短い区切り線 — テーブルの Event|U.Dmg 境界と揃う */}
                            <div className="w-[1px] h-3 dark:bg-app-text/25 bg-app-text shrink-0 hidden md:block rounded-full" />

                            {/* Area C: U.Dmg — 罫線トグル + PiP (var(--col-counter-w) - 1px divider) */}
                            <div className="flex-none md:w-[calc(var(--col-counter-w)-1px)] md:min-w-[calc(var(--col-counter-w)-1px)] flex items-center justify-center gap-1 h-full">
                                <Tooltip content={t('timeline.row_borders')}>
                                    <button
                                        onClick={toggleRowBorders}
                                        className={clsx(
                                            "p-1 rounded transition-all duration-150 cursor-pointer",
                                            showRowBorders
                                                ? "text-app-text hover:bg-app-surface2"
                                                : "text-app-text-muted hover:bg-app-surface2"
                                        )}
                                    >
                                        <Rows3 size={12} />
                                    </button>
                                </Tooltip>
                                {/* PiP（カンペ / 動画でタイムライン作成）— ホバーで選択メニュー。本体は body へ portal（ツールバーが overflow-hidden のため） */}
                                {pipSupported && (
                                    <div
                                        className="relative"
                                        ref={pipMenuRef}
                                        onMouseEnter={openPipMenu}
                                        onMouseLeave={scheduleClosePipMenu}
                                    >
                                        <button
                                            onClick={() => { if (pipWindow) handleClosePip(); }}
                                            className={clsx(
                                                "p-1 rounded transition-all duration-150 cursor-pointer",
                                                (pipWindow || pipMenuOpen)
                                                    ? "text-app-blue hover:bg-app-blue/10"
                                                    : "text-app-text-muted hover:bg-app-surface2 hover:text-app-text"
                                            )}
                                        >
                                            <PictureInPicture2 size={12} />
                                        </button>
                                    </div>
                                )}
                                {/* リキャスト行 ON/OFF (セッション 18 案 C1)。スプシ表示では列見出しに置き換わるので出さない */}
                                {!isSheetView && <Tooltip content={recastRowVisible ? t('timeline.recast_row.hide', 'リキャスト非表示') : t('timeline.recast_row.show', 'リキャスト表示')}>
                                    <button
                                        onClick={handleToggleRecastRowVisible}
                                        className={clsx(
                                            "p-1 rounded transition-all duration-150 cursor-pointer",
                                            recastRowVisible
                                                ? "text-app-text hover:bg-app-surface2"
                                                : "text-app-text-muted hover:bg-app-surface2"
                                        )}
                                    >
                                        <Clock size={12} />
                                    </button>
                                </Tooltip>}
                            </div>

                            {/* 短い区切り線 — テーブルの U.Dmg|Dmg 境界と揃う */}
                            <div className="w-[1px] h-3 dark:bg-app-text/25 bg-app-text shrink-0 hidden md:block rounded-full" />

                            {/* Area D: Dmg — Undo/Redo/ゴミ箱 (var(--col-counter-w) - 1px divider) */}
                            <div className="flex-none md:w-[calc(var(--col-counter-w)-1px)] md:min-w-[calc(var(--col-counter-w)-1px)] flex items-center justify-center gap-0.5 h-full">
                                <Tooltip content={t('timeline.undo')}>
                                    <button
                                        onClick={() => useMitigationStore.getState().undo()}
                                        disabled={!canUndo || readOnly}
                                        className={clsx(
                                            "p-1 rounded transition-all duration-150 cursor-pointer",
                                            (canUndo && !readOnly)
                                                ? "text-app-text hover:bg-app-surface2"
                                                : "text-app-text-muted cursor-default"
                                        )}
                                    >
                                        <Undo2 size={12} />
                                    </button>
                                </Tooltip>
                                <Tooltip content={t('timeline.redo')}>
                                    <button
                                        onClick={() => useMitigationStore.getState().redo()}
                                        disabled={!canRedo || readOnly}
                                        className={clsx(
                                            "p-1 rounded transition-all duration-150 cursor-pointer",
                                            (canRedo && !readOnly)
                                                ? "text-app-text hover:bg-app-surface2"
                                                : "text-app-text-muted cursor-default"
                                        )}
                                    >
                                        <Redo2 size={12} />
                                    </button>
                                </Tooltip>
                                <div className="relative">
                                    <Tooltip content={t('timeline.clear_mitigations')}>
                                        <button
                                            ref={clearMenuButtonRef}
                                            onClick={() => { if (readOnly) return; setClearMenuOpen(!clearMenuOpen); }}
                                            className="flex items-center gap-0.5 p-1 rounded transition-all duration-150 cursor-pointer text-app-text hover:bg-app-red-dim hover:text-app-red-hover"
                                        >
                                            <Trash2 size={12} />
                                            <ChevronDown size={7} />
                                        </button>
                                    </Tooltip>
                                    {clearMenuOpen && (
                                        <ClearMitigationsPopover
                                            isOpen={clearMenuOpen}
                                            onClose={() => setClearMenuOpen(false)}
                                            triggerRef={clearMenuButtonRef}
                                            partyMembers={partyMembers}
                                            timelineMitigations={timelineMitigations}
                                            contentLanguage={contentLanguage}
                                            setConfirmDialog={setConfirmDialog}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* 短い区切り線 — テーブルの Dmg|Job列 境界と揃う */}
                            <div className="w-[1px] h-3 dark:bg-app-text/25 bg-app-text shrink-0 hidden md:block rounded-full" />

                            </>
                            )}
                            {/* セッション 18 案 C1 物理移動: ジョブアイコン行を controlBar の右端に */}
                            {isMilspecTable && (
                                <React.Suspense fallback={null}><MilspecJackBoard members={visiblePartyMembers} partySortOrder={partySortOrder} memberLayout={memberLayout} /></React.Suspense>
                            )}
                            <JobPickerRow
                                variant={isMilspecTable ? 'socket' : undefined}
                                partyMembers={visiblePartyMembers}
                                partySortOrder={partySortOrder}
                                getJobIcon={getJobIcon}
                                jobs={JOBS}
                                handleJobIconClick={handleJobIconClick}
                                getMemberRefCallback={getMemberRefCallback}
                                t={t}
                                sheetCols={sheetCols}
                                sheetHidden={sheetHiddenColumns}
                                onOpenSheetHidden={handleOpenSheetHidden}
                            />
                        </div>
                    </div>

                    <div
                        ref={headerRef}
                        className={clsx(
                            "flex-shrink-0 z-50 bg-app-surface2 border-b border-app-border text-app-md font-medium text-app-text uppercase tracking-wider text-center h-10 select-none overflow-hidden",
                            isMobileTimeline && "hidden"
                        )}
                    >
                        <div id="timeline-header-inner" className="flex items-center h-full w-full md:w-max md:min-w-max will-change-transform">
                            {/* モバイル: フェーズなし → ラベルをフェーズ位置に表示 */}
                            {(() => {
                                const hasPhases = phases.length > 0;
                                const mobileLabelInPhaseSlot = !hasPhases && isMobileView;
                                return (
                                    <>
                                        {!phaseColumnCollapsed ? (
                                            <Tooltip content={t('timeline.header_phase_tooltip')}>
                                                <div
                                                    ref={phaseHeaderRef}
                                                    className={`${mobileLabelInPhaseSlot ? 'hidden md:flex' : 'flex'} w-[24px] min-w-[24px] md:w-[var(--col-phase-w)] md:min-w-[var(--col-phase-w)] md:max-w-[var(--col-phase-w)] flex-none border-r border-app-border h-full items-center justify-center text-app-text-muted font-black bg-transparent text-app-xs md:text-app-md md:cursor-pointer md:hover:text-app-text transition-colors`}
                                                    onClick={() => { if (window.innerWidth >= 768) setPhaseDropdownOpen(!phaseDropdownOpen); }}
                                                >
                                                    <span className="md:hidden">{t('timeline.header_phase_short')}</span>
                                                    <span className="hidden md:inline md:items-center md:gap-1">
                                                        {t('timeline.header_phase')}
                                                        <ChevronDown size={12} className="inline ml-0.5" />
                                                    </span>
                                                </div>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip content={`${t('timeline.nav_phase_expand')} (Shift+P)`}>
                                                <div
                                                    ref={phaseHeaderRef}
                                                    className="w-[var(--col-phase-collapsed-w)] min-w-[var(--col-phase-collapsed-w)] max-w-[var(--col-phase-collapsed-w)] flex-none border-r border-app-border h-full hidden md:flex items-center justify-center cursor-pointer hover:bg-app-surface2 transition-colors"
                                                    onClick={() => handleTogglePhaseCollapse()}
                                                >
                                                    <ChevronDown size={12} className="text-app-text-muted -rotate-90" />
                                                </div>
                                            </Tooltip>
                                        )}
                                        {/* モバイル: フェーズなし → ラベルヘッダーをフェーズ位置に */}
                                        {mobileLabelInPhaseSlot && labelColumnVisible && (
                                            <div
                                                ref={gimmickHeaderRef}
                                                className="w-[24px] min-w-[24px] md:hidden flex-none border-r border-app-border h-full flex items-center justify-center text-app-text-muted font-black text-app-xs"
                                                onClick={() => setGimmickDropdownOpen(!gimmickDropdownOpen)}
                                            >
                                                {t('timeline.header_gimmick_short')}
                                            </div>
                                        )}
                                        {/* PC: ラベル列ヘッダー */}
                                        {labelColumnVisible ? (
                                            <Tooltip content={t('timeline.header_gimmick_tooltip')}>
                                                <div
                                                    ref={!mobileLabelInPhaseSlot ? gimmickHeaderRef : undefined}
                                                    className="hidden md:flex w-[var(--col-label-w)] min-w-[var(--col-label-w)] max-w-[var(--col-label-w)] flex-none border-r border-app-border h-full items-center justify-center bg-transparent text-app-text-muted font-black text-app-md cursor-pointer hover:text-app-text transition-colors"
                                                    onClick={() => setGimmickDropdownOpen(!gimmickDropdownOpen)}
                                                >
                                                    <span className="flex items-center gap-0.5">
                                                        {t('timeline.header_gimmick')}
                                                        <ChevronDown size={10} className="inline" />
                                                    </span>
                                                </div>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip content={`${t('timeline.nav_label_expand')} (Shift+L)`}>
                                                <div
                                                    ref={!mobileLabelInPhaseSlot ? gimmickHeaderRef : undefined}
                                                    className="w-[var(--col-label-collapsed-w)] min-w-[var(--col-label-collapsed-w)] max-w-[var(--col-label-collapsed-w)] flex-none border-r border-app-border h-full hidden md:flex items-center justify-center cursor-pointer hover:bg-app-surface2 transition-colors"
                                                    onClick={() => handleToggleLabelCollapse()}
                                                >
                                                    <ChevronDown size={12} className="text-app-text-muted -rotate-90" />
                                                </div>
                                            </Tooltip>
                                        )}
                                    </>
                                );
                            })()}
                            <Tooltip content={t('timeline.header_time_tooltip')}>
                                <div
                                    ref={timeHeaderRef}
                                    className="w-[36px] min-w-[36px] md:w-[var(--col-time-w)] md:min-w-[var(--col-time-w)] md:max-w-[var(--col-time-w)] flex-none border-r border-app-border h-full flex items-center justify-center bg-transparent text-app-text-muted font-black text-app-xs md:text-app-base md:cursor-pointer md:hover:text-app-text transition-colors"
                                    onClick={() => { if (window.innerWidth >= 768) setTimeInputOpen(!timeInputOpen); }}
                                >
                                    <span className="md:hidden">{t('timeline.header_time')}</span>
                                    <span className="hidden md:inline md:items-center md:gap-0.5">
                                        {t('timeline.header_time')}
                                        <ChevronDown size={10} className="inline ml-0.5" />
                                    </span>
                                </div>
                            </Tooltip>
                            <Tooltip content={t('timeline.header_mechanic_tooltip')} wrapperClassName="flex-1 md:flex-none md:w-[var(--col-mechanic-w)] md:min-w-[var(--col-mechanic-w)] md:max-w-[var(--col-mechanic-w)] h-full">
                                <div
                                    ref={mechanicHeaderRef}
                                    className="w-full border-r border-app-border h-full flex items-center bg-transparent text-app-text-muted text-app-sm md:text-app-base pl-2 justify-start font-black cursor-pointer hover:text-app-text transition-colors"
                                    onClick={() => setMechanicSearchOpen(!mechanicSearchOpen)}
                                >
                                    <span className="flex items-center gap-0.5 md:gap-1">
                                        {t('timeline.header_mechanic')}
                                        <ChevronDown size={10} className="inline" />
                                    </span>
                                </div>
                            </Tooltip>
                            <div className="w-[var(--col-counter-w)] min-w-[var(--col-counter-w)] md:max-w-[var(--col-counter-w)] flex-none border-r border-app-border h-full flex items-center justify-center bg-transparent text-app-text-muted text-app-xs md:text-app-base font-black">
                                <span className="md:hidden">{t('timeline.header_raw_short')}</span>
                                <span className="hidden md:inline">{t('timeline.header_raw')}</span>
                            </div>
                            <div className="w-[var(--col-counter-w)] min-w-[var(--col-counter-w)] md:max-w-[var(--col-counter-w)] flex-none border-r border-app-border h-full flex items-center justify-center bg-transparent text-app-text-muted text-app-xs md:text-app-base font-black">
                                <span className="md:hidden">{t('timeline.header_taken_short')}</span>
                                <span className="hidden md:inline">{t('timeline.header_taken')}</span>
                            </div>
                            {/* セッション 18 案 C1: ヘッダーのメンバー列領域はリキャストアイコン専用に。
                                旧ジョブアイコン行は controlBar に移動 (JobPickerRow)。
                                OFF 時もセルは render する (= 罫線は維持)。 中のアイコンだけ scroll handler で hideAll。
                                軍事の表だけ renderIdle で「アイコンが 1 つも出ていない列」にロール色の線 + ジョブ略号を描く
                                (出し分けは RecastRow が data-recast-active に直書き + CSS)。 */}
                            {sheetColumnMap ? (
                                <SheetColumnHeader
                                    members={visiblePartyMembers}
                                    sheetColumnMap={sheetColumnMap}
                                    onHideColumn={handleHideSheetColumn}
                                />
                            ) : (
                                <RecastRow
                                    ref={recastRowRef}
                                    partyMembers={visiblePartyMembers}
                                    placements={timelineMitigations}
                                    mitigationDefs={MITIGATIONS}
                                    renderIdle={isMilspecTable ? renderMilspecIdle : undefined}
                                />
                            )}
                        </div>
                    </div>

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
                                const renderItems: React.ReactElement[] = [];

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

                                rowLayout.rows.forEach(({ time, top, height, visible }) => {
                                    if (!visible) return;
                                    const rowEvents = eventsByTime.get(time) || [];
                                    const rowDamages = rowEvents.map(event => damageMap.get(event.id) || null);
                                    const activeMitigationsForRow = mitigationsByTime.get(time) || [];

                                    if (isMobileTimeline) {
                                        // Mobile: MobileTimelineRow を使用
                                        // 攻撃 1 つにつきカード 1 枚(攻撃なしは 1 枚)。行の高さ = 1 段 × 枚数。
                                        // 同じ秒のカードの間には区切り線を引かない(最後のカードだけ下に線)。
                                        const cardCount = Math.max(1, rowEvents.length);
                                        for (let i = 0; i < cardCount; i++) {
                                            renderItems.push(
                                                <MobileTimelineRow
                                                    key={`${time}-${i}`}
                                                    time={time}
                                                    top={top + i * rowLayout.unitPx}
                                                    damages={rowDamages}
                                                    events={rowEvents}
                                                    partyMembers={sortedPartyMembers}
                                                    hiddenPartyMemberIds={hiddenPartyMemberIds}
                                                    activeMitigations={activeMitigationsForRow}
                                                    onMobileDamageClick={stableMobileDamageClick}
                                                    onLongPress={stableMobileLongPress}
                                                    phaseColumnCollapsed={phaseColumnCollapsed}
                                                    hasPhases={phases.length > 0}
                                                    timelineSelectMode={timelineSelectMode}
                                                    labelSelectMode={labelSelectMode}
                                                    onTimelineSelect={stableTimelineSelect}
                                                    onTimelineSelectHover={stableTimelineSelectHover}
                                                    eventIndex={i}
                                                    hideBottomDivider={i < cardCount - 1}
                                                    rowHeight={rowLayout.unitPx}
                                                    maxMitiIcons={maxMitiIconsPerRow}
                                                    conflictingIds={mobileConflictingIds}
                                                    swapMarkers={rowSwapMarkers}
                                                    phases={phases}
                                                />
                                            );
                                        }
                                    } else {
                                        // PC: TimelineRow (body 行)。高さ = 1 段 × max(1, 攻撃数)
                                        renderItems.push(
                                            <TimelineRow
                                                key={time}
                                                time={time}
                                                top={top}
                                                height={height}
                                                damages={rowDamages}
                                                events={rowEvents}
                                                partyMembers={sortedPartyMembers}
                                                visiblePartyMembers={visiblePartyMembers}
                                                activeMitigations={activeMitigationsForRow}
                                                onPhaseAdd={stablePhaseAdd}
                                                onLabelAdd={stableLabelAdd}
                                                hasPhases={phases.length > 0}
                                                onAddEventClick={stableAddClick}
                                                onEventClick={stableEventClick}
                                                onCellClick={stableCellClick}
                                                onMobileDamageClick={stableMobileDamageClick}
                                                phaseColumnCollapsed={phaseColumnCollapsed}
                                                labelColumnVisible={labelColumnVisible}
                                                timelineSelectMode={timelineSelectMode}
                                                labelSelectMode={labelSelectMode}
                                                onTimelineSelect={stableTimelineSelect}
                                                onTimelineSelectHover={stableTimelineSelectHover}
                                                showRowBorders={showRowBorders}
                                                sheetCols={sheetCols}
                                                swapMarkers={rowSwapMarkers}
                                                phases={phases}
                                                labels={rowLabels}
                                            />
                                        );
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
                                        {renderItems}

                                        {/* ホバー強調(1 個だけ・pointermove で動かす)。軽減アイコン・帯(後ろの兄弟)より奥 */}
                                        {!isMobileTimeline && <TableHoverHighlight containerRef={sheetContainerRef} geomRef={hoverGeomRef} />}


                                        {/* フェーズオーバーレイ (PC のみ。モバイルはヘッダー直下の固定ラベルに一本化) */}
                                        {!isMobileTimeline && !phaseColumnCollapsed && (() => {
                                            const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
                                            return sorted.map((phase, index) => {
                                            const offsetTime = showPreStart ? -10 : 0;
                                            const startTime = phase.startTime;
                                            // endTimeは「その行を含む」（inclusive）→ 描画時は+1して次行の先頭まで伸ばす
                                            const endTime = phase.endTime + 1;

                                            if (!showPreStart && endTime <= 0) return null;
                                            // フェーズ名が空ならオーバーレイ全体を描画しない
                                            if (!getPhaseName(phase.name, contentLanguage)) return null;

                                            const effectiveStartTime = Math.max(startTime, offsetTime);
                                            const effectiveEndTime = Math.max(endTime, offsetTime);

                                            const startY = rowLayout.topOf(effectiveStartTime);
                                            const top = startY;
                                            const height = Math.max(0, rowLayout.topOf(effectiveEndTime) - startY);

                                            return (
                                                <div
                                                    key={phase.id}
                                                    data-phase-overlay
                                                    className="absolute left-0 w-[24px] md:w-[var(--col-phase-w)] border-r border-b border-app-border bg-app-surface2 pointer-events-none z-10"
                                                    style={{ top: `${top}px`, height: `${height}px` }}
                                                >
                                                    <Tooltip content={t('timeline.click_rename', 'クリックして名前を変更')} position="right" wrapperClassName={clsx("sticky w-full", isMobileView ? "top-[52px]" : "top-0")}>
                                                        <div className="w-full h-[100px] md:h-[150px] flex items-center justify-center pt-6 md:pt-6">
                                                            <div className="transform -rotate-90 overflow-visible px-2 drop-shadow-md origin-center flex flex-col items-center gap-0.5">
                                                                <span className="hidden md:block whitespace-nowrap text-app-xl font-bold text-app-text leading-none">
                                                                    {t('timeline.phase_prefix', { index: index + 1 })}
                                                                </span>
                                                                {getPhaseName(phase.name, contentLanguage) !== t('timeline.phase_prefix', { index: index + 1 }) && (
                                                                    <span className="hidden md:block whitespace-nowrap text-app-sm font-medium text-app-text/70 leading-none">
                                                                        {getPhaseName(phase.name, contentLanguage)}
                                                                    </span>
                                                                )}
                                                                <span className="md:hidden whitespace-nowrap text-app-base font-bold text-app-text leading-none">
                                                                    {getPhaseName(phase.name, contentLanguage)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </Tooltip>
                                                </div>
                                            );
                                        });
                                        })()}

                                        {/* ラベル区間オーバーレイ（PC only） */}
                                        {labelColumnVisible && labels.length > 0 && (() => {
                                            const offsetTime = showPreStart ? -10 : 0;
                                            const sortedLabels = [...labels].sort((a, b) => a.startTime - b.startTime);

                                            return sortedLabels.map((label) => {
                                                // endTimeは inclusive → 描画時は+1
                                                const effectiveEndTime = label.endTime + 1;

                                                const effectiveStart = Math.max(label.startTime, offsetTime);
                                                const effectiveEnd = Math.max(effectiveEndTime, offsetTime);
                                                if (!showPreStart && effectiveEnd <= 0) return null;

                                                const startY = rowLayout.topOf(effectiveStart);
                                                const endY = rowLayout.topOf(effectiveEnd);
                                                const top = startY;
                                                const height = Math.max(0, endY - startY);
                                                if (height <= 0) return null;

                                                const displayName = getPhaseName(label.name, contentLanguage);
                                                const hasPhases = phases.length > 0;

                                                return (
                                                    <div
                                                        key={`label-${label.id}`}
                                                        data-label-overlay
                                                        className={clsx(
                                                            "absolute border-r border-b border-app-border/50 bg-app-surface2 pointer-events-none z-10",
                                                            hasPhases
                                                                ? `hidden md:block ${phaseColumnCollapsed ? 'left-[var(--col-phase-collapsed-w)]' : 'left-[var(--col-phase-w)]'} w-[var(--col-label-w)]`
                                                                : `left-0 w-[24px] ${phaseColumnCollapsed ? 'md:left-[var(--col-phase-collapsed-w)]' : 'md:left-[var(--col-phase-w)]'} md:w-[var(--col-label-w)]`
                                                        )}
                                                        style={{ top: `${top}px`, height: `${height}px` }}
                                                    >
                                                        <div className="sticky top-0 w-full h-[100px] flex items-center justify-center pt-4">
                                                            <div className="transform -rotate-90 overflow-visible drop-shadow-sm origin-center">
                                                                <span className={clsx(
                                                                    "whitespace-nowrap font-medium text-app-text leading-none",
                                                                    hasPhases ? "text-app-base" : "text-app-xs md:text-app-base"
                                                                )}>
                                                                    {displayName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}

                                        {/* TL選択モード ハイライトオーバーレイ */}
                                        <div
                                            ref={overlayRef}
                                            className={clsx(
                                                "absolute pointer-events-none z-20 border-2 border-app-blue bg-app-blue/10 rounded-sm",
                                                labelSelectMode
                                                    ? (phases.length > 0
                                                        ? `hidden md:block ${phaseColumnCollapsed ? 'left-[var(--col-phase-collapsed-w)]' : 'left-[var(--col-phase-w)]'} w-[var(--col-label-w)]`
                                                        : `left-0 w-[24px] ${phaseColumnCollapsed ? 'md:left-[var(--col-phase-collapsed-w)]' : 'md:left-[var(--col-phase-w)]'} md:w-[var(--col-label-w)]`)
                                                    : `left-0 w-[24px] ${phaseColumnCollapsed ? 'md:w-[var(--col-phase-collapsed-w)]' : 'md:w-[var(--col-phase-w)]'}`
                                            )}
                                            style={{ display: 'none' }}
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