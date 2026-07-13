/**
 * personal_tags/{tagId} の単発解決。
 *
 * 探すページで個人タグ 1 つに絞り込んでいるとき、 結果一覧の上に
 * 「{{name}} のハウジンガーページを見る →」 リンクを出すために使う
 * (spec 2026-07-10-housinger-profile-design.md §3.3 統合契約4)。
 * タグ→uid の解決は personal_tags/{tagId}.ownerUid、 表示名は同ドキュメントの displayName。
 *
 * firestore.rules: `isHidden===false` のタグは誰でも get 可能なので、 認証不要の直接読み。
 * 非公開/不存在/rules 拒否はすべて null に丸める (housingerProfileService.getHousingerProfile と同方針)。
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { PersonalTag } from '../../types/housing';

export async function getPersonalTagById(tagId: string): Promise<PersonalTag | null> {
  try {
    const snap = await getDoc(doc(db, 'personal_tags', tagId));
    if (!snap.exists()) return null;
    return snap.data() as PersonalTag;
  } catch {
    return null;
  }
}
