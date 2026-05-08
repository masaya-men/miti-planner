import { create } from 'zustand';

interface LocalImportDialogState {
    isOpen: boolean;
    /**
     * `true` のとき「次回から自動で表示しない」チェックボックスを非表示にする。
     * LoginModal の明示ボタン経由ではユーザーは既に意図的に表示している → チェックボックス不要。
     * 自動トリガー (Layout) では false → チェックボックス表示。
     */
    ignoreDontShow: boolean;
    open: (params: { ignoreDontShow: boolean }) => void;
    close: () => void;
}

export const useLocalImportDialog = create<LocalImportDialogState>((set) => ({
    isOpen: false,
    ignoreDontShow: false,
    open: ({ ignoreDontShow }) => set({ isOpen: true, ignoreDontShow }),
    close: () => set({ isOpen: false }),
}));
