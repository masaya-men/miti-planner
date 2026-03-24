import type { ContentLevel, ContentCategory, LocalizedString } from './index';

/**
 * 最近のアクティビティ（履歴）のアイテム
 */
export interface RecentPlanItem {
    id: string;
    contentId: string; // contentRegistryのID
    contentName: LocalizedString;
    planName: string;
    lastViewedAt: number; // タイムスタンプ
}

/**
 * サイドバーのフィルター状態
 */
export interface SidebarFilterState {
    level: ContentLevel;
    category: ContentCategory;
}

/**
 * 複数選択モードの状態
 */
export interface MultiSelectState {
    isEnabled: boolean;
    selectedIds: string[]; // 選択されたプランID
}
