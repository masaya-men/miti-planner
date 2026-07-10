import { useEffect, useState } from 'react';
import { getHousingerProfile } from '../../../lib/housing/housingerProfileService';
import type { HousingerProfile } from '../../../types/housing';

/**
 * ハウジンガー公開プロフィール取得 hook。
 * 詳細パネルの登録者行 (HousingerByline) / ハウジンガーページ (HousingerPage) から使う。
 *
 * getHousingerProfile はモジュール内セッションキャッシュを持つため、同一 uid を複数箇所で
 * 表示しても (invalidate されるまで) Firestore への読み取りは 1 回だけ。
 * uid が null のときは fetch せず profile=null / loading=false を返す。
 */
export interface UseHousingerProfileResult {
  profile: HousingerProfile | null;
  loading: boolean;
}

export function useHousingerProfile(uid: string | null): UseHousingerProfileResult {
  const [profile, setProfile] = useState<HousingerProfile | null>(null);
  const [loading, setLoading] = useState(!!uid);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const result = await getHousingerProfile(uid);
      if (cancelled) return;
      setProfile(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return { profile, loading };
}
