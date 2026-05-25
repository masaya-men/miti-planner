import React, { useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import type { PlanMemo } from '../../types';
import { timeSecToY, xRatioToPx, yToTimeSec, pxToXRatio, clampXRatio } from './coords';
import './memo.css';

interface MemoOverlayProps {
    memos: PlanMemo[];
    timeToYMap: Map<number, number>;
    sheetWidth: number;
    /** メモモード ON 中は touchable、 OFF 中は readonly */
    interactive: boolean;
    /** クリック (= 編集モーダル起動) */
    onMemoClick?: (memo: PlanMemo) => void;
    /** DnD 確定時 (pointerup) */
    onMemoDragEnd?: (id: string, coords: { timeSec: number; xRatio: number }) => void;
    /** 右クリック削除 */
    onMemoDelete?: (id: string) => void;
}

// クリック / ドラッグ判定の閾値 (px)
const DRAG_THRESHOLD_PX = 4;

export const MemoOverlay: React.FC<MemoOverlayProps> = ({
    memos,
    timeToYMap,
    sheetWidth,
    interactive,
    onMemoClick,
    onMemoDragEnd,
    onMemoDelete,
}) => {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const dragStateRef = useRef<{
        id: string;
        pointerId: number;
        startX: number;
        startY: number;
        origLeft: number;
        origTop: number;
        moved: boolean;
    } | null>(null);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, memo: PlanMemo) => {
        if (!interactive) return;
        // 右クリック (button=2) は onContextMenu に任せる
        if (e.button !== 0) return;
        e.stopPropagation();
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        const top = timeSecToY(memo.timeSec, timeToYMap);
        const left = xRatioToPx(memo.xRatio, sheetWidth);
        dragStateRef.current = {
            id: memo.id,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            origLeft: left,
            origTop: top,
            moved: false,
        };
    }, [interactive, timeToYMap, sheetWidth]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const s = dragStateRef.current;
        if (!s || s.pointerId !== e.pointerId) return;
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        if (!s.moved) {
            s.moved = true;
            setDraggingId(s.id);
        }
        // 視覚追従は inline style 直接更新 (React 再レンダー無し)
        const newLeft = s.origLeft + dx;
        const newTop = s.origTop + dy;
        const el = e.currentTarget;
        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const s = dragStateRef.current;
        if (!s || s.pointerId !== e.pointerId) return;
        const el = e.currentTarget;
        try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
        const moved = s.moved;
        if (moved) {
            const newLeft = s.origLeft + (e.clientX - s.startX);
            const newTop = s.origTop + (e.clientY - s.startY);
            // y → timeSec 逆引き。 シート範囲外なら最近接 entry に丸める。
            let timeSec = yToTimeSec(newTop, timeToYMap);
            if (timeSec === null) {
                // 範囲外 → 端の time に寄せる
                const entries = Array.from(timeToYMap.entries()).sort((a, b) => a[0] - b[0]);
                if (entries.length > 0) {
                    timeSec = newTop < entries[0][1] ? entries[0][0] : entries[entries.length - 1][0];
                } else {
                    timeSec = 0;
                }
            }
            const xRatio = clampXRatio(pxToXRatio(newLeft, sheetWidth));
            onMemoDragEnd?.(s.id, { timeSec, xRatio });
        } else {
            // しきい値未満 = クリック扱い
            onMemoClick?.(memos.find(m => m.id === s.id)!);
        }
        dragStateRef.current = null;
        setDraggingId(null);
    }, [memos, sheetWidth, timeToYMap, onMemoDragEnd, onMemoClick]);

    const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const s = dragStateRef.current;
        if (!s || s.pointerId !== e.pointerId) return;
        // 元位置に戻す (state の memo.timeSec/xRatio が変わってないので再描画で自然に戻る)
        const el = e.currentTarget;
        el.style.left = '';
        el.style.top = '';
        dragStateRef.current = null;
        setDraggingId(null);
    }, []);

    const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>, memo: PlanMemo) => {
        if (!interactive) return;
        e.preventDefault();
        e.stopPropagation();
        onMemoDelete?.(memo.id);
    }, [interactive, onMemoDelete]);

    return (
        <>
            {memos.map(memo => {
                const top = timeSecToY(memo.timeSec, timeToYMap);
                const left = xRatioToPx(memo.xRatio, sheetWidth);
                const isDragging = draggingId === memo.id;
                return (
                    <div
                        key={memo.id}
                        data-memo-id={memo.id}
                        className={clsx(
                            'plan-memo',
                            isDragging && 'plan-memo--dragging',
                            !interactive && 'plan-memo--readonly'
                        )}
                        style={{ top: `${top}px`, left: `${left}px` }}
                        onPointerDown={(e) => handlePointerDown(e, memo)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        onContextMenu={(e) => handleContextMenu(e, memo)}
                    >
                        {memo.text}
                    </div>
                );
            })}
        </>
    );
};
