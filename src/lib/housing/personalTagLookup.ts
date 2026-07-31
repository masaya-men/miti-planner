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

/**
 * 並び替え用に、 先頭の英数字・かな・漢字等 (Unicode の「文字」「数字」カテゴリ) 以外の文字
 * (記号・絵文字・アンダースコア等) を取り除いたキーを作る。
 *
 * Firestore の `orderBy('displayNameLower')` は単純な Unicode コードポイント比較のため、
 * `#Ephemeral_studio` のように記号始まりの名前が `A` 始まりの名前より前に来てしまう
 * (`#` のコードポイントが `A` より小さいため)。 「記号を無視して実際の文字で並べたい」 という
 * 要望に対応するため、 クライアント側でこのキーを使って再ソートする (listAllPersonalTags)。
 *
 * 記号のみの名前等、 取り除いた結果が空文字になる極端なケースは元の文字列にフォールバックする。
 */
export function stripLeadingSymbolsForSort(s: string): string {
  const stripped = s.replace(/^[^\p{L}\p{N}]+/u, '');
  return stripped.length > 0 ? stripped : s;
}

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
    const tags = snap.docs.map((d) => d.data() as PersonalTag);
    // Firestore 自体の orderBy はそのまま (既存の複合索引を使い続けるため)、
    // 記号を無視した並びはここでクライアント側に再ソートして反映する。
    return tags.slice().sort((a, b) => (
      stripLeadingSymbolsForSort(a.displayNameLower).localeCompare(stripLeadingSymbolsForSort(b.displayNameLower))
    ));
  } catch {
    return [];
  }
}
