export type ImportBlockReason = 'no_phases' | 'party_incomplete';

export interface ImportConfirmArgs {
  hasPreviewEvents: boolean;
  partyComplete: boolean;
}

/** 「取り込んで作成」が押せない理由を1つ返す(優先順)。押せるなら null。
 * - no_phases: プレビューにイベントが無い
 * - party_incomplete: パーティ枠が未割当
 * 未追加の貼り付けは作成時に自動取り込みするためブロック理由にしない(§9.7 D)。 */
export function importBlockReason(args: ImportConfirmArgs): ImportBlockReason | null {
  if (!args.hasPreviewEvents) return 'no_phases';
  if (!args.partyComplete) return 'party_incomplete';
  return null;
}
