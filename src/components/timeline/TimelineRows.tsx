import React from 'react';
import type { AppliedMitigation } from '../../types';
import { TimelineRow } from '../TimelineRow';
import { MobileTimelineRow } from '../MobileTimelineRow';
import type { useTimelineRowLayout, useTimelineSheetWidth, useTimelinePartyOrder } from './useTimelineLayout';
import type { useTimelineDamage } from './useTimelineDamage';
import type { useTimelineMitigationEditing } from './useTimelineMitigationEditing';
import type { useTimelineSheetColumns } from './useTimelineSheetView';

type RowProps = React.ComponentProps<typeof TimelineRow>;
type MobileRowProps = React.ComponentProps<typeof MobileTimelineRow>;
type RowLayoutResult = ReturnType<typeof useTimelineRowLayout>;
type DamageResult = ReturnType<typeof useTimelineDamage>;
type EditingResult = ReturnType<typeof useTimelineMitigationEditing>;
type PartyOrderResult = ReturnType<typeof useTimelinePartyOrder>;

interface TimelineRowsProps {
    rowLayout: RowLayoutResult['rowLayout'];
    eventsByTime: RowLayoutResult['eventsByTime'];
    damageMap: DamageResult['damageMap'];
    /** 秒ごとの「その秒に効いている軽減」(Timeline が毎描画で組み立てて渡す) */
    mitigationsByTime: Map<number, AppliedMitigation[]>;
    isMobileTimeline: boolean;
    sortedPartyMembers: PartyOrderResult['sortedPartyMembers'];
    visiblePartyMembers: PartyOrderResult['visiblePartyMembers'];
    hiddenPartyMemberIds: MobileRowProps['hiddenPartyMemberIds'];
    stableMobileDamageClick: EditingResult['stableMobileDamageClick'];
    stableMobileLongPress: EditingResult['stableMobileLongPress'];
    stablePhaseAdd: EditingResult['stablePhaseAdd'];
    stableLabelAdd: EditingResult['stableLabelAdd'];
    stableAddClick: EditingResult['stableAddClick'];
    stableEventClick: EditingResult['stableEventClick'];
    stableCellClick: EditingResult['stableCellClick'];
    stableTimelineSelect: EditingResult['stableTimelineSelect'];
    stableTimelineSelectHover: EditingResult['stableTimelineSelectHover'];
    phaseColumnCollapsed: boolean;
    labelColumnVisible: boolean;
    timelineSelectMode: RowProps['timelineSelectMode'];
    labelSelectMode: RowProps['labelSelectMode'];
    showRowBorders: boolean;
    sheetCols: ReturnType<typeof useTimelineSheetColumns>['sheetCols'];
    rowSwapMarkers: DamageResult['rowSwapMarkers'];
    rowLabels: DamageResult['rowLabels'];
    phases: RowProps['phases'];
    maxMitiIconsPerRow: ReturnType<typeof useTimelineSheetWidth>['maxMitiIconsPerRow'];
    mobileConflictingIds: DamageResult['mobileConflictingIds'];
}

/**
 * 本体の行(PC は TimelineRow・スマホは MobileTimelineRow)を並べる。Timeline から移したもの。
 * 元は毎描画で組み立てていたので React.memo にしない(行側の memo は TimelineRow / MobileTimelineRow が持つ)。
 * Fragment を返し、ラッパー要素は足さない。
 */
export const TimelineRows: React.FC<TimelineRowsProps> = ({
    rowLayout, eventsByTime, damageMap, mitigationsByTime, isMobileTimeline, sortedPartyMembers, visiblePartyMembers,
    hiddenPartyMemberIds, stableMobileDamageClick, stableMobileLongPress, stablePhaseAdd, stableLabelAdd, stableAddClick,
    stableEventClick, stableCellClick, stableTimelineSelect, stableTimelineSelectHover, phaseColumnCollapsed,
    labelColumnVisible, timelineSelectMode, labelSelectMode, showRowBorders, sheetCols, rowSwapMarkers, rowLabels,
    phases, maxMitiIconsPerRow, mobileConflictingIds,
}) => {
    const renderItems: React.ReactElement[] = [];

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

    return <>{renderItems}</>;
};
