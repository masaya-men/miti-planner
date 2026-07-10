import { useTranslation } from 'react-i18next';
import { useHousingModalStore } from '../../store/useHousingModalStore';

interface Props {
  context: 'register' | 'tour' | 'favorite';
  /**
   * context==='register' の場合に openLogin へ fromRegister を渡すかどうか。
   * 既定 true (旧挙動維持: HousingRegisterFormModal 等、旧ワークスペース経由のログイン誘導は
   * 「登録モーダルから開いた」ことを覚えておき、ログインを閉じたら登録モーダルも一緒に閉じる)。
   * 新シェル (RegisterPage) には syncFromUrl による `?register=open` 復元がなく、
   * fromRegister:true で開くと戻り URL の死にクエリになるため false を渡す。
   */
  registerFlag?: boolean;
}

/**
 * 未ログイン時のログイン案内 (登録/ツアー/お気に入り 共通)。
 *
 * 2026-07-10: LoPo 汎用トークン (bg-app-blue / text-app-* / Tailwind ユーティリティ) を撤去し、
 * ハウジング独自トンマナへ揃えた (housing-design.md)。青ボタンは世界観から浮くため、
 * ログイン = このページの主アクションとして **ハニーゴールド** (`.housing-btn-primary`) にする。
 * 版面は `TourEmptyState` と同じ「タイトル + リード + CTA の静かな中央寄せ空状態」パターン。
 * パネル中央への配置は housing.css 側 (`.housing-register-panel-solo`) が担う。
 */
export const HousingLoginPrompt: React.FC<Props> = ({ context, registerFlag = true }) => {
  const { t } = useTranslation();
  const openLogin = useHousingModalStore((s) => s.openLogin);

  const handleOpenLogin = () => {
    if (context === 'register') {
      openLogin({ fromRegister: registerFlag });
    } else {
      openLogin();
    }
  };

  return (
    <div className="housing-login-prompt" data-context={context}>
      <p className="housing-login-prompt-title">
        {t(`housing.login_prompt.${context}.title`)}
      </p>
      <p className="housing-login-prompt-lead">
        {t(`housing.login_prompt.${context}.lead`)}
      </p>
      <button
        type="button"
        onClick={handleOpenLogin}
        className="housing-action-btn housing-btn-primary housing-login-prompt-cta"
      >
        {t('housing.login_prompt.open_login')}
      </button>
    </div>
  );
};
