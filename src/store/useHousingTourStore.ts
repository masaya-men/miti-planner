import { create } from 'zustand';

interface HousingTourState {
    listingIds: string[];
    running: boolean;
    currentIndex: number;
    setListings: (ids: string[]) => void;
    start: () => void;
    stop: () => void;
    next: () => void;
    prev: () => void;
    reset: () => void;
}

export const useHousingTourStore = create<HousingTourState>((set) => ({
    listingIds: [],
    running: false,
    currentIndex: 0,
    setListings: (listingIds) => set({ listingIds }),
    start: () => set({ running: true, currentIndex: 0 }),
    stop: () => set({ running: false }),
    next: () => set((s) => ({
        currentIndex: Math.min(s.listingIds.length - 1, s.currentIndex + 1),
    })),
    prev: () => set((s) => ({
        currentIndex: Math.max(0, s.currentIndex - 1),
    })),
    reset: () => set({ listingIds: [], running: false, currentIndex: 0 }),
}));
