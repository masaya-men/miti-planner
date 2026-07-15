/**
 * 詳細パネルの登録者行 (spec 2026-07-10-housinger-profile-design.md §4.2)。
 *
 * - 公開プロフィールがあるときだけ「小アイコン + 名前 のハウジング」をリンクとして表示し、
 *   クリックでハウジンガーページ (/housing/housinger/:uid) へ遷移する。
 * - 非公開・未取得・取得失敗はすべて useHousingerProfile が null に丸めるため、
 *   ここでは「profile が null なら行ごと消す (何も描画しない)」だけを扱えばよい
 *   (詳細は家が主役 = レイアウトを占有しない、 §6.3)。
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { stripHashedPrefix } from '../../../lib/housing/housingerProfile';
import { useHousingerProfile } from './useHousingerProfile';
import { HousingerAvatar } from './HousingerAvatar';

export interface HousingerBylineProps {
  ownerUid: string;
}

export const HousingerByline: React.FC<HousingerBylineProps> = ({ ownerUid }) => {
  const { t } = useTranslation();
  const { profile } = useHousingerProfile(ownerUid);

  if (!profile) return null;

  return (
    <Link to={`/housing/housinger/${stripHashedPrefix(ownerUid)}`} className="housing-detail-byline">
      <HousingerAvatar
        avatarUrl={profile.avatarUrl}
        name={profile.displayName}
        className="housing-detail-byline-avatar"
      />
      <span>{t('housing.housinger.byline', { name: profile.displayName })}</span>
    </Link>
  );
};
