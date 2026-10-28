import React, { useState, useEffect, useRef } from 'react';
import type { AppliedMitigation, Mitigation } from '../../types';
import { validateMitigationPlacement } from '../../utils/resourceTracker';
import { MITI_ICON_PX } from './rowLayout';
import type { RowLayout } from './rowLayout';

interface UseMitigationDragArgs {
    mitigation: AppliedMitigation;
    def: Mitigation | undefined;
    rowLayout: RowLayout;
    top: number;
    iconOffset: number;
    iconPx: number;
    isVirtual: boolean;
    onRemove: (id: string) => void;
    onUpdateTime: (id: string, newTime: number) => void;
    onIconTap?: (memberId: string, time: number, e: React.MouseEvent) => void;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    activeMitigations: AppliedMitigation[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 呼び出し側の t をそのまま受ける(validateMitigationPlacement と同じ形)
    t: (key: string, options?: any) => string;
    containerRef: React.RefObject<HTMLDivElement | null>;
    indicatorRef: React.RefObject<HTMLDivElement | null>;
    timeLabelRef: React.RefObject<HTMLDivElement | null>;
}

/** 軽減アイコンのドラッグ移動・右クリック/長押しで消す・置けない時のトースト(MitigationItem から切り出した pointer/touch 処理一式) */
export function useMitigationDrag({
    mitigation, def, rowLayout, top, iconOffset, iconPx, isVirtual,
    onRemove, onUpdateTime, onIconTap, scrollContainerRef, activeMitigations, t,
    containerRef, indicatorRef, timeLabelRef,
}: UseMitigationDragArgs) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragStartRef = useRef<{ pointerX: number; pointerY: number; scrollTop: number } | null>(null);
    const autoScrollRef = useRef<number | null>(null);
    const lastPointerYRef = useRef<number>(0);
    // ドラッグ中の「行の上端」Y から、アイコンの中央がある行の秒を求める
    // (均一な行では旧実装の「最も近い行の上端」と同じ動き。背の高い行でもアイコンの下の行に落ちる)
    const timeAtDraggedTop = (rowTopY: number): number => rowLayout.timeAtY(rowTopY + rowLayout.unitPx / 2);

    const updateDragPosition = (dy: number, animateSnap: boolean = false) => {
        if (!containerRef.current) return;

        if (animateSnap) {
            containerRef.current.style.transition = 'top 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        } else {
            containerRef.current.style.transition = 'none';
        }

        const currentY = top + dy;
        containerRef.current.style.top = `${currentY + iconOffset}px`;
        containerRef.current.style.zIndex = '50';
        containerRef.current.style.opacity = '0.9';

        // スナップ先 = アイコンの中央がある行の秒。その行の上端 Y は rowLayout から
        const snappedTime = timeAtDraggedTop(currentY);
        const snappedY = rowLayout.topOf(snappedTime);
        const relativeY = snappedY - currentY; // containerRefからの相対位置

        if (indicatorRef.current) {
            indicatorRef.current.style.display = 'block';
            indicatorRef.current.style.top = `${relativeY}px`;
        }
        if (timeLabelRef.current) {
            timeLabelRef.current.style.display = 'block';
            timeLabelRef.current.style.top = `${relativeY - 8}px`;
            const min = Math.floor(Math.abs(snappedTime) / 60);
            const sec = Math.abs(snappedTime) % 60;
            const sign = snappedTime < 0 ? '-' : '';
            timeLabelRef.current.textContent = `${sign}${min}:${sec.toString().padStart(2, '0')} `;
        }
    };

