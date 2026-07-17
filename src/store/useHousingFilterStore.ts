import { create } from 'zustand';

export type HousingArea = 'Mist' | 'LavenderBeds' | 'Goblet' | 'Shirogane' | 'Empyreum';
export type HousingSize = 'S' | 'M' | 'L';

interface HousingFilterState {
    dc: string | null;
    regions: string[];
    /** ユーザーが地域フィルターを一度でも自分で操作したか (toggleRegion/clearAll)。
     *  true になったら言語切替による既定地域の上書き (applyLocaleDefaultRegions) を行わない。 */
    regionsTouched: boolean;
    servers: string[];
    areas: HousingArea[];
    sizes: HousingSize[];
    tags: string[];
    keyword: string;
    resultCount: number;
    totalCount: number;
    setDC: (dc: string | null) => void;
    toggleRegion: (region: string) => void;
    toggleServer: (server: string) => void;
    /** 地図表示モードのワールド選択ゲート専用: servers を指定の1件だけに絞り込む (spec §3.2)。 */
    setServerExclusive: (server: string) => void;
    toggleArea: (area: HousingArea) => void;
    toggleSize: (size: HousingSize) => void;
    toggleTag: (tag: string) => void;
    setKeyword: (keyword: string) => void;
    setCounts: (result: number, total: number) => void;
    clearAll: () => void;
    /** 言語→地域の初期値を適用する (spec: 言語はフィルターの「初期値」を決めるだけ)。
     *  ユーザーが一度でも地域を操作していたら (regionsTouched) 何もしない。 */
    applyLocaleDefaultRegions: (lang: string) => void;
}

const toggleInArray = <T>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

export const useHousingFilterStore = create<HousingFilterState>((set) => ({
    dc: null,
    regions: [],
    regionsTouched: false,
    servers: [],
    areas: [],
    sizes: [],
    tags: [],
    keyword: '',
    resultCount: 0,
    totalCount: 0,
    // servers は選択中の DC 配下スコープの概念。DC が変わる/クリアされたら servers も一緒にリセットする。
    // (地図モードの WorldSelectGate が入れた servers:[world] が、一覧で DC=すべてにしても残って
    //  裏で絞り続ける残留フィルタバグの根治。地図ゲートは setDC の直後に setServerExclusive で
    //  servers を入れ直すので、同一 DC 再選択時に servers を消さない guard を入れても正しく動く。)
    setDC: (dc) => set((s) => (s.dc === dc ? { dc } : { dc, servers: [] })),
    toggleRegion: (region) => set((s) => ({ regions: toggleInArray(s.regions, region), regionsTouched: true })),
    toggleServer: (server) => set((s) => ({ servers: toggleInArray(s.servers, server) })),
    setServerExclusive: (server) => set({ servers: [server] }),
    toggleArea: (area) => set((s) => ({ areas: toggleInArray(s.areas, area) })),
    toggleSize: (size) => set((s) => ({ sizes: toggleInArray(s.sizes, size) })),
    toggleTag: (tag) => set((s) => ({ tags: toggleInArray(s.tags, tag) })),
    setKeyword: (keyword) => set({ keyword }),
    setCounts: (resultCount, totalCount) => set({ resultCount, totalCount }),
    clearAll: () => set({
        dc: null, regions: [], regionsTouched: true, servers: [], areas: [], sizes: [], tags: [], keyword: '',
    }),
    // 言語→地域の初期値 (spec: B案=言語は初期値のみ)。ユーザー操作後 (touched) は何もしない。
    applyLocaleDefaultRegions: (lang) => set((s) => {
        if (s.regionsTouched) return {};
        const head = (lang || 'ja').slice(0, 2).toLowerCase();
        const regions = head === 'ko' ? ['KR'] : head === 'zh' ? ['CN'] : ['JP', 'NA', 'EU', 'OCE'];
        return { regions };
    }),
}));
