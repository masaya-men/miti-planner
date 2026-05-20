/**
 * Phase 3 編集 API クライアントフック
 *
 * POST /api/housing?action=update-listing
 *  - 認証: Bearer (Firebase Web SDK の現在ユーザー idToken)
 *  - 失敗時は { ok: false, error } を返し、 親側で toast 表示する想定
 */
import { useState } from 'react';
import { getAuth } from 'firebase/auth';

export interface UseHousingUpdateResult {
  ok: boolean;
  error?: string;
}

export function useHousingUpdate() {
  const [loading, setLoading] = useState(false);

  async function update(
    listingId: string,
    updates: object,
  ): Promise<UseHousingUpdateResult> {
    setLoading(true);
    try {
      const user = getAuth().currentUser;
      if (!user) return { ok: false, error: 'unauthenticated' };
      const token = await user.getIdToken();
      const res = await fetch('/api/housing?action=update-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId, ...updates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data?.error ?? `http_${res.status}` };
      }
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown_error';
      return { ok: false, error: message };
    } finally {
      setLoading(false);
    }
  }

  return { update, loading };
}
