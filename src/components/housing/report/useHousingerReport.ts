/**
 * Task 9: ハウジンガープロフィール通報 API クライアントフック。
 * useHousingReport.ts (listing 通報) と同形だが、 対象は housingerUid で
 * POST /api/housing?action=report-housinger を叩く (api/housing/_reportHousingerHandler.ts)。
 *
 * 認証: Bearer (Firebase Web SDK の現在ユーザー idToken)
 * 失敗時は { ok: false, error } を返し、 親側 (HousingerReportModal) で toast 表示する想定。
 */
import { useState } from 'react';
import { buildHousingHeaders } from '../../../lib/housingAuthHeaders';
import type { HousingerReportReason } from '../../../lib/housing/housingerProfile';

export interface UseHousingerReportResult {
  ok: boolean;
  error?: string;
}

export function useHousingerReport() {
  const [loading, setLoading] = useState(false);

  async function report(
    housingerUid: string,
    reason: HousingerReportReason,
    comment?: string,
  ): Promise<UseHousingerReportResult> {
    setLoading(true);
    try {
      const headers = await buildHousingHeaders(true);
      const res = await fetch('/api/housing?action=report-housinger', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          housingerUid,
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
