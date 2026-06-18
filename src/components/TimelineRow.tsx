import React, { memo } from 'react';
import clsx from 'clsx';
import type { PartyMember } from '../types';
import { getColumnCssVar } from '../utils/calculator';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/Tooltip';

// PcTypeToggle は TimelineInfoColumns.tsx へ移設済み。テスト（PcTypeToggle.test.tsx）が
// 従来どおり '../TimelineRow' から import できるよう、この 1 つだけ re-export する。
export { PcTypeToggle } from './TimelineInfoColumns';

interface TimelineRowProps {
    time: number;
    top: number;
    partyMembers: PartyMember[];
    onCellClick: (memberId: string, time: number, e: React.MouseEvent) => void;
    phaseColumnCollapsed?: boolean;
    labelColumnVisible?: boolean;
    timelineSelectMode?: { phaseId: string; startTime: number } | null;
    labelSelectMode?: { labelId: string; startTime: number } | null;
    onTimelineSelect?: (time: number) => void;
    onTimelineSelectHover?: (time: number) => void;
    showRowBorders?: boolean;
}

export const TimelineRow = memo(({
    time,
    top,
    partyMembers,
    onCellClick,
    phaseColumnCollapsed,
    labelColumnVisible,
    timelineSelectMode,
    labelSelectMode,
    onTimelineSelect,
    onTimelineSelectHover,
    showRowBorders = false,
}: TimelineRowProps) => {
    const { t } = useTranslation();
    // 情報列は sticky な情報ペイン (Timeline.tsx) 側で描画されるようになったため、
    // スキル行は情報列ぶんの幅を「透明スペーサー」で確保し、スキルセルを従来と同じ x へ送る。
    // スペーサー幅 = 情報ペイン幅 (= phase + label + time + mechanic + counter×2。 折りたたみ追従)。
    const infoSpacerWidth = `calc(${phaseColumnCollapsed ? 'var(--col-phase-collapsed-w)' : 'var(--col-phase-w)'} + ${labelColumnVisible ? 'var(--col-label-w)' : 'var(--col-label-collapsed-w)'} + var(--col-time-w) + var(--col-mechanic-w) + var(--col-counter-w) * 2)`;
    return (
        <div
            className={clsx(
                "absolute left-0 w-full md:w-fit flex h-[50px] group  duration-75",
                "hover:bg-app-surface2",
                // perf #59: ビューポート外行を style/layout/paint からスキップ。 行 height は h-[50px] と一致
                "[content-visibility:auto] [contain-intrinsic-size:auto_50px]",
                showRowBorders && "border-b border-app-border",
                (timelineSelectMode || labelSelectMode) && "cursor-pointer"
            )}
            style={{ top: `${top}px` }}
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
            {/* 情報列ぶんの透明スペーサー (実体は sticky 情報ペインが上に重なって描画する) */}
            <div
                aria-hidden
                className="hidden md:block flex-none h-full"
                style={{ width: infoSpacerWidth, minWidth: infoSpacerWidth }}
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
    if (prevProps.partyMembers !== nextProps.partyMembers) return false;
    if (prevProps.phaseColumnCollapsed !== nextProps.phaseColumnCollapsed) return false;
    if (prevProps.labelColumnVisible !== nextProps.labelColumnVisible) return false;
    if (prevProps.showRowBorders !== nextProps.showRowBorders) return false;
    // 選択モードの開始/終了でスキルセル側のクリック判定 (cursor-pointer / onClick) を更新する。
    // (情報ペイン側の情報行は memo 化していないため常に最新だが、スキルセルもクリックで時間選択できるよう揃える)
    if (prevProps.timelineSelectMode !== nextProps.timelineSelectMode) return false;
    if (prevProps.labelSelectMode !== nextProps.labelSelectMode) return false;
    return true;
});
