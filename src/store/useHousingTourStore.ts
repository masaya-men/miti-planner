import { create } from 'zustand';

interface HousingTourState {
    listingIds: string[];
    running: boolean;
    currentIndex: number;
    /** moving=移動中(行き方表示) / viewing=見学中(タイマー表示)。将来の共有ツアー同期でそのまま共有する素の状態。 */
    phase: 'moving' | 'viewing';
    /** 見学開始の epoch ms。moving では null。経過時間は表示側(useElapsed)が算出する。 */
    viewStartAt: number | null;
    setListings: (ids: string[]) => void;
    start: () => void;
    stop: () => void;
    next: () => void;
    prev: () => void;
    /** 現在の目的地の見学を開始(=viewing へ)。開始時刻を今に記録。 */
    startViewing: () => void;
    reset: () => void;
}

export const useHousingTourStore = create<HousingTourState>((set) => ({
    listingIds: [],
    running: false,
    currentIndex: 0,
    phase: 'moving',
    viewStartAt: null,
    setListings: (listingIds) => set({ listingIds }),
    start: () => set({ running: true, currentIndex: 0, phase: 'moving', viewStartAt: null }),
    stop: () => set({ running: false }),
    next: () => set((s) => ({
        currentIndex: Math.min(s.listingIds.length - 1, s.currentIndex + 1),
        phase: 'moving',
        viewStartAt: null,
    })),
    prev: () => set((s) => ({
        currentIndex: Math.max(0, s.currentIndex - 1),
        phase: 'moving',
        viewStartAt: null,
    })),
    startViewing: () => set({ phase: 'viewing', viewStartAt: Date.now() }),
    reset: () => set({ listingIds: [], running: false, currentIndex: 0, phase: 'moving', viewStartAt: null }),
}));
