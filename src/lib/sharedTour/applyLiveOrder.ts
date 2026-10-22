/**
 * 共有ツアーの live.order(幹事が並び替えた現在の順)を参加者側の snapshot id 列へ適用する。
 * - order 無し(古い live doc 含む)は snapshotIds のまま
 * - snapshot に有る id だけ order 順・重複除去、order に無い id は元の順で末尾へ
 */
export function applyLiveOrder(
  snapshotIds: string[],
  order: string[] | null | undefined,
): string[] {
  if (!Array.isArray(order)) return snapshotIds;
  const known = new Set(snapshotIds);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of order) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  for (const id of snapshotIds) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}
