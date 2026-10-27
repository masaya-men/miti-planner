import React from 'react';
import clsx from 'clsx';
import type { TFunction } from 'i18next';
import {
    Pencil, Trash2, Undo2, Redo2, AlignJustify, Sword, ChevronDown, Rows3, PictureInPicture2, Clock
} from 'lucide-react';
import type { Job, PartyMember, AppliedMitigation } from '../../types';
import { useMitigationStore } from '../../store/useMitigationStore';
import type { AASettings } from '../../store/useMitigationStore';
import { Tooltip } from '../ui/Tooltip';
import { AASettingsPopover } from '../AASettingsPopover';
import { ClearMitigationsPopover } from '../ClearMitigationsPopover';
import { JobPickerRow } from '../JobPickerRow';
import type { SheetColumn } from './sheet/sheetColumns';
import type { useTimelineMemberXMap } from './useTimelineLayout';

const MilspecControlDeck = React.lazy(() => import('../military/table/MilspecControlDeck').then(m => ({ default: m.MilspecControlDeck })));
const MilspecJackBoard = React.lazy(() => import('../military/table/MilspecJackBoard').then(m => ({ default: m.MilspecJackBoard })));

interface TimelineControlBarProps {
    controlBarRef: React.RefObject<HTMLDivElement | null>;
    t: TFunction;
    isMilspecTable: boolean;
    isSheetView: boolean;
    readOnly: boolean;
    contentLanguage: string;
    hideEmptyRows: boolean;
    isMemoMode: boolean;
    showRowBorders: boolean;
    toggleRowBorders: () => void;
    pipSupported: boolean;
    pipWindow: Window | null;
    pipMenuOpen: boolean;
    pipMenuRef: React.RefObject<HTMLDivElement | null>;
    openPipMenu: () => void;
    scheduleClosePipMenu: () => void;
    handleClosePip: () => void;
    recastRowVisible: boolean;
    handleToggleRecastRowVisible: () => void;
    isAaModeEnabled: boolean;
    setIsAaModeEnabled: (v: boolean) => void;
    aaSettingsOpen: boolean;
    setAaSettingsOpen: (v: boolean) => void;
    aaSettingsButtonRef: React.RefObject<HTMLButtonElement | null>;
    aaSettings: AASettings;
    setAaSettings: (settings: AASettings) => void;
    canUndo: boolean;
    canRedo: boolean;
    clearMenuOpen: boolean;
    setClearMenuOpen: (v: boolean) => void;
    clearMenuButtonRef: React.RefObject<HTMLButtonElement | null>;
    partyMembers: PartyMember[];
    timelineMitigations: AppliedMitigation[];
    setConfirmDialog: (dialog: any) => void;
    visiblePartyMembers: PartyMember[];
    partySortOrder: 'role' | 'light_party';
    memberLayout: ReturnType<typeof useTimelineMemberXMap>['memberLayout'];
    getJobIcon: (jobId: string | null) => string | null;
    JOBS: Job[];
    handleJobIconClick: (memberId: string, e: React.MouseEvent) => void;
    getMemberRefCallback: (id: string) => (el: HTMLDivElement | null) => void;
    sheetCols: ReadonlyMap<string, number> | undefined;
    sheetHiddenColumns: ReadonlyMap<string, SheetColumn[]> | undefined;
    handleOpenSheetHidden: (memberId: string, e: React.MouseEvent) => void;
}

/** 操作バー(MIL-SPEC デッキ / 標準の A〜D エリア + ジョブ選択行)。Timeline から移したもの。 */
export const TimelineControlBar: React.FC<TimelineControlBarProps> = ({
    controlBarRef, t, isMilspecTable, isSheetView, readOnly, contentLanguage,
    hideEmptyRows, isMemoMode, showRowBorders, toggleRowBorders,
    pipSupported, pipWindow, pipMenuOpen, pipMenuRef, openPipMenu, scheduleClosePipMenu, handleClosePip,
    recastRowVisible, handleToggleRecastRowVisible,
    isAaModeEnabled, setIsAaModeEnabled, aaSettingsOpen, setAaSettingsOpen, aaSettingsButtonRef, aaSettings, setAaSettings,
    canUndo, canRedo, clearMenuOpen, setClearMenuOpen, clearMenuButtonRef,
    partyMembers, timelineMitigations, setConfirmDialog,
    visiblePartyMembers, partySortOrder, memberLayout, getJobIcon, JOBS, handleJobIconClick, getMemberRefCallback,
    sheetCols, sheetHiddenColumns, handleOpenSheetHidden,
}) => {
    return (
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
    );
};
