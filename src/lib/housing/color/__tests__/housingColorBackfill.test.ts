import { describe, it, expect, vi } from 'vitest';
import { pendingForBackfill, runBackfill, type BackfillItem } from '../housingColorBackfill';
import { PALETTE_RULE } from '../housingExtractPalette';

const sns = (id: string, extra: object = {}) => ({ id, imageMode: 'sns', ogImageUrl: `https://pbs.twimg.com/media/${id}.jpg`, ...extra });

describe('pendingForBackfill(取り直しの対象)', () => {
    it('未計算で写真のある家だけ。計算済み・古い決まり・写真なしを区別する', () => {
        const list = [
            sns('new'),
            sns('done', { colorFamilies: ['red'], colorRule: PALETTE_RULE }),
            sns('old', { colorFamilies: ['red'], colorRule: PALETTE_RULE - 1 }),
            { id: 'noimg', imageMode: 'none' },
            sns('empty', { colorFamilies: [], colorRule: PALETTE_RULE }),
        ];
        expect(pendingForBackfill(list, new Set()).map((l) => l.id)).toEqual(['new', 'old']);
    });
    it('この画面で済ませた家は飛ばす(公開一覧の更新前でも続きから)', () => {
        expect(pendingForBackfill([sns('a'), sns('b')], new Set(['a'])).map((l) => l.id)).toEqual(['b']);
    });
});

describe('runBackfill', () => {
    const colors = { colorFamilies: ['red'], colorRule: PALETTE_RULE };
    const targets = Array.from({ length: 60 }, (_, i) => sns(`x${i}`));

    it('25件ずつ送り、版は進めない(final:false)', async () => {
        const send = vi.fn(async (_items: BackfillItem[], _final: boolean) => ({ written: _items.length, rejected: [] as { id: string }[] }));
        const result = await runBackfill({ targets, compute: async () => colors, send, batchSize: 25, concurrency: 4 });
        expect(send.mock.calls.map((c) => c[0].length)).toEqual([25, 25, 10]);
        expect(send.mock.calls.every((c) => c[1] === false)).toBe(true);
        expect(result.done).toBe(60);
        expect(result.unreadable).toEqual([]);
    });
    it('同時に計算するのは concurrency 件まで', async () => {
        let running = 0;
        let peak = 0;
        const compute = async () => {
            running++;
            peak = Math.max(peak, running);
            await new Promise((r) => setTimeout(r, 2));
            running--;
            return colors;
        };
        await runBackfill({ targets: targets.slice(0, 20), compute, send: async (i) => ({ written: i.length, rejected: [] }), batchSize: 25, concurrency: 4 });
        expect(peak).toBeLessThanOrEqual(4);
        expect(peak).toBeGreaterThan(1);
    });
    it('読めなかった家は送らず、読めなかった一覧に出す', async () => {
        const send = vi.fn(async (items: BackfillItem[]) => ({ written: items.length, rejected: [] as { id: string }[] }));
        const result = await runBackfill({
            targets: targets.slice(0, 4),
            compute: async (url) => (url.includes('x1') ? null : colors),
            send, batchSize: 25, concurrency: 2,
        });
        expect(result.done).toBe(3);
        expect(result.unreadable.map((u) => u.id)).toEqual(['x1']);
        expect(send.mock.calls[0][0].map((i) => i.id)).toEqual(['x0', 'x2', 'x3']);
    });
    it('サーバーが断った家は読めなかった側に数える', async () => {
        const result = await runBackfill({
            targets: targets.slice(0, 2),
            compute: async () => colors,
            send: async () => ({ written: 1, rejected: [{ id: 'x1' }] }),
            batchSize: 25, concurrency: 2,
        });
        expect(result.done).toBe(1);
        expect(result.unreadable.map((u) => u.id)).toEqual(['x1']);
    });
    it('止めると、次の束に進まない', async () => {
        let stop = false;
        const send = vi.fn(async (items: BackfillItem[]) => { stop = true; return { written: items.length, rejected: [] as { id: string }[] }; });
        const result = await runBackfill({ targets, compute: async () => colors, send, batchSize: 25, concurrency: 4, shouldStop: () => stop });
        expect(send).toHaveBeenCalledTimes(1);
        expect(result.done).toBe(25);
    });
    it('進み具合を知らせる', async () => {
        const seen: number[] = [];
        await runBackfill({
            targets: targets.slice(0, 30), compute: async () => colors,
            send: async (i) => ({ written: i.length, rejected: [] }), batchSize: 25, concurrency: 4,
            onProgress: (p) => seen.push(p.done),
        });
        expect(seen.at(-1)).toBe(30);
    });
});
