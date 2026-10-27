/** ⑤-3b: contentId 解決。SavedPlan 優先、無ければジョイナー一時セッションの値。 */
export function resolveContentId(planContentId: string | null, joinerContentId: string | null): string | null {
    return planContentId ?? joinerContentId ?? null;
}

/** ⑤-3b/⑤-3c: ジョイナー読み取り専用か(部屋参加中 && 編集不可)。canEdit なら編集可＝false。 */
export function isJoinerReadonly(roomToken: string | null, canEdit: boolean): boolean {
    return roomToken !== null && !canEdit;
}
