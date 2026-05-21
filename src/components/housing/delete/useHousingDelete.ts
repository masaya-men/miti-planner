/**
 * Phase 3 削除 API クライアントフック
 *
 * POST /api/housing?action=delete-listing
 *  - 認証: Bearer (Firebase Web SDK の現在ユーザー idToken)
 *  - soft delete (`deletedAt = Date.now()`)、 idempotent
 */
import { useState } from 'react';
import { buildHousingHeaders } from '../../../lib/housingAuthHeaders';

export interface UseHousingDeleteResult {
  ok: boolean;
  error?: string;
}

export function useHousingDelete() {
  const [loading, setLoading] = useState(false);

  async function deleteListing(listingId: string): Promise<UseHousingDeleteResult> {
    setLoading(true);
    try {
      const headers = await buildHousingHeaders(true);
      const res = await fetch('/api/housing?action=delete-listing', {
        method: 'POST',
        headers,
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
