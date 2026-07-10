/**
 * housing_listings への tags 書き込み前に、 personal_ タグの実在・自分所有・非表示チェックを行う
 * 共有ガード (register-listing / update-listing 両ハンドラから呼ぶ)。
 *
 * validateTags (housingValidation.ts) は同期関数のため Firestore にアクセスできず、
 * personal_ id は「形式が正しいか」までしか見ていない。 実在確認・所有者確認はこのファイルが
 * 非同期に行う (計画書 Phase B-2「検証: タグ配列に personal_ id が来たら personal_tags 存在 +
 * isHidden=false を確認」)。
 */
import { evaluatePersonalTagAttach } from '../../src/data/personalTags.js';
import { PERSONAL_TAG_ID_PREFIX } from '../../src/constants/housing.js';
import type { PersonalTag } from '../../src/types/housing.js';
import type { Firestore } from 'firebase-admin/firestore';

export class PersonalTagAttachError extends Error {
  rejectedTagId: string;
  reason: string;
  constructor(rejectedTagId: string, reason: string) {
    super(`personal_tag_attach_rejected:${reason}`);
    this.rejectedTagId = rejectedTagId;
    this.reason = reason;
  }
}

/**
 * tags 配列に含まれる personal_ id すべてについて、 自分が所有し isHidden=false であることを
 * 確認する。 違反があれば PersonalTagAttachError を throw する (呼び出し側で 400/403 に変換)。
 * 静的タグ (official_/season_/theme_) は対象外 (validateTags 側で既に検証済み)。
 */
export async function assertPersonalTagsAttachable(
  db: Firestore,
  tags: string[],
  requestingUid: string,
): Promise<void> {
  const personalTagIds = tags.filter((id) => id.startsWith(PERSONAL_TAG_ID_PREFIX));
  if (personalTagIds.length === 0) return;

  const col = db.collection('personal_tags');
  const snaps = await Promise.all(personalTagIds.map((id) => col.doc(id).get()));

  personalTagIds.forEach((id, i) => {
    const snap = snaps[i];
    const tag = snap.exists ? (snap.data() as PersonalTag) : undefined;
    const result = evaluatePersonalTagAttach(tag, requestingUid);
    if (!result.ok) {
      throw new PersonalTagAttachError(id, result.reason ?? 'unknown');
    }
  });
}
