import React, { memo } from 'react';
import clsx from 'clsx';
import type { PartyMember, TimelineEvent, AppliedMitigation } from '../types';
import { getColumnCssVar } from '../utils/calculator';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';
import { TimelineInfoColumns } from './TimelineInfoColumns';
import type { DamageInfo } from './TimelineInfoColumns';

// PcTypeToggle は TimelineInfoColumns.tsx へ移設済み。テスト（PcTypeToggle.test.tsx）が
// 従来どおり '../TimelineRow' から import できるよう、この 1 つだけ re-export する。
export { PcTypeToggle } from './TimelineInfoColumns';

interface TimelineRowProps {
    time: number;
    top: number;
    damages: (DamageInfo | null)[];
    events: TimelineEvent[];
    partyMembers: PartyMember[];
    activeMitigations: AppliedMitigation[];
    onPhaseAdd: (time: number, e: React.MouseEvent) => void;
    onAddEventClick: (time: number, e: React.MouseEvent) => void;
    onEventClick: (event: TimelineEvent, e: React.MouseEvent) => void;
    onCellClick: (memberId: string, time: number, e: React.MouseEvent) => void;
    onMobileDamageClick?: (time: number, e: React.MouseEvent) => void;
    onLabelAdd?: (time: number, e: React.MouseEvent) => void;
    phaseColumnCollapsed?: boolean;
    labelColumnVisible?: boolean;
    hasPhases?: boolean;
    timelineSelectMode?: { phaseId: string; startTime: number } | null;
    labelSelectMode?: { labelId: string; startTime: number } | null;
    onTimelineSelect?: (time: number) => void;
    onTimelineSelectHover?: (time: number) => void;
    showRowBorders?: boolean;
}

export const TimelineRow = memo(({
    time,
    top,
    damages,
    events,
    partyMembers,
    activeMitigations,
    onPhaseAdd,
    onAddEventClick,
    onEventClick,
    onCellClick,
    onMobileDamageClick,
    onLabelAdd,
    phaseColumnCollapsed,
    labelColumnVisible,
    hasPhases = true,
    timelineSelectMode,
    labelSelectMode,
    onTimelineSelect,
    onTimelineSelectHover,
    showRowBorders = false,
}: TimelineRowProps) => {
    const { t } = useTranslation();
    return (
        <div
            data-time-row={time}
            className={clsx(
                "absolute left-0 w-full md:w-fit flex h-[50px] group  duration-75",
                "hover:bg-app-surface2",
                // perf #59: ビューポート外行を style/layout/paint からスキップ。 行 height は h-[50px] と一致
                "[content-visibility:auto] [contain-intrinsic-size:auto_50px]",
                showRowBorders && "border-b border-app-border",
                (timelineSelectMode || labelSelectMode) && "cursor-pointer"
            )}
            style={{
                top: `${top}px`,
                // hover line の left/width は CSS 変数 (viewport 連動 clamp) ベースで計算する。
                // 旧実装は開発者画面 (1489) の max 値をハードコード (60+200+100+100=460px) して
                // いたため、 1489 未満の viewport では実セル幅 < 460px となり罫線が右にはみ出していた。
                // left = phase 列 + label 列 (collapsed/visible で切替)。 width = time + mechanic + counter ×2。
                '--hover-line-left': `calc(${phaseColumnCollapsed ? 'var(--col-phase-collapsed-w)' : 'var(--col-phase-w)'} + ${labelColumnVisible ? 'var(--col-label-w)' : 'var(--col-label-collapsed-w)'})`,
                '--hover-line-width': 'calc(var(--col-time-w) + var(--col-mechanic-w) + var(--col-counter-w) * 2)',
            } as React.CSSProperties}
            onMouseEnter={() => {
                if (timelineSelectMode || labelSelectMode) {
                    onTimelineSelectHover?.(time);
                }
            }}
            onClick={(e) => {
                if (timelineSelectMode || labelSelectMode) {
                    onTimelineSelect?.(time);
                    e.stopPropagation();
                }
            }}
        >
            <TimelineInfoColumns
                time={time}
                events={events}
                damages={damages}
                partyMembers={partyMembers}
                activeMitigations={activeMitigations}
                phaseColumnCollapsed={phaseColumnCollapsed}
                labelColumnVisible={labelColumnVisible}
                hasPhases={hasPhases}
                showRowBorders={showRowBorders}
                timelineSelectMode={timelineSelectMode}
                labelSelectMode={labelSelectMode}
                onPhaseAdd={onPhaseAdd}
                onLabelAdd={onLabelAdd}
                onAddEventClick={onAddEventClick}
                onEventClick={onEventClick}
                onMobileDamageClick={onMobileDamageClick}
                onTimelineSelect={onTimelineSelect}
                onTimelineSelectHover={onTimelineSelectHover}
            />

            {/* Job Columns Cells — PC専用 */}
            {
                partyMembers.map((member) => (
                    <div
                        key={member.id}
                        data-tutorial={
                            member.id === 'MT' && time === 4 ? 'miti-cell-mt-4' :
                                member.id === 'ST' && time === 4 ? 'miti-cell-st-4' :
                                    member.id === 'ST' && time === 10 ? 'miti-cell-st-10' : undefined
                        }
                        className={clsx(
                            "hidden md:flex h-full items-center justify-center relative group/cell cursor-pointer  border-r",
                            "border-app-border hover:bg-app-surface2"
                        )}
                        style={{ width: getColumnCssVar(member.role), minWidth: getColumnCssVar(member.role), maxWidth: getColumnCssVar(member.role) }}
                        onClick={(e) => onCellClick(member.id, time, e)}
                    >
                        <Tooltip content={t('mitigation.select')} position="top">
                            <div className="w-full h-full" />
                        </Tooltip>
                    </div>
                ))
            }
        </div>
    );
}, (prevProps, nextProps) => {
    if (prevProps.time !== nextProps.time) return false;
    if (prevProps.top !== nextProps.top) return false;
    if (prevProps.events !== nextProps.events) return false;
    if (prevProps.damages !== nextProps.damages) return false;
    if (prevProps.partyMembers !== nextProps.partyMembers) return false;
    if (prevProps.activeMitigations !== nextProps.activeMitigations) {
        if (prevProps.activeMitigations.length !== nextProps.activeMitigations.length) return false;
        for (let i = 0; i < prevProps.activeMitigations.length; i++) {
            if (prevProps.activeMitigations[i] !== nextProps.activeMitigations[i]) return false;
        }
    }
    if (prevProps.phaseColumnCollapsed !== nextProps.phaseColumnCollapsed) return false;
    if (prevProps.labelColumnVisible !== nextProps.labelColumnVisible) return false;
    return true;
});
