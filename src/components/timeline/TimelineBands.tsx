import React from 'react';
import clsx from 'clsx';
import type { TFunction } from 'i18next';
import { getPhaseName } from '../../types';
import type { Phase, Label } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import { TableHoverHighlight } from './sheet/TableHoverHighlight';
import type { useTimelineRowLayout, useTimelineHoverGeom } from './useTimelineLayout';
import type { useTimelinePreviewHighlight } from './useTimelinePreviewHighlight';

interface TimelineBandsProps {
    t: TFunction;
    isMobileTimeline: boolean;
    isMobileView: boolean;
    sheetContainerRef: React.RefObject<HTMLDivElement | null>;
    hoverGeomRef: ReturnType<typeof useTimelineHoverGeom>['hoverGeomRef'];
    phases: Phase[];
    labels: Label[];
    phaseColumnCollapsed: boolean;
    labelColumnVisible: boolean;
    showPreStart: boolean;
    contentLanguage: string;
    rowLayout: ReturnType<typeof useTimelineRowLayout>['rowLayout'];
    labelSelectMode: { labelId: string; startTime: number } | null;
    /** TL 選択モードの強調要素に付ける ref(useTimelinePreviewHighlight が style を直接書く) */
    overlayRef: ReturnType<typeof useTimelinePreviewHighlight>['overlayRef'];
}

/** ホバー強調・フェーズ帯・ラベル帯・TL 選択の強調。Timeline から移したもの(Fragment を返しラッパーは足さない)。 */
export const TimelineBands: React.FC<TimelineBandsProps> = ({
    t, isMobileTimeline, isMobileView, sheetContainerRef, hoverGeomRef, phases, labels, phaseColumnCollapsed,
    labelColumnVisible, showPreStart, contentLanguage, rowLayout, labelSelectMode, overlayRef,
}) => {
    return (
        <>
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
        </>
    );
};
