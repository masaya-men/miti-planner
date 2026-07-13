import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getPersonalTagById } from '../../../lib/housing/personalTagLookup';
import type { PersonalTag } from '../../../types/housing';

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
 * ちょうど 1 つのときだけ表示する。 タグ→uid の解決は personal_tags/{tagId} の直接読み
 * (getPersonalTagById、 firestore.rules は isHidden===false のタグを公開 get 許可)。
 */
export const PersonalTagFilterLink: React.FC<PersonalTagFilterLinkProps> = ({ tagIds }) => {
  const { t } = useTranslation();
  const [tag, setTag] = useState<PersonalTag | null>(null);
  const soleTagId = tagIds.length === 1 ? tagIds[0] : null;

  useEffect(() => {
    if (!soleTagId) {
      setTag(null);
      return;
    }
    let cancelled = false;
    getPersonalTagById(soleTagId).then((result) => {
      if (!cancelled) setTag(result);
    });
    return () => {
      cancelled = true;
    };
  }, [soleTagId]);

  if (!soleTagId || !tag) return null;

  return (
    <Link to={`/housing/housinger/${tag.ownerUid}`} className="housing-personal-tag-filter-link">
      {t('housing.housinger.viewPage', { name: tag.displayName })}
    </Link>
  );
};
