/**
 * Phase 3 削除 API クライアントフック
 *
 * POST /api/housing?action=delete-listing
 *  - 認証: Bearer (Firebase Web SDK の現在ユーザー idToken)
 *  - soft delete (`deletedAt = Date.now()`)、 idempotent
 */
import { useState } from 'react';
import { getAuth } from 'firebase/auth';

export interface UseHousingDeleteResult {
  ok: boolean;
  error?: string;
}

export function useHousingDelete() {
  const [loading, setLoading] = useState(false);

  async function deleteListing(listingId: string): Promise<UseHousingDeleteResult> {
    setLoading(true);
    try {
      const user = getAuth().currentUser;
      if (!user) return { ok: false, error: 'unauthenticated' };
      const token = await user.getIdToken();
      const res = await fetch('/api/housing?action=delete-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId }),
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

  return { deleteListing, loading };
}
