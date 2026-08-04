/**
 * 表示名の検索用正規化。
 * housing_profiles の displayNameLower に保存する (探すページのハウジンガー一覧クエリ用)。
 */
export function normalizeDisplayNameForSearch(displayName: string): string {
  return displayName.trim().toLowerCase();
}
