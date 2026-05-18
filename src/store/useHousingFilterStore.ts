import { create } from 'zustand';

export type HousingArea = 'Mist' | 'LavenderBeds' | 'Goblet' | 'Shirogane' | 'Empyreum';
export type HousingSize = 'S' | 'M' | 'L';

interface HousingFilterState {
    dc: string | null;
    regions: string[];
    servers: string[];
    areas: HousingArea[];
    sizes: HousingSize[];
    tags: string[];
    searchText: string;
    resultCount: number;
    totalCount: number;
    setDC: (dc: string | null) => void;
    toggleRegion: (region: string) => void;
    toggleServer: (server: string) => void;
    toggleArea: (area: HousingArea) => void;
    toggleSize: (size: HousingSize) => void;
    toggleTag: (tag: string) => void;
    setSearchText: (text: string) => void;
    setCounts: (result: number, total: number) => void;
    clearAll: () => void;
}

const toggleInArray = <T>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

export const useHousingFilterStore = create<HousingFilterState>((set) => ({
    dc: null,
    regions: [],
    servers: [],
    areas: [],
    sizes: [],
    tags: [],
    searchText: '',
    resultCount: 0,
    totalCount: 0,
    setDC: (dc) => set({ dc }),
    toggleRegion: (region) => set((s) => ({ regions: toggleInArray(s.regions, region) })),
    toggleServer: (server) => set((s) => ({ servers: toggleInArray(s.servers, server) })),
    toggleArea: (area) => set((s) => ({ areas: toggleInArray(s.areas, area) })),
    toggleSize: (size) => set((s) => ({ sizes: toggleInArray(s.sizes, size) })),
    toggleTag: (tag) => set((s) => ({ tags: toggleInArray(s.tags, tag) })),
    setSearchText: (searchText) => set({ searchText }),
    setCounts: (resultCount, totalCount) => set({ resultCount, totalCount }),
    clearAll: () => set({
        dc: null, regions: [], servers: [], areas: [], sizes: [], tags: [], searchText: '',
    }),
}));
