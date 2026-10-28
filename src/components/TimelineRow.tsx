import React, { memo } from 'react';
import clsx from 'clsx';
import { useProgressRecording } from './progress/useProgressRecording';
import { rowPropsEqual } from './timeline/rowPropsEqual';
import { TimelineRowContent } from './timeline/TimelineRowContent';
import type { TimelineRowProps } from './timeline/timelineRowTypes';
import './TimelineRow.css';

// TimelineRow(外枠): 位置(top/height)だけを持つ一番外側の div。中身(TimelineRowContent)は
// 別コンポーネントに分けてあるので、他の行の高さが変わって top だけがズレた行は、この外枠だけが
// 描き直され、中身(列のセル群)は描き直されない(memo 比較で弾かれる)。
export const TimelineRow = memo(({
    top,
    height,
    ...contentProps
}: TimelineRowProps) => {
    const {
        time,
        showRowBorders = false,
        timelineSelectMode,
        labelSelectMode,
        phaseColumnCollapsed,
        labelColumnVisible,
        onTimelineSelect,
        onTimelineSelectHover,
    } = contentProps;

    return (
        <div
            data-time-row={time}
            className={clsx(
                "absolute left-0 w-full md:w-fit flex group duration-75",
                "hover:bg-app-surface2",
                // perf #59: ビューポート外行を style/layout/paint からスキップ。仮の高さ(contain-intrinsic-size)は style の height と一致させる
                "[content-visibility:auto]",
                showRowBorders && "border-b border-app-border",
                (timelineSelectMode || labelSelectMode) && "cursor-pointer"
            )}
            style={{
                height: `${height}px`,
                containIntrinsicSize: `auto ${height}px`,
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
            onClickCapture={(e) => {
                // 進捗記録モード中は「キャプチャ段階」で全クリックを横取りし、その行の time を打点。
                // これで列(イベント/フェーズ/ラベル/メンバー)の個別 onClick が発火する前に止まり、
                // モーダル等が開かず、行のどこをクリックしても確実に記録される（表全体が時間ピッカー）。
                if (useProgressRecording.getState().recordMode) {
                    useProgressRecording.getState().commitReachedPos(time);
                    e.stopPropagation();
                    e.preventDefault();
                }
            }}
            onClick={(e) => {
                if (timelineSelectMode || labelSelectMode) {
                    onTimelineSelect?.(time);
                    e.stopPropagation();
                }
            }}
        >
            <TimelineRowContent {...contentProps} />
        </div>
    );
}, (prevProps, nextProps) => rowPropsEqual(prevProps, nextProps, ['events', 'damages', 'activeMitigations']));
