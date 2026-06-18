import { create } from 'zustand';

const STORAGE_KEY = 'lopo_progress_bar_visible';

export function readVisibleFromStorage(): boolean {
    if (typeof globalThis.localStorage === 'undefined') return true;
    return globalThis.localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function writeVisibleToStorage(v: boolean): void {
    if (typeof globalThis.localStorage === 'undefined') return;
    globalThis.localStorage.setItem(STORAGE_KEY, String(v));
}

interface ProgressBarVisibilityState {
    visible: boolean;
    hide: () => void;
    show: () => void;
    toggle: () => void;
}

export const useProgressBarVisibility = create<ProgressBarVisibilityState>((set, get) => ({
    visible: readVisibleFromStorage(),
    hide: () => { writeVisibleToStorage(false); set({ visible: false }); },
    show: () => { writeVisibleToStorage(true); set({ visible: true }); },
    toggle: () => { const next = !get().visible; writeVisibleToStorage(next); set({ visible: next }); },
}));
