import { create } from 'zustand';

interface LocalImportDialogState {
    isOpen: boolean;
    /**
     * `true` のとき「次回から自動で表示しない」チェックボックスを非表示にする。
     * LoginModal の明示ボタン経由ではユーザーは既に意図的に表示している → チェックボックス不要。
     * 自動トリガー (Layout) では false → チェックボックス表示。
     */
    ignoreDontShow: boolean;
    /** 表示対象のプラン ID 一覧 (B-1 Revision 2: 既にFirestoreにアップロード済みのプラン) */
    targetPlanIds: string[];
    open: (params: { ignoreDontShow: boolean; targetPlanIds: string[] }) => void;
    close: () => void;
}

export const useLocalImportDialog = create<LocalImportDialogState>((set) => ({
    isOpen: false,
    ignoreDontShow: false,
    targetPlanIds: [],
    open: ({ ignoreDontShow, targetPlanIds }) =>
        set({ isOpen: true, ignoreDontShow, targetPlanIds }),
    close: () => set({ isOpen: false }),
}));
