import { describe, it, expect } from 'vitest';
import { decideLoadFull } from '../_logic.js';

describe('decideLoadFull progress', () => {
    it('ネスト data.progress から progressPoints と進捗スカラーを seed に載せる', () => {
        const r = decideLoadFull({
            version: 1,
            data: {
                timelineMitigations: [],
                progress: { points: [{ id: 'pt_a', ts: 1, reachedPos: 10 }], cleared: true, activeDays: 2 },
            } as any,
        });
        expect('deleted' in r).toBe(false);
        if (!('deleted' in r)) {
            expect(r.progressPoints).toEqual([{ id: 'pt_a', ts: 1, reachedPos: 10 }]);
            expect(r.progressCleared).toBe(true);
            expect(r.progressActiveDays).toBe(2);
        }
    });

    it('progress 欠落時は points=[] / スカラー=undefined', () => {
        const r = decideLoadFull({ version: 1, data: { timelineMitigations: [] } });
        if (!('deleted' in r)) {
            expect(r.progressPoints).toEqual([]);
            expect(r.progressCleared).toBeUndefined();
        }
    });
});
