export type BannerKind = "edit" | "consent" | "login";

/** ⑤-3c: バナー状態判定（純粋・テスト可能）。 */
export function bannerKind(s: { isLoggedIn: boolean; canEdit: boolean }): BannerKind {
  if (s.canEdit) return "edit";
  if (s.isLoggedIn) return "consent";
  return "login";
}
