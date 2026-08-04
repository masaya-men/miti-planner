/**
 * housing_profiles コレクションから「マイページを公開しているハウジンガー」を読む。
 *
 * listPublishedHousingers: 全件取得。 探すページ「タグ」ビューのハウジンガーセクション用
 * (design 2026-08-04-housing-tag-search-by-owner-design.md §3.1)。
 * 旧 personal_tags コレクション経由 (personalTagLookup.ts) を置き換える。
 *
 * firestore.rules: `isPublished==true && isModerationHidden==false` の housing_profiles は
 * 誰でも get/list 可能なので、 認証不要の直接読み。
 */
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { HousingerProfile } from '../../types/housing';

const COLLECTION = 'housing_profiles';

export interface PublishedHousinger extends HousingerProfile {
  uid: string;
}

/**
 * 並び替え用に、 先頭の英数字・かな・漢字等 (Unicode の「文字」「数字」カテゴリ) 以外の文字
 * (記号・絵文字・アンダースコア等) を取り除いたキーを作る (personalTagLookup.ts から移設、ロジック不変)。
 */
export function stripLeadingSymbolsForSort(s: string): string {
  const stripped = s.replace(/^[^\p{L}\p{N}]+/u, '');
  return stripped.length > 0 ? stripped : s;
}

export async function listPublishedHousingers(max = 500): Promise<PublishedHousinger[]> {
  try {
    const qref = query(
      collection(db, COLLECTION),
      where('isPublished', '==', true),
      where('isModerationHidden', '==', false),
      orderBy('displayNameLower'),
      limit(max),
    );
    const snap = await getDocs(qref);
    const housingers = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as HousingerProfile) }));
    return housingers.slice().sort((a, b) => (
      stripLeadingSymbolsForSort(a.displayNameLower).localeCompare(stripLeadingSymbolsForSort(b.displayNameLower), 'ja')
    ));
  } catch {
    return [];
  }
}
