import { create } from 'zustand';

/**
 * 探すページ「タグ」ビューの保留中(pending)選択。
 * `useHousingFilterStore.tags` (実際に適用中のフィルタ) とは別に持ち、
 * 「絞り込む」ボタンを押すまで実際の検索結果には反映しない (design 2026-07-27 §3)。
 */
interface HousingTagPickerState {
    pendingTags: string[];
    /** 直近で同期した時点の committed tags のスナップショット。null = 未同期。
     *  呼び出し側は、現在の committed tags がこれと異なるときだけ再同期する。
     *  タブ往復だけでは committed は変わらないので pending の下書きは保持され、
     *  ヘッダー検索・詳細ページのタグクリック・他のクリアボタン等 picker の外から
     *  committed が変わった場合はここで検知して pending を追従させる。 */
    lastSyncedCommitted: string[] | null;
    toggleTag: (id: string) => void;
    clearPending: () => void;
    syncFromCommitted: (committed: string[]) => void;
}

export const useHousingTagPickerStore = create<HousingTagPickerState>((set) => ({
    pendingTags: [],
    lastSyncedCommitted: null,
    toggleTag: (id) => set((s) => ({
        pendingTags: s.pendingTags.includes(id)
            ? s.pendingTags.filter((v) => v !== id)
            : [...s.pendingTags, id],
    })),
    clearPending: () => set({ pendingTags: [] }),
    syncFromCommitted: (committed) => set({ pendingTags: committed, lastSyncedCommitted: committed }),
}));
