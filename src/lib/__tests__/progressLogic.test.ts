import { describe, it, expect } from 'vitest';
import { makeDayKey, appendProgressPoint, removeProgressPoint, computeProgressPercent, isEmptyProgress } from '../progressLogic';
import type { PlanProgress } from '../../types';

describe('makeDayKey', () => {
    it('JST の YYYY-MM-DD を返す', () => {
        // 2026-06-18T15:00:00Z = JST 2026-06-19 00:00
        expect(makeDayKey(new Date('2026-06-18T15:00:00Z'))).toBe('2026-06-19');
        // 2026-06-18T14:59:00Z = JST 2026-06-18 23:59
        expect(makeDayKey(new Date('2026-06-18T14:59:00Z'))).toBe('2026-06-18');
    });
});

describe('appendProgressPoint', () => {
    it('末尾に追加しクリック順を保つ', () => {
        const r = appendProgressPoint([{ ts: 1, reachedPos: 100 }], { ts: 2, reachedPos: 50 });
        expect(r).toEqual([{ ts: 1, reachedPos: 100 }, { ts: 2, reachedPos: 50 }]);
    });
    it('同じ日でも統合せず別の点として溜まる', () => {
        const base = [{ ts: 10, reachedPos: 80 }];
        const r1 = appendProgressPoint(base, { ts: 11, reachedPos: 120 });
        const r2 = appendProgressPoint(r1, { ts: 12, reachedPos: 40 });
        expect(r2).toEqual([{ ts: 10, reachedPos: 80 }, { ts: 11, reachedPos: 120 }, { ts: 12, reachedPos: 40 }]);
    });
    it('元配列を破壊しない', () => {
        const base = [{ ts: 1, reachedPos: 5 }];
        appendProgressPoint(base, { ts: 2, reachedPos: 9 });
        expect(base).toEqual([{ ts: 1, reachedPos: 5 }]);
    });
});

describe('removeProgressPoint', () => {
    it('指定インデックスの点だけ削除', () => {
        const r = removeProgressPoint([{ ts: 1, reachedPos: 1 }, { ts: 2, reachedPos: 2 }, { ts: 3, reachedPos: 3 }], 1);
        expect(r).toEqual([{ ts: 1, reachedPos: 1 }, { ts: 3, reachedPos: 3 }]);
    });
    it('範囲外インデックスは何も消さない', () => {
        const base = [{ ts: 1, reachedPos: 1 }];
        expect(removeProgressPoint(base, 5)).toEqual(base);
    });
});

describe('computeProgressPercent', () => {
    it('最高到達点 / 全長 * 100 を丸めて返す（最終点でなく最高値）', () => {
        const p: PlanProgress = { points: [{ ts: 1, reachedPos: 90 }, { ts: 2, reachedPos: 30 }], cleared: false };
        expect(computeProgressPercent(p, 300)).toBe(30); // 90/300=0.3（最終点30ではなく最高90を採用）
    });
    it('cleared なら全長に関係なく 100', () => {
        const p: PlanProgress = { points: [{ ts: 1, reachedPos: 30 }], cleared: true };
        expect(computeProgressPercent(p, 300)).toBe(100);
    });
    it('progress 未設定 or 全長0 or 点なしは 0', () => {
        expect(computeProgressPercent(undefined, 300)).toBe(0);
        expect(computeProgressPercent({ points: [], cleared: false }, 0)).toBe(0);
        expect(computeProgressPercent({ points: [], cleared: false }, 300)).toBe(0);
    });
    it('100 を超えない', () => {
        const p: PlanProgress = { points: [{ ts: 1, reachedPos: 400 }], cleared: false };
        expect(computeProgressPercent(p, 300)).toBe(100);
    });
});

describe('isEmptyProgress', () => {
    it('全て空なら true', () => {
        expect(isEmptyProgress(undefined)).toBe(true);
        expect(isEmptyProgress({ points: [], cleared: false })).toBe(true);
    });
    it('1点でもあれば false', () => {
        expect(isEmptyProgress({ points: [{ ts: 1, reachedPos: 1 }], cleared: false })).toBe(false);
        expect(isEmptyProgress({ points: [], cleared: true })).toBe(false);
        expect(isEmptyProgress({ points: [], cleared: false, activeDays: 3 })).toBe(false);
    });
});
