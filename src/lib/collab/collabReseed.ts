// 共同編集 クライアント側 空上書き防御(サーバ _logic.ts emptyOverwriteSkips と同型・対の関係)。
// 「部屋(doc)側が空・手元(store)側が非空」の構造フィールドは、空を手元に適用して画面を潰さず、
// 手元を正として部屋へ再シードする。yjs 非依存の純粋ロジックとして切り出しテストする。

/** 防御対象の構造フィールド(labels/memos は空が正常なため対象外＝サーバと一致)。 */
export const RESEED_FIELDS = ['timelineMitigations', 'timelineEvents', 'phases', 'partyMembers'] as const;
export type ReseedField = (typeof RESEED_FIELDS)[number];

export type FieldCounts = Record<ReseedField, number>;

/**
 * 「doc 側が空(0件) かつ 手元が非空(>0)」のフィールド集合を返す(=手元を正として再シードすべき)。
 * これにより「再接続/desync で一瞬空になった部屋」が手元の非空データを潰すのを防ぐ。
 */
export function fieldsNeedingReseed(doc: FieldCounts, local: FieldCounts): Set<ReseedField> {
  const out = new Set<ReseedField>();
  for (const key of RESEED_FIELDS) {
    if (doc[key] === 0 && local[key] > 0) out.add(key);
  }
  return out;
}
