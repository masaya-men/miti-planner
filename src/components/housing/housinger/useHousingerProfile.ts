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
    // uid が別の非null値に切り替わった瞬間、 前の uid の profile を保持したままにすると
    // 「別人のプロフィールが一瞬表示される」 事故になる (HousingerPage は同一コンポーネントの
    // まま :uid だけ変わるルーティングを踏むため顕在化する)。 fetch 開始前に必ず null へ戻す。
    setProfile(null);
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
