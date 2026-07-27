/**
 * personal_tags コレクションの読み取り。
 *
 * getPersonalTagById: 単発解決。探すページで個人タグ 1 つに絞り込んでいるとき、 結果一覧の上に
 * 「{{name}} のハウジンガーページを見る →」 リンクを出すために使う
 * (spec 2026-07-10-housinger-profile-design.md §3.3 統合契約4)。
 * タグ→uid の解決は personal_tags/{tagId}.ownerUid、 表示名は同ドキュメントの displayName。
 *
 * listAllPersonalTags: 全件取得。探すページ「タグ」ビューのハウジンガーセクション用
 * (design 2026-07-27-housing-tag-and-search-design.md §2)。
 *
 * firestore.rules: `isHidden===false` のタグは誰でも get/list 可能なので、 認証不要の直接読み。
 * 非公開/不存在/rules 拒否はすべて null または空配列に丸める (housingerProfileService と同方針)。
 */
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { PersonalTag } from '../../types/housing';

const COLLECTION = 'personal_tags';

export async function getPersonalTagById(tagId: string): Promise<PersonalTag | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, tagId));
    if (!snap.exists()) return null;
    return snap.data() as PersonalTag;
  } catch {
    return null;
  }
}

export async function listAllPersonalTags(max = 500): Promise<PersonalTag[]> {
  try {
    const qref = query(
      collection(db, COLLECTION),
      where('isHidden', '==', false),
      orderBy('displayNameLower'),
      limit(max),
    );
    const snap = await getDocs(qref);
    return snap.docs.map((d) => d.data() as PersonalTag);
  } catch {
    return [];
  }
}
