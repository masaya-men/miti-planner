// 管理画面「色の取り直し」の中身(進め方)。計算と送信は注入するので、画面なしで試験できる。
import { isColorComputed } from './housingColorFilter';
import { representativeUrlForColors, type ListingColors } from './housingColorFromUrl';

export interface BackfillTarget {
    id: string;
    imageMode?: string;
    ogImageUrl?: string;
    thumbnailPath?: string;
    colorFamilies?: string[];
    colorRule?: number;
}

export interface BackfillItem extends ListingColors {
    id: string;
}

export interface BackfillSendResult {
    written: number;
    rejected: { id: string }[];
}

export interface BackfillProgress {
    done: number;
    total: number;
    unreadable: number;
}

export interface BackfillResult {
    done: number;
    unreadable: { id: string }[];
}

/** 取り直しの対象 = 色が未計算(または古い決まり)で、代表の写真がある家。この画面で済ませた家は除く。 */
export function pendingForBackfill(listings: readonly BackfillTarget[], doneInSession: ReadonlySet<string>): BackfillTarget[] {
    return listings.filter((l) => !doneInSession.has(l.id) && !isColorComputed(l) && representativeUrlForColors(l) !== null);
}

/** 同時に concurrency 件まで走らせて、結果を入力と同じ順で返す。 */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
}

export interface RunBackfillOptions {
    targets: readonly BackfillTarget[];
    /** 写真の URL → 色。読めなければ null。 */
    compute: (url: string) => Promise<ListingColors | null>;
    /** 束を送る。final は常に false(版を進めるのは最後の「反映する」だけ)。 */
    send: (items: BackfillItem[], final: false) => Promise<BackfillSendResult>;
    batchSize?: number;
    concurrency?: number;
    shouldStop?: () => boolean;
    onProgress?: (p: BackfillProgress) => void;
}

/** 束(既定25件)ごとに、同時4件で色を計算 → 書き込みだけ送る。読めなかった家は送らず一覧に残す。 */
export async function runBackfill(opts: RunBackfillOptions): Promise<BackfillResult> {
    const { targets, compute, send, batchSize = 25, concurrency = 4, shouldStop, onProgress } = opts;
    let done = 0;
    const unreadable: { id: string }[] = [];
    for (let start = 0; start < targets.length; start += batchSize) {
        if (shouldStop?.()) break;
        const batch = targets.slice(start, start + batchSize);
        const computed = await mapLimit(batch, concurrency, async (t) => {
            const url = representativeUrlForColors(t);
            return { id: t.id, colors: url ? await compute(url) : null };
        });
        const items: BackfillItem[] = [];
        for (const c of computed) {
            if (c.colors) items.push({ id: c.id, ...c.colors });
            else unreadable.push({ id: c.id });
        }
        if (items.length > 0) {
            const res = await send(items, false);
            const rejected = new Set(res.rejected.map((r) => r.id));
            done += items.filter((i) => !rejected.has(i.id)).length;
            for (const id of rejected) unreadable.push({ id });
        }
        onProgress?.({ done, total: targets.length, unreadable: unreadable.length });
    }
    return { done, unreadable };
}
