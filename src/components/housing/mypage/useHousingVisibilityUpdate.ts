/**
 * マイページ一覧のワンクリック公開状態切替 API クライアントフック
 *
 * POST /api/housing?action=update-visibility
 *  - 認証: Bearer (Firebase Web SDK の現在ユーザー idToken)
 *  - 失敗時は { ok: false, error } を返し、 呼び出し側で toast 表示する想定
 */
import { useState } from 'react';
import { buildHousingHeaders } from '../../../lib/housingAuthHeaders';

export type HousingVisibilityValue = 'public' | 'unlisted' | 'private';

export interface UseHousingVisibilityUpdateResult {
  ok: boolean;
  error?: string;
}

export function useHousingVisibilityUpdate() {
  const [loading, setLoading] = useState(false);

  async function updateVisibility(
    listingId: string,
    visibility: HousingVisibilityValue,
  ): Promise<UseHousingVisibilityUpdateResult> {
    setLoading(true);
    try {
      const headers = await buildHousingHeaders(true);
      const res = await fetch('/api/housing?action=update-visibility', {
        method: 'POST',
        headers,
        body: JSON.stringify({ listingId, visibility }),
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

  return { updateVisibility, loading };
}
