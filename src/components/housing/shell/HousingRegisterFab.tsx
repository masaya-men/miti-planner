import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';

/**
 * スマホ用「登録する」FAB (Task1: モバイルシェル基盤)。右下固定。
 * ログイン済みなら登録ページへ直接遷移、未ログインならログイン誘導 (fromRegister=true、
 * ログイン完了後に登録フローへ戻れるようにする)。
 * ツアー没入中は呼び出し側 (HousingShell) で非表示にする。
 */
export const HousingRegisterFab: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const openLogin = useHousingModalStore((s) => s.openLogin);

  const handleClick = () => {
    if (user) {
      navigate('/housing/register');
    } else {
      openLogin({ fromRegister: true });
    }
  };

  return (
    <button
      type="button"
      className="housing-mobile-fab"
      onClick={handleClick}
      aria-label={t('housing.workspace.register_cta.aria')}
    >
      <Plus size={24} aria-hidden="true" />
    </button>
  );
};
