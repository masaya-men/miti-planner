import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../../store/useAuthStore';
import { canRegister } from '../../../../lib/housingApiClient';
import type { User } from 'firebase/auth';

export function useRegistrationQuota(user: User | null) {
  // 登録枠残数 (canRegister の remaining/registrationCount)。取得失敗時は null にフォールバックし、
  // ガイドは残数行を出さない (throw させない = reference_housing_appcheck_headers)。
  // 管理者は無制限のため store の isAdmin で「管理者」表示に切り替える (サーバ側でも枠を免除)。
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [registrationCount, setRegistrationCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    canRegister()
      .then((res) => {
        if (!cancelled) {
          setRemaining(res.remaining);
          setRegistrationCount(res.registrationCount);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemaining(null);
          setRegistrationCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isAdmin, remaining, registrationCount };
}
