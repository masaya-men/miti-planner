import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface HousingFavoritesState {
    ids: string[];
    add: (id: string) => void;
    remove: (id: string) => void;
    contains: (id: string) => boolean;
    reset: () => void;
}

export const useHousingFavoritesStore = create<HousingFavoritesState>()(
    persist(
        (set, get) => ({
            ids: [],
            add: (id) => set((s) => (s.ids.includes(id) ? s : { ids: [...s.ids, id] })),
            remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
            contains: (id) => get().ids.includes(id),
            reset: () => set({ ids: [] }),
        }),
        {
            name: 'housing-favorites',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
