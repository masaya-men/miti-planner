import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// @deprecated 旧 Phase 2B の偽配置マップ ('map') / 一覧 ('pinterest') の意味。
// 2026-07 探すページ 地図表示モードとは無関係 — 新規実装は browseView を使うこと (誤用防止)。
export type HousingViewMode = 'map' | 'pinterest';
export type HousingPageMode = 'browse' | 'tour';
/** 探すページ中央の表示切替 (2026-07 地図表示モード)。'list' = 一覧 (ListingGrid) / 'map' = 地図 (BrowseMapView)。 */
export type HousingBrowseView = 'list' | 'map';

interface HousingViewState {
    viewMode: HousingViewMode;
    leftPanelOpen: boolean;
    rightPanelOpen: boolean;
    mode: HousingPageMode;
    browseView: HousingBrowseView;
    setViewMode: (mode: HousingViewMode) => void;
    setLeftPanelOpen: (open: boolean) => void;
    setRightPanelOpen: (open: boolean) => void;
    enterTourMode: () => void;
    exitTourMode: () => void;
    setBrowseView: (view: HousingBrowseView) => void;
    reset: () => void;
}

const DEFAULTS = {
    // 2026-05-27: マップは sampleWardLayout (偽配置データ) を使うため、 リリース時は list (pinterest)
    // を既定にして偽配置を隠す。 マップ実データ整備後に 'map' へ戻す。
    viewMode: 'pinterest' as const,
    leftPanelOpen: true,
    rightPanelOpen: true,
    mode: 'browse' as const,
    // 2026-07-10: 地図表示モードはワールド選択ゲート等の配線が Task 3〜6 で完了するまで
    // 未完成のため、既定は 'list' (一覧) にして未完成の地図を誤って初期表示しない。
    browseView: 'list' as const,
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
            setBrowseView: (browseView) => set({ browseView }),
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
