/** dnd-kit の並べ替え用。画像 URL 配列 → 安定 id 付きの行へ。 */
export interface SortableItem {
  /** dnd-kit が要求する安定 ID。 index+url で一意にする */
  id: string;
  url: string;
}

export function toSortableItems(urls: string[]): SortableItem[] {
  return urls.map((url, i) => ({ id: `${i}-${url}`, url }));
}
