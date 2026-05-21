/**
 * Phase 3 通報 API クライアントフック
 *
 * POST /api/housing?action=report-listing
 *  - 認証: Bearer (Firebase Web SDK の現在ユーザー idToken)
 *  - 失敗時は { ok: false, error } を返し、 親側で toast 表示する想定
 */
import { useState } from 'react';
import { buildHousingHeaders } from '../../../lib/housingAuthHeaders';
import type { ReportReason } from '../../../types/housing';

export interface UseHousingReportResult {
  ok: boolean;
  error?: string;
}

export function useHousingReport() {
  const [loading, setLoading] = useState(false);

  async function report(
    listingId: string,
    reason: ReportReason,
    comment?: string,
  ): Promise<UseHousingReportResult> {
    setLoading(true);
    try {
      const headers = await buildHousingHeaders(true);
      const res = await fetch('/api/housing?action=report-listing', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          listingId,
          reason,
          ...(comment ? { comment } : {}),
        }),
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

  return { report, loading };
}
