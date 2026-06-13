import { useTranslation } from "react-i18next";

export type BannerKind = "edit" | "consent" | "login";

/** ⑤-3c: バナー状態判定（純粋・テスト可能）。 */
export function bannerKind(s: { isLoggedIn: boolean; canEdit: boolean }): BannerKind {
  if (s.canEdit) return "edit";
  if (s.isLoggedIn) return "consent";
  return "login";
}

interface Props {
  isLoggedIn: boolean;
  canEdit: boolean;
  ownerLabel: string | null;
  onLogin: () => void;
  onOpenConsent: () => void;
}

/** 部屋内に常駐する赤い注意バー（誰の表か・undo 無し・状態別 CTA）。機能色 赤=危険。 */
export function CollabJoinerBanner({ isLoggedIn, canEdit, ownerLabel, onLogin, onOpenConsent }: Props) {
  const { t } = useTranslation();
  const kind = bannerKind({ isLoggedIn, canEdit });
  return (
    <div
      role="alert"
      className="collab-joiner-banner w-full bg-app-red text-white text-app-sm px-4 py-2 flex items-center justify-center gap-3 text-center"
    >
      {kind === "edit" && (
        <span>{ownerLabel ? t("collab.banner_edit", { label: ownerLabel }) : t("collab.banner_edit_nolabel")}</span>
      )}
      {kind === "consent" && (
        <>
          <span>{t("collab.banner_consent")}</span>
          <button onClick={onOpenConsent} className="shrink-0 underline font-bold cursor-pointer active:scale-95 transition-transform">
            {t("collab.banner_consent_cta")}
          </button>
        </>
      )}
      {kind === "login" && (
        <>
          <span>{t("collab.banner_login")}</span>
          <button onClick={onLogin} className="shrink-0 underline font-bold cursor-pointer active:scale-95 transition-transform">
            {t("collab.banner_login_cta")}
          </button>
        </>
      )}
    </div>
  );
}
