export interface HousingTab {
  key: string;
  labelKey: string; // i18n キー
  path: string;     // 絶対パス
  end?: boolean;    // 完全一致のみ active (index タブ用)
}

/**
 * ハウジング上部タブの単一ソース。TabBar / AppHeader / ルーティングが参照する。
 * URL ベース（各タブに実ルート）= ブックマーク/共有/戻る/リロードが効く設計。
 */
export const HOUSING_TABS: readonly HousingTab[] = [
  { key: 'browse', labelKey: 'housing.tabs.browse', path: '/housing', end: true },
  { key: 'favorites', labelKey: 'housing.tabs.favorites', path: '/housing/favorites' },
  { key: 'plan', labelKey: 'housing.tabs.plan', path: '/housing/plan' },
  { key: 'tour', labelKey: 'housing.tabs.tour', path: '/housing/tour' },
  { key: 'register', labelKey: 'housing.tabs.register', path: '/housing/register' },
  { key: 'mypage', labelKey: 'housing.tabs.mypage', path: '/housing/mypage' },
] as const;
