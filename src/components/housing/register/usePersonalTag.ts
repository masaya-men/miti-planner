/**
 * 自分の個人タグ (personal_tags) を取得するフック。
 *
 * タグ刷新 Phase B とハウジンガーPF の統合契約1 (spec §3.3) により、 個人タグの作成・更新は
 * ハウジンガープロフィールの公開/保存 (upsert-housinger-profile) に一本化された。 このフックは
 * 「自分のタグを取得して TagPicker『個人』タブに表示する」 読み取り専用の役割のみを持つ
 * (旧: 名前入力→作成 UI もここで扱っていたが廃止)。
 *
 * isPublished は「自分のタグが存在し、 かつ isHidden===false (= 公開中で運営強制非表示でもない)」
 * で判定する。 これは upsert ハンドラが書き込む isHidden の定義 (`!(isPublished && !isModerationHidden)`)
 * と同値なので、 housing_profiles を別途読む必要がない。
 *
 * 呼び出し元 (HousingRegisterTagPicker) は登録フォーム内でのみマウントされ、
 * 登録フォーム自体がログイン必須ゲートの内側にあるため、 このフックは認証済み前提で良い。
 */
import { useEffect, useState } from 'react';
import { getMyPersonalTag } from '../../../lib/personalTagApiClient';
import type { PersonalTag } from '../../../types/housing';

export function usePersonalTag() {
  // undefined = 読み込み中、 null = タグ無し (未公開)、 PersonalTag = 取得済み
  const [tag, setTag] = useState<PersonalTag | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getMyPersonalTag()
      .then((t) => { if (!cancelled) setTag(t); })
      .catch(() => { if (!cancelled) setTag(null); });
    return () => { cancelled = true; };
  }, []);

  const loading = tag === undefined;
  const isPublished = !loading && !!tag && tag.isHidden === false;

  return { tag: tag ?? null, loading, isPublished };
}
