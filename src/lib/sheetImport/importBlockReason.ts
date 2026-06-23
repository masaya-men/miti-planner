export type ImportBlockReason = 'pending_draft' | 'no_phases' | 'party_incomplete';

export interface ImportConfirmArgs {
  hasPreviewEvents: boolean;
  partyComplete: boolean;
  hasPendingDraft: boolean;
}

/**
 * スプシ取込モーダルで「取り込んで作成」が押せない理由を1つ返す(優先順)。
 * 押せる(全条件OK)なら null。
 * - pending_draft: 貼り付け欄に未追加の内容が残っている(まず追加させる)
 * - no_phases: フェーズが1つも無い(プレビューにイベント無し)
 * - party_incomplete: パーティの枠が未割当
 * フッターに理由を出して「なぜ灰色か」をユーザーに伝えるのに使う。
 */
export function importBlockReason(args: ImportConfirmArgs): ImportBlockReason | null {
  if (args.hasPendingDraft) return 'pending_draft';
  if (!args.hasPreviewEvents) return 'no_phases';
  if (!args.partyComplete) return 'party_incomplete';
  return null;
}
