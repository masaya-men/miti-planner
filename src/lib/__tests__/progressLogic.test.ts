import { describe, it, expect } from 'vitest';
import {
  makeDayKey, appendProgressPoint, removeProgressPoint, computeProgressPercent, isEmptyProgress,
  insertProgressPoint, phaseAtTime, pointPercent,
  formatClock, formatTimeOfDay, formatMonthDay, dayBucket,
} from '../progressLogic';
import type { PlanProgress, LocalizedString } from '../../types';

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

describe('insertProgressPoint', () => {
  it('指定 index に挿入し順序を保つ（Undo復元用）', () => {
    const base = [{ ts: 1, reachedPos: 10 }, { ts: 3, reachedPos: 30 }];
    expect(insertProgressPoint(base, 1, { ts: 2, reachedPos: 20 }))
      .toEqual([{ ts: 1, reachedPos: 10 }, { ts: 2, reachedPos: 20 }, { ts: 3, reachedPos: 30 }]);
  });
  it('範囲外 index はクランプ（末尾/先頭）', () => {
    expect(insertProgressPoint([{ ts: 1, reachedPos: 1 }], 99, { ts: 2, reachedPos: 2 }))
      .toEqual([{ ts: 1, reachedPos: 1 }, { ts: 2, reachedPos: 2 }]);
  });
  it('元配列を破壊しない / undefined 安全', () => {
    const base = [{ ts: 1, reachedPos: 1 }];
    insertProgressPoint(base, 0, { ts: 9, reachedPos: 9 });
    expect(base).toEqual([{ ts: 1, reachedPos: 1 }]);
    expect(insertProgressPoint(undefined, 0, { ts: 1, reachedPos: 1 })).toEqual([{ ts: 1, reachedPos: 1 }]);
  });
});

describe('phaseAtTime', () => {
  const phases = [
    { name: { ja: 'P1' } as LocalizedString, startTime: 0 },
    { name: { ja: 'P2' } as LocalizedString, startTime: 100 },
    { name: { ja: 'P3' } as LocalizedString, startTime: 200 },
  ];
  it('sec を含むフェーズ（startTime<=sec の最後）を返す', () => {
    expect(phaseAtTime(phases, 150)?.name).toEqual({ ja: 'P2' });
    expect(phaseAtTime(phases, 200)?.name).toEqual({ ja: 'P3' });
  });
  it('最初のフェーズより前 / フェーズ無しは null', () => {
    expect(phaseAtTime([{ name: { ja: 'P' } as LocalizedString, startTime: 50 }], 10)).toBeNull();
    expect(phaseAtTime([], 10)).toBeNull();
  });
  it('未ソートでも最大 startTime<=sec を選ぶ', () => {
    const unsorted = [
      { name: { ja: 'B' } as LocalizedString, startTime: 100 },
      { name: { ja: 'A' } as LocalizedString, startTime: 0 },
    ];
    expect(phaseAtTime(unsorted, 120)?.name).toEqual({ ja: 'B' });
  });
});

describe('pointPercent', () => {
  it('割合を 0〜100 に丸めクランプ', () => {
    expect(pointPercent(150, 300)).toBe(50);
    expect(pointPercent(400, 300)).toBe(100);
    expect(pointPercent(-5, 300)).toBe(0);
  });
  it('total<=0 は 0', () => {
    expect(pointPercent(50, 0)).toBe(0);
  });
});

describe('formatClock', () => {
  it('m:ss に整形', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(59)).toBe('0:59');
    expect(formatClock(225)).toBe('3:45');
  });
});

describe('formatTimeOfDay / formatMonthDay (JST)', () => {
  it('JST の時刻と月日', () => {
    // 2026-06-19T12:34:00Z = JST 21:34
    const ts = Date.parse('2026-06-19T12:34:00Z');
    expect(formatTimeOfDay(ts)).toBe('21:34');
    expect(formatMonthDay(ts)).toBe('6/19');
  });
});

describe('dayBucket (JST)', () => {
  it('今日 / 昨日 / それ以前を判定', () => {
    const now = Date.parse('2026-06-19T05:00:00Z'); // JST 6/19 14:00
    expect(dayBucket(Date.parse('2026-06-19T10:00:00Z'), now)).toBe('today');     // JST 6/19 19:00
    expect(dayBucket(Date.parse('2026-06-18T10:00:00Z'), now)).toBe('yesterday'); // JST 6/18 19:00
    expect(dayBucket(Date.parse('2026-06-17T10:00:00Z'), now)).toBe('older');
  });
});
