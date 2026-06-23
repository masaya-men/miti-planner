/**
 * スプシ取込モーダルの「取り込んで作成」可否。
 * 未追加の貼り付け(hasPendingDraft)が残っている間は false にして、
 * 末尾フェーズの黙殺(取りこぼし)を防ぐ。
 */
export function canConfirmImport(args: {
  hasPreviewEvents: boolean;
  partyComplete: boolean;
  hasPendingDraft: boolean;
}): boolean {
  return args.hasPreviewEvents && args.partyComplete && !args.hasPendingDraft;
}
