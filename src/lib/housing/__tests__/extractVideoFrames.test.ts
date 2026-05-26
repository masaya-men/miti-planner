import { describe, it, expect } from 'vitest';
import { computeSeekSeconds } from '../extractVideoFrames';

describe('computeSeekSeconds', () => {
    it('duration が 0 以下なら空配列', () => {
        expect(computeSeekSeconds(0, [0, 0.25, 0.5])).toEqual([]);
        expect(computeSeekSeconds(-5, [0, 0.25, 0.5])).toEqual([]);
    });

    it('duration が NaN/Infinity なら空配列', () => {
        expect(computeSeekSeconds(Number.NaN, [0, 0.5])).toEqual([]);
        expect(computeSeekSeconds(Number.POSITIVE_INFINITY, [0, 0.5])).toEqual([]);
    });

    it('通常ケース: 0/25%/50% を秒に変換、 0.01s 精度', () => {
        const out = computeSeekSeconds(10, [0, 0.25, 0.5]);
        expect(out).toEqual([0, 2.5, 5]);
    });

    it('結果は昇順 sort される (fractions の順序に依存しない)', () => {
        const out = computeSeekSeconds(10, [0.5, 0, 0.25]);
        expect(out).toEqual([0, 2.5, 5]);
    });

    it('短い動画で異なる fraction が同じ秒数に丸まったら dedup', () => {
        // duration=0.04s, fractions 0.25/0.5/0.75 → 0.01s/0.02s/0.03s で別だが、
        // duration=0.02s では 0.25/0.5/0.75 全部 0/0.01/0.01 → dedup されて 2 件
        const out = computeSeekSeconds(0.02, [0.25, 0.5, 0.75]);
        expect(out).toEqual([0.01, 0.02]); // 0.99 で clamp された 0.75 が 0.02 になる
    });

    it('fraction > 1 は 0.99 に clamp (末尾の dark/end-card 回避)', () => {
        const out = computeSeekSeconds(100, [0, 1.5]);
        // 1.5 が 0.99 に clamp、 99s に丸められる
        expect(out).toEqual([0, 99]);
    });

    it('fraction < 0 は 0 に clamp', () => {
        const out = computeSeekSeconds(100, [-0.5, 0.5]);
        expect(out).toEqual([0, 50]);
    });

    it('fraction が NaN/Infinity の要素はスキップ', () => {
        const out = computeSeekSeconds(10, [0, Number.NaN, 0.5, Number.POSITIVE_INFINITY]);
        expect(out).toEqual([0, 5]);
    });

    it('fractions が空なら空配列', () => {
        expect(computeSeekSeconds(10, [])).toEqual([]);
    });
});
