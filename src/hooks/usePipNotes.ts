import { useState, useCallback } from 'react';

const STORAGE_PREFIX = 'pip-notes:';

/** localStorage から指定プランのメモを取得 */
export function getPipNotes(planId: string): Record<string, string> {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + planId);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/** 指定プラン・イベントのメモを保存（空文字で削除） */
export function setPipNote(planId: string, eventId: string, text: string): void {
    const notes = getPipNotes(planId);
    if (text) {
        notes[eventId] = text;
    } else {
        delete notes[eventId];
    }
    localStorage.setItem(STORAGE_PREFIX + planId, JSON.stringify(notes));
}

/** 指定プランのメモをすべて削除 */
export function clearPipNotes(planId: string): void {
    localStorage.removeItem(STORAGE_PREFIX + planId);
}

/** Reactフック: PipView 内で使用 */
export function usePipNotes(planId: string | null) {
    const [notes, setNotes] = useState<Record<string, string>>(() =>
        planId ? getPipNotes(planId) : {}
    );

    const updateNote = useCallback((eventId: string, text: string) => {
        if (!planId) return;
        setPipNote(planId, eventId, text);
        setNotes(getPipNotes(planId));
    }, [planId]);

    return { notes, updateNote };
}
