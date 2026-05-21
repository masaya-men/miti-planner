/**
 * 通報対処 + 自己復帰 API クライアントフック
 *
 * POST /api/housing?action=resolve-report
 *  - 認証: Bearer (Firebase Web SDK の現在ユーザー idToken) + ownerUid 認可
 *  - 「これは誤り (却下)」 / 「編集して修正」 から呼ぶ
 *  - escalation_required (自己復帰の上限超過) は { ok:false, escalation:true } を返す
 */
import { useState } from 'react';
import { buildHousingHeaders } from '../../../lib/housingAuthHeaders';

export interface UseResolveReportResult {
  ok: boolean;
  escalation?: boolean;
  error?: string;
}

export function useResolveReport() {
  const [loading, setLoading] = useState(false);

  async function resolve(listingId: string): Promise<UseResolveReportResult> {
    setLoading(true);
    try {
      const headers = await buildHousingHeaders(true);
      const res = await fetch('/api/housing?action=resolve-report', {
        method: 'POST',
        headers,
        body: JSON.stringify({ listingId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          ok: false,
          escalation: data?.error === 'escalation_required',
          error: data?.error ?? `http_${res.status}`,
        };
      }
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown_error';
      return { ok: false, error: message };
    } finally {
      setLoading(false);
    }
  }

  return { resolve, loading };
}
