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

describe('decideLoadFull: id なし進捗点の normalize(旧形式互換)', () => {
    it('id なし点 2 件を含む points を渡すと、2 件とも id が補完されて返る(消えない)', () => {
        const r = decideLoadFull({
            version: 1,
            data: {
                timelineMitigations: [],
                progress: {
                    points: [
                        { ts: 1, reachedPos: 10 },  // id なし(旧形式)
                        { ts: 2, reachedPos: 20 },  // id なし(旧形式)
                    ],
                },
            } as any,
        });
        expect('deleted' in r).toBe(false);
        if (!('deleted' in r)) {
            // 2件とも保持(消えていない)
            expect(r.progressPoints).toHaveLength(2);
            // 両方とも id が補完されている
            expect((r.progressPoints[0] as any).id).toMatch(/^pt_/);
            expect((r.progressPoints[1] as any).id).toMatch(/^pt_/);
            // 2件の id は互いに異なる(dedupeById で消されない)
            expect((r.progressPoints[0] as any).id).not.toBe((r.progressPoints[1] as any).id);
            // 元データは保持
            expect((r.progressPoints[0] as any).reachedPos).toBe(10);
            expect((r.progressPoints[1] as any).reachedPos).toBe(20);
        }
    });

    it('既存 id を持つ点は id を変えずに保持する', () => {
        const r = decideLoadFull({
            version: 1,
            data: {
                timelineMitigations: [],
                progress: {
                    points: [{ id: 'pt_existing', ts: 1, reachedPos: 5 }],
                },
            } as any,
        });
        if (!('deleted' in r)) {
            expect((r.progressPoints[0] as any).id).toBe('pt_existing');
        }
    });
});
