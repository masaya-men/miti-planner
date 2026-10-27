import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { RowLayout } from './rowLayout';

interface UseTimelinePreviewHighlightArgs {
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    rowLayoutRef: RefObject<RowLayout>;
    timelineSelectMode: { phaseId: string; startTime: number; field: 'startTime' | 'endTime' } | null;
    labelSelectMode: { labelId: string; startTime: number; field: 'startTime' | 'endTime' } | null;
    showPreStart: boolean;
}

/**
 * 範囲選択中のプレビュー強調(DOM 直接操作 + rAF 間引き + アンマウント時 rAF 解除)。
 * Timeline 本体から移したもの。overlayRef は本体 JSX の選択強調要素へ付ける。
 */
export function useTimelinePreviewHighlight({
    scrollContainerRef, rowLayoutRef, timelineSelectMode, labelSelectMode, showPreStart,
}: UseTimelinePreviewHighlightArgs) {
    const previewEndTimeRef = useRef<number | null>(null);
    const previewRafRef = useRef<number | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    /** DOM直接操作でプレビューハイライトを更新（React再レンダリングなし） */
    const updatePreviewHighlight = useCallback((time: number | null) => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // 前回のハイライトをクリア
        const highlighted = container.querySelectorAll('.preview-highlight');
        for (let i = 0; i < highlighted.length; i++) {
            highlighted[i].classList.remove('preview-highlight');
        }

        if (time === null || (!timelineSelectMode && !labelSelectMode)) {
            if (overlayRef.current) overlayRef.current.style.display = 'none';
            container.classList.remove('phase-select-preview', 'label-select-preview');
            return;
        }

        // コンテナにモード識別クラスを付与（CSS側でフェーズ/ラベル列を区別）
        container.classList.remove('phase-select-preview', 'label-select-preview');
        container.classList.add(timelineSelectMode ? 'phase-select-preview' : 'label-select-preview');

        const mode = timelineSelectMode || labelSelectMode!;
        const min = Math.min(mode.startTime, time);
        const max = Math.max(mode.startTime, time);

        // 範囲内の行にpreview-highlightクラスを付与
        const rows = container.querySelectorAll('[data-time-row]');
        for (let i = 0; i < rows.length; i++) {
            const t = Number(rows[i].getAttribute('data-time-row'));
            if (t >= min && t <= max) {
                rows[i].classList.add('preview-highlight');
            }
        }

        // オーバーレイ位置を直接更新(縦位置は rowLayout から)
        if (overlayRef.current) {
            const layout = rowLayoutRef.current;
            const offsetTime = showPreStart ? -10 : 0;
            const startTime = Math.max(Math.min(mode.startTime, time), offsetTime);
            const endTime = Math.max(Math.max(mode.startTime, time) + 1, offsetTime);
            const startY = layout.topOf(startTime);
            const endY = layout.topOf(endTime);
            const height = Math.max(0, endY - startY);
            overlayRef.current.style.top = `${startY}px`;
            overlayRef.current.style.height = `${height}px`;
            overlayRef.current.style.display = height > 0 ? '' : 'none';
        }
    }, [scrollContainerRef, timelineSelectMode, labelSelectMode, rowLayoutRef, showPreStart]);

    const throttledUpdatePreview = useCallback((time: number | null) => {
        previewEndTimeRef.current = time;
        if (time === null) {
            if (previewRafRef.current !== null) {
                cancelAnimationFrame(previewRafRef.current);
                previewRafRef.current = null;
            }
            updatePreviewHighlight(null);
            return;
        }
        if (previewRafRef.current === null) {
            previewRafRef.current = requestAnimationFrame(() => {
                updatePreviewHighlight(previewEndTimeRef.current);
                previewRafRef.current = null;
            });
        }
    }, [updatePreviewHighlight]);

    // rAFクリーンアップ（アンマウント時）
    useEffect(() => {
        return () => {
            if (previewRafRef.current !== null) {
                cancelAnimationFrame(previewRafRef.current);
            }
        };
    }, []);

    return { previewEndTimeRef, overlayRef, updatePreviewHighlight, throttledUpdatePreview };
}
