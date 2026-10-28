import React, { useRef, useCallback } from 'react';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import type { Job, PartyMember } from '../../types';

export const usePartySlotDrag = (
    setDraftMembers: React.Dispatch<React.SetStateAction<PartyMember[]>>,
    setFocusedSlot: React.Dispatch<React.SetStateAction<number | null>>,
) => {
    // ── PC用 D&D: ジョブパレットからスロットへドラッグ ──
    const slotDropRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    const handleDragDrop = useCallback((job: Job, targetId: string) => {
        const targetIndex = parseInt(targetId, 10);
        if (isNaN(targetIndex)) return;
        setDraftMembers(prev => prev.map((m, i) => i === targetIndex ? { ...m, jobId: job.id } : m));
        setFocusedSlot(null);
        useTutorialStore.getState().completeEvent('party:job-set');
    }, []);

    const drag = useDragAndDrop<Job>({ holdDelay: 0, onDrop: handleDragDrop });

    const handlePaletteDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        drag.moveDrag(e);
        if (!drag.isDragging) return;
        const pos = 'touches' in e
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };
        let found: string | null = null;
        slotDropRefs.current.forEach((el, idx) => {
            const rect = el.getBoundingClientRect();
            if (pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top && pos.y <= rect.bottom) {
                found = String(idx);
            }
        });
        drag.setActiveTarget(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drag は毎回作り直されるオブジェクト。ドラッグ中フラグと移動・対象設定の関数が変わった時だけ作り直す
    }, [drag.isDragging, drag.moveDrag, drag.setActiveTarget]);

    return { drag, handlePaletteDragMove, slotDropRefs };
};
