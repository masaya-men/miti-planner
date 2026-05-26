import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type HousingViewMode = 'map' | 'pinterest';
export type HousingPageMode = 'browse' | 'tour';

interface HousingViewState {
    viewMode: HousingViewMode;
    leftPanelOpen: boolean;
    rightPanelOpen: boolean;
    mode: HousingPageMode;
    setViewMode: (mode: HousingViewMode) => void;
    setLeftPanelOpen: (open: boolean) => void;
    setRightPanelOpen: (open: boolean) => void;
    enterTourMode: () => void;
    exitTourMode: () => void;
    reset: () => void;
}

const DEFAULTS = {
    // 2026-05-27: マップは sampleWardLayout (偽配置データ) を使うため、 リリース時は list (pinterest)
    // を既定にして偽配置を隠す。 マップ実データ整備後に 'map' へ戻す。
    viewMode: 'pinterest' as const,
    leftPanelOpen: true,
    rightPanelOpen: true,
    mode: 'browse' as const,
};

export const useHousingViewStore = create<HousingViewState>()(
    persist(
        (set) => ({
            ...DEFAULTS,
            setViewMode: (viewMode) => set({ viewMode }),
            setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
            setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
            enterTourMode: () => set({ mode: 'tour', rightPanelOpen: true }),
            exitTourMode: () => set({ mode: 'browse' }),
            reset: () => set(DEFAULTS),
        }),
        {
            name: 'housing-view',
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
