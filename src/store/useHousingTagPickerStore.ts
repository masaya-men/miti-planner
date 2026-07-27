import { create } from 'zustand';

/**
 * 探すページ「タグ」ビューの保留中(pending)選択。
 * `useHousingFilterStore.tags` (実際に適用中のフィルタ) とは別に持ち、
 * 「絞り込む」ボタンを押すまで実際の検索結果には反映しない (design 2026-07-27 §3)。
 */
interface HousingTagPickerState {
    pendingTags: string[];
    /** syncFromCommitted が一度でも呼ばれたか。呼び出し側はこれが false の間だけ再同期する。 */
    initialized: boolean;
    toggleTag: (id: string) => void;
    clearPending: () => void;
    syncFromCommitted: (committed: string[]) => void;
}

export const useHousingTagPickerStore = create<HousingTagPickerState>((set) => ({
    pendingTags: [],
    initialized: false,
    toggleTag: (id) => set((s) => ({
        pendingTags: s.pendingTags.includes(id)
            ? s.pendingTags.filter((v) => v !== id)
            : [...s.pendingTags, id],
    })),
    clearPending: () => set({ pendingTags: [] }),
    syncFromCommitted: (committed) => set({ pendingTags: committed, initialized: true }),
}));
