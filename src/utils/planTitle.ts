/**
 * 同一コンテンツ内で重複しないプラン名を生成する。
 *
 * - 既存に同名プランがなければ希望の名前をそのまま返す
 * - 衝突している場合のみ末尾に `(2)`, `(3)` ... を自動付与
 * - スコープは `contentId` 単位。別コンテンツに同名プランがあっても無関係
 */
export function generateUniqueTitle(
    desiredTitle: string,
    existingPlans: ReadonlyArray<{ title: string; contentId?: string | null }>,
    contentId: string | null | undefined,
): string {
    const samePlans = existingPlans.filter(p => (p.contentId ?? null) === (contentId ?? null));

    // 入力名と完全一致するプランが無ければ、希望名をそのまま使える
    const hasExact = samePlans.some(p => p.title === desiredTitle);
    if (!hasExact) return desiredTitle;

    // 衝突発生 → ベース名を抽出し、ベース＋数字バリアントの最大値+1 を採番
    const baseTitle = desiredTitle.replace(/\s*\(\d+\)$/, '');
    const existingNumbers = samePlans
        .filter(p => {
            const stripped = p.title.replace(/\s*\(\d+\)$/, '');
            return stripped === baseTitle;
        })
        .map(p => {
            const match = p.title.match(/\((\d+)\)$/);
            return match ? parseInt(match[1], 10) : 1;
        });

    const nextNumber = Math.max(...existingNumbers, 1) + 1;
    return `${baseTitle} (${nextNumber})`;
}
