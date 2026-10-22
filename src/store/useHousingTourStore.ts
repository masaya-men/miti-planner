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
    /**
     * ナビ中の並び替え確定。見学済み(currentIndex より前)は据え置き、currentIndex 以降を remainingIds に差し替える。
     * 新しい先頭(listingIds[currentIndex])が元と違えば moving・viewStartAt=null、同じなら phase/viewStartAt を保つ。
     * remainingIds が空なら何もしない(家が 0 件になる事故の防止)。
     */
    reorderRemaining: (remainingIds: string[]) => void;
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
    reorderRemaining: (remainingIds) => set((s) => {
        if (remainingIds.length === 0) return {};
        const listingIds = s.listingIds.slice(0, s.currentIndex).concat(remainingIds);
        if (listingIds[s.currentIndex] === s.listingIds[s.currentIndex]) return { listingIds };
        return { listingIds, phase: 'moving' as const, viewStartAt: null };
    }),
}));
