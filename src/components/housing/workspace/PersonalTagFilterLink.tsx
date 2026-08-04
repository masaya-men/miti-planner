import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getHousingerProfile } from '../../../lib/housing/housingerProfileService';
import { ownerUidFromPersonalFilterId, stripHashedPrefix } from '../../../lib/housing/housingerProfile';
import type { HousingerProfile } from '../../../types/housing';

export interface PersonalTagFilterLinkProps {
  /** 探すページのタグフィルタのうち personal_ prefix のもの (FilterPanel/BrowsePage と同じ抽出)。 */
  tagIds: string[];
}

/**
 * 探すページで個人タグ 1 つに絞り込んでいるとき、結果一覧の上に
 * 「{{name}} のハウジンガーページを見る →」リンクを出す
 * (spec 2026-07-10-housinger-profile-design.md §3.3 統合契約4)。
 *
 * 2 つ以上選択されている状態は「絞り込み中」の意味が薄れる (どちらのページ?) ため、
 * ちょうど 1 つのときだけ表示する。 擬似タグ ID → uid の変換は ownerUidFromPersonalFilterId
 * (2026-08-04: personal_tags 廃止に伴い、housing_profiles を直接読むように変更)。
 */
export const PersonalTagFilterLink: React.FC<PersonalTagFilterLinkProps> = ({ tagIds }) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<HousingerProfile | null>(null);
  const soleTagId = tagIds.length === 1 ? tagIds[0] : null;
  const ownerUid = soleTagId ? ownerUidFromPersonalFilterId(soleTagId) : null;

  useEffect(() => {
    if (!ownerUid) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    getHousingerProfile(ownerUid).then((result) => {
      if (!cancelled) setProfile(result);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerUid]);

  if (!ownerUid || !profile) return null;

  return (
    <Link to={`/housing/housinger/${stripHashedPrefix(ownerUid)}`} className="housing-personal-tag-filter-link">
      {t('housing.housinger.viewPage', { name: profile.displayName })}
    </Link>
  );
};
