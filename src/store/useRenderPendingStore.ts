import { create } from 'zustand';

interface RenderPendingState {
    pending: boolean;
    show: () => void;
    hide: () => void;
}

/**
 * 「今すごく重い再描画が走っている」ことをユーザーに知らせるための一時的なフラグ。
 * hideEmptyRows/showRowBorders 等と違い永続化しない(押した瞬間だけの状態)。
 * 表示メンバー絞り込みトグル(重いTimeline再描画を伴う)で使用。
 */
export const useRenderPendingStore = create<RenderPendingState>((set) => ({
    pending: false,
    show: () => set({ pending: true }),
    hide: () => set({ pending: false }),
}));
