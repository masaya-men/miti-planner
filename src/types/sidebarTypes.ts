/**
 * 複数選択モードの状態
 */
export interface MultiSelectState {
    isEnabled: boolean;
    selectedIds: string[]; // 選択されたプランID
    /** 選択モードの目的: 共有 or 削除 */
    mode?: 'share' | 'delete';
}
