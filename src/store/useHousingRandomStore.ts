import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HousingRandomState {
    selectedWardId: string | null;
    selectWard: (id: string) => void;
    reset: () => void;
}

export const useHousingRandomStore = create<HousingRandomState>()(
    persist(
        (set) => ({
            selectedWardId: null,
            selectWard: (id) => set({ selectedWardId: id }),
            reset: () => set({ selectedWardId: null }),
        }),
        {
            name: 'housing-random',
            storage: {
                getItem: (k) => {
                    const v = sessionStorage.getItem(k);
                    return v ? JSON.parse(v) : null;
                },
                setItem: (k, v) => sessionStorage.setItem(k, JSON.stringify(v)),
                removeItem: (k) => sessionStorage.removeItem(k),
            },
        }
    )
);
