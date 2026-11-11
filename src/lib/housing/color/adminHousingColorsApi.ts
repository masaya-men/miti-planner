// 管理画面「色の取り直し」から /api/admin?resource=housing_colors を呼ぶ。
import { apiFetch } from '../../apiClient';
import type { BackfillItem, BackfillSendResult } from './housingColorBackfill';

/** 色を書き込む(final:false)/ 最後に版を 1 回だけ進めて全件ファイルを作り直す(final:true)。 */
export async function patchHousingColors(items: BackfillItem[], final: boolean): Promise<BackfillSendResult & { published: boolean }> {
    const res = await apiFetch('/api/admin?resource=housing_colors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, final }),
    });
    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `housing_colors failed: ${res.status}`);
    }
    const body = (await res.json()) as { written: number; rejected: { id: string }[]; published: boolean };
    return { written: body.written, rejected: body.rejected ?? [], published: body.published };
}
