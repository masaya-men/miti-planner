import React from 'react';
import clsx from 'clsx';
import type { TFunction } from 'i18next';
import { ChevronDown } from 'lucide-react';
import type { PartyMember, AppliedMitigation } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import { RecastRow, type RecastRowHandle } from '../RecastRow';
import { SheetColumnHeader } from './sheet/SheetColumnHeader';
import type { SheetColumn } from './sheet/sheetColumns';
import type { useMitigations } from '../../hooks/useSkillsData';
import { matchesMobile } from '../../hooks/useIsMobile';

interface TimelineHeaderProps {
    headerRef: React.RefObject<HTMLDivElement | null>;
    t: TFunction;
    isMobileTimeline: boolean;
    isMobileView: boolean;
    isMilspecTable: boolean;
    phases: unknown[];
    phaseColumnCollapsed: boolean;
    labelColumnVisible: boolean;
    phaseHeaderRef: React.RefObject<HTMLDivElement | null>;
    gimmickHeaderRef: React.RefObject<HTMLDivElement | null>;
    timeHeaderRef: React.RefObject<HTMLDivElement | null>;
    mechanicHeaderRef: React.RefObject<HTMLDivElement | null>;
    recastRowRef: React.RefObject<RecastRowHandle | null>;
    phaseDropdownOpen: boolean;
    setPhaseDropdownOpen: (v: boolean) => void;
    gimmickDropdownOpen: boolean;
    setGimmickDropdownOpen: (v: boolean) => void;
    timeInputOpen: boolean;
    setTimeInputOpen: (v: boolean) => void;
    mechanicSearchOpen: boolean;
    setMechanicSearchOpen: (v: boolean) => void;
    handleTogglePhaseCollapse: () => void;
    handleToggleLabelCollapse: () => void;
    sheetColumnMap: ReadonlyMap<string, SheetColumn[]> | null;
    visiblePartyMembers: PartyMember[];
    handleHideSheetColumn: (mitigationId: string) => void;
    timelineMitigations: AppliedMitigation[];
    MITIGATIONS: ReturnType<typeof useMitigations>;
    renderMilspecIdle: (m: PartyMember) => React.ReactNode;
}

/** 見出し行(フェーズ/ラベル/時間/攻撃名の列見出し + リキャスト行 or スプシ列見出し)。Timeline から移したもの。 */
export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
    headerRef, t, isMobileTimeline, isMobileView, isMilspecTable, phases, phaseColumnCollapsed, labelColumnVisible,
    phaseHeaderRef, gimmickHeaderRef, timeHeaderRef, mechanicHeaderRef, recastRowRef,
    phaseDropdownOpen, setPhaseDropdownOpen, gimmickDropdownOpen, setGimmickDropdownOpen,
    timeInputOpen, setTimeInputOpen, mechanicSearchOpen, setMechanicSearchOpen,
    handleTogglePhaseCollapse, handleToggleLabelCollapse,
    sheetColumnMap, visiblePartyMembers, handleHideSheetColumn, timelineMitigations, MITIGATIONS, renderMilspecIdle,
}) => {
    return (
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
                                    onClick={() => { if (!matchesMobile(window)) setPhaseDropdownOpen(!phaseDropdownOpen); }}
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
                    onClick={() => { if (!matchesMobile(window)) setTimeInputOpen(!timeInputOpen); }}
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
    );
};
