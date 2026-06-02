import { describe, it, expect } from 'vitest';
import { computeElapsed, formatStopwatch, snapToSecond } from '../stopwatch';

describe('computeElapsed', () => {
    it('停止中(startedAt=null)は accumulated をそのまま秒で返す', () => {
        expect(computeElapsed(3000, null, 999999)).toBe(3);
    });
    it('計測中は accumulated + (now - startedAt) を秒で返す', () => {
        expect(computeElapsed(1000, 5000, 8000)).toBe(4); // 1s + 3s
    });
    it('ゼロから計測中', () => {
        expect(computeElapsed(0, 1000, 1500)).toBe(0.5);
    });
});

describe('formatStopwatch', () => {
    it('0 秒は 00:00.00', () => {
        expect(formatStopwatch(0)).toBe('00:00.00');
    });
    it('83.45 秒は 01:23.45', () => {
        expect(formatStopwatch(83.45)).toBe('01:23.45');
    });
    it('小数2位までで切り捨て(端数は伸ばさない)', () => {
        expect(formatStopwatch(83.459)).toBe('01:23.45');
    });
    it('分が2桁になる(例 600.0 → 10:00.00)', () => {
        expect(formatStopwatch(600)).toBe('10:00.00');
    });
});

describe('snapToSecond', () => {
    // タイムラインは整数秒グリッドなので、捕捉した小数秒を最も近い整数秒へ丸める
    it('10.29 → 10 (近い方が下)', () => {
        expect(snapToSecond(10.29)).toBe(10);
    });
    it('10.31 → 10 (近い方が下)', () => {
        expect(snapToSecond(10.31)).toBe(10);
    });
    it('10.5 → 11 (ちょうど半分は繰り上げ)', () => {
        expect(snapToSecond(10.5)).toBe(11);
    });
    it('10.49 → 10', () => {
        expect(snapToSecond(10.49)).toBe(10);
    });
    it('0 → 0', () => {
        expect(snapToSecond(0)).toBe(0);
    });
});
