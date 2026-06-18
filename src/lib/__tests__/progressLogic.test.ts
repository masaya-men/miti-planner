import { describe, it, expect } from 'vitest';
import { makeDayKey, mergeDailyBest, removeDay, computeProgressPercent, isEmptyProgress } from '../progressLogic';
import type { PlanProgress } from '../../types';

describe('makeDayKey', () => {
    it('JST の YYYY-MM-DD を返す', () => {
        // 2026-06-18T15:00:00Z = JST 2026-06-19 00:00
        expect(makeDayKey(new Date('2026-06-18T15:00:00Z'))).toBe('2026-06-19');
        // 2026-06-18T14:59:00Z = JST 2026-06-18 23:59
        expect(makeDayKey(new Date('2026-06-18T14:59:00Z'))).toBe('2026-06-18');
    });
});

describe('mergeDailyBest', () => {
    it('新しい日を追加し日付昇順を保つ', () => {
        const r = mergeDailyBest([{ day: '2026-06-17', reachedPos: 100 }], { day: '2026-06-18', reachedPos: 50 });
        expect(r).toEqual([{ day: '2026-06-17', reachedPos: 100 }, { day: '2026-06-18', reachedPos: 50 }]);
    });
    it('同じ日は最高到達点に統合（より大きい時だけ更新）', () => {
        const base = [{ day: '2026-06-18', reachedPos: 80 }];
        expect(mergeDailyBest(base, { day: '2026-06-18', reachedPos: 120 })).toEqual([{ day: '2026-06-18', reachedPos: 120 }]);
        expect(mergeDailyBest(base, { day: '2026-06-18', reachedPos: 40 })).toEqual([{ day: '2026-06-18', reachedPos: 80 }]);
    });
    it('順不同の既存リストでも昇順に整列して返す', () => {
        const r = mergeDailyBest([{ day: '2026-06-18', reachedPos: 10 }], { day: '2026-06-16', reachedPos: 5 });
        expect(r.map(d => d.day)).toEqual(['2026-06-16', '2026-06-18']);
    });
});

describe('removeDay', () => {
    it('指定日の点だけ削除', () => {
        const r = removeDay([{ day: '2026-06-17', reachedPos: 1 }, { day: '2026-06-18', reachedPos: 2 }], '2026-06-17');
        expect(r).toEqual([{ day: '2026-06-18', reachedPos: 2 }]);
    });
});

describe('computeProgressPercent', () => {
    it('最高到達点 / 全長 * 100 を丸めて返す', () => {
        const p: PlanProgress = { dailyBest: [{ day: 'a', reachedPos: 30 }, { day: 'b', reachedPos: 90 }], cleared: false };
        expect(computeProgressPercent(p, 300)).toBe(30); // 90/300=0.3
    });
    it('cleared なら全長に関係なく 100', () => {
        const p: PlanProgress = { dailyBest: [{ day: 'a', reachedPos: 30 }], cleared: true };
        expect(computeProgressPercent(p, 300)).toBe(100);
    });
    it('progress 未設定 or 全長0 は 0', () => {
        expect(computeProgressPercent(undefined, 300)).toBe(0);
        expect(computeProgressPercent({ dailyBest: [], cleared: false }, 0)).toBe(0);
    });
    it('100 を超えない', () => {
        const p: PlanProgress = { dailyBest: [{ day: 'a', reachedPos: 400 }], cleared: false };
        expect(computeProgressPercent(p, 300)).toBe(100);
    });
});

describe('isEmptyProgress', () => {
    it('全て空なら true', () => {
        expect(isEmptyProgress(undefined)).toBe(true);
        expect(isEmptyProgress({ dailyBest: [], cleared: false })).toBe(true);
    });
    it('1点でもあれば false', () => {
        expect(isEmptyProgress({ dailyBest: [{ day: 'a', reachedPos: 1 }], cleared: false })).toBe(false);
        expect(isEmptyProgress({ dailyBest: [], cleared: true })).toBe(false);
        expect(isEmptyProgress({ dailyBest: [], cleared: false, activeDays: 3 })).toBe(false);
    });
});