    const resetDragPosition = (animate: boolean = false) => {
        if (!containerRef.current) return;

        if (animate) {
            containerRef.current.style.transition = 'top 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        } else {
            containerRef.current.style.transition = 'none';
        }

        containerRef.current.style.top = `${top + iconOffset}px`;

        if (animate) {
            setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.style.zIndex = '';
                    containerRef.current.style.opacity = '';
                    containerRef.current.style.transition = '';
                }
            }, 300);
        } else {
            containerRef.current.style.zIndex = '';
            containerRef.current.style.opacity = '';
        }

        if (indicatorRef.current) indicatorRef.current.style.display = 'none';
        if (timeLabelRef.current) timeLabelRef.current.style.display = 'none';
    };

    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 2500);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // スプシ表示(アイコンが標準より小さい)は置く・消すとも左クリックだけ。右クリックでは消さない
        // (ブラウザ標準のメニューはレーン表示と同じく preventDefault で出さない)
        if (iconPx < MITI_ICON_PX) return;
        if (dragStartRef.current || isVirtual) return;
        onRemove(mitigation.id);
    };

    const handleTouchStart = () => {
        if (iconPx < MITI_ICON_PX) return; // スプシ表示は長押しでも消さない(左クリック=タップだけ)
        timerRef.current = setTimeout(() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
            onRemove(mitigation.id);
        }, 600);
    };

    const handleTouchEnd = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const handleTouchMove = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const EDGE_ZONE = 60;
    const MAX_SCROLL_SPEED = 15;

    const stopAutoScroll = () => {
        if (autoScrollRef.current !== null) {
            cancelAnimationFrame(autoScrollRef.current);
            autoScrollRef.current = null;
        }
    };

    const startAutoScroll = () => {
        const tick = () => {
            const container = scrollContainerRef.current;
            if (!container || !dragStartRef.current) { stopAutoScroll(); return; }

            const rect = container.getBoundingClientRect();
            const pointerY = lastPointerYRef.current;
            const distFromTop = pointerY - rect.top;
            const distFromBottom = rect.bottom - pointerY;

            let scrollDelta = 0;
            if (distFromTop < EDGE_ZONE && distFromTop >= 0) {
                scrollDelta = -MAX_SCROLL_SPEED * (1 - distFromTop / EDGE_ZONE);
            } else if (distFromBottom < EDGE_ZONE && distFromBottom >= 0) {
                scrollDelta = MAX_SCROLL_SPEED * (1 - distFromBottom / EDGE_ZONE);
            }

            if (scrollDelta !== 0) {
                container.scrollTop += scrollDelta;
                const scrollTop = container.scrollTop;
                const totalScrollDelta = scrollTop - dragStartRef.current.scrollTop;
                const dy = pointerY - dragStartRef.current.pointerY + totalScrollDelta;
                updateDragPosition(dy);
            }

            autoScrollRef.current = requestAnimationFrame(tick);
        };
        stopAutoScroll();
        autoScrollRef.current = requestAnimationFrame(tick);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0 || isVirtual) return;
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, scrollTop };
        lastPointerYRef.current = e.clientY;
        updateDragPosition(0);
        startAutoScroll();
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragStartRef.current) return;
        lastPointerYRef.current = e.clientY;
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        const scrollDelta = scrollTop - dragStartRef.current.scrollTop;
        const dy = e.clientY - dragStartRef.current.pointerY + scrollDelta;
        updateDragPosition(dy);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragStartRef.current) return;
        stopAutoScroll();
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        const scrollDelta = scrollTop - dragStartRef.current.scrollTop;
        const dy = e.clientY - dragStartRef.current.pointerY + scrollDelta;

        // 👇 修正：指を離した最終的なY座標から、スナップ先の時間を計算する
        const finalY = top + dy;
        const newTime = timeAtDraggedTop(finalY);

        const dragStartX = dragStartRef.current.pointerX;
        dragStartRef.current = null;

        if (newTime !== mitigation.time && def) {
            const status = validateMitigationPlacement(def, newTime, activeMitigations, t, mitigation.id);

            if (status.available) {
                resetDragPosition(false);
                onUpdateTime(mitigation.id, newTime);
            } else {
                setToastMessage(t('timeline.cannot_place_here'));
                resetDragPosition(true);
            }
        } else {
            resetDragPosition(false);
            // スプシ表示: ほぼ動かさずに離した = アイコンのマスをもう一度押した扱い
            if (onIconTap && Math.abs(dy) < 4 && Math.abs(e.clientX - dragStartX) < 4) onIconTap(mitigation.ownerId, mitigation.time, e);
        }
    };

    return {
        toastMessage,
        handleContextMenu, handleTouchStart, handleTouchEnd, handleTouchMove,
        handlePointerDown, handlePointerMove, handlePointerUp,
    };
}
