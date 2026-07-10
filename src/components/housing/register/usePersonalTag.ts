/**
 * 自分の個人タグ (personal_tags) を取得・作成するフック。
 * 計画書 Phase B-3: TagPicker「個人」タブの「自分のタグ作成 (未作成時)」に使う。
 *
 * 呼び出し元 (HousingRegisterTagPicker) は登録フォーム内でのみマウントされ、
 * 登録フォーム自体がログイン必須ゲートの内側にあるため、 このフックは認証済み前提で良い。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  createPersonalTag,
  getMyPersonalTag,
  PersonalTagAlreadyExistsError,
  PersonalTagLimitReachedError,
} from '../../../lib/personalTagApiClient';
import type { PersonalTag } from '../../../types/housing';

export type PersonalTagCreateError = 'required' | 'too_long' | 'limit_reached' | 'generic';

export function usePersonalTag() {
  // undefined = 読み込み中、 null = 未作成、 PersonalTag = 作成済み
  const [tag, setTag] = useState<PersonalTag | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<PersonalTagCreateError | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyPersonalTag()
      .then((t) => { if (!cancelled) setTag(t); })
      .catch(() => { if (!cancelled) setTag(null); });
    return () => { cancelled = true; };
  }, []);

  const create = useCallback(async (displayName: string): Promise<PersonalTag | null> => {
    setError(null);
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      setError('required');
      return null;
    }
    setCreating(true);
    try {
      const created = await createPersonalTag(trimmed);
      setTag(created);
      return created;
    } catch (e) {
      if (e instanceof PersonalTagAlreadyExistsError) {
        // race: 別タブ等で既に作成済みだった。 最新状態に同期する。
        setTag(e.existingTag);
        return e.existingTag;
      }
      if (e instanceof PersonalTagLimitReachedError) {
        setError('limit_reached');
      } else if (e instanceof Error && e.message === 'invalid_display_name') {
        setError('too_long');
      } else {
        setError('generic');
      }
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  return { tag, loading: tag === undefined, creating, error, create };
}
