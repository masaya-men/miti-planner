import { describe, it, expect } from 'vitest';
import { rowPropsEqual } from '../rowPropsEqual';

describe('rowPropsEqual', () => {
    it('配列キー: 中身が同じ新しい配列(参照は別)なら true', () => {
        const prev = { events: [1, 2, 3], other: 'x' };
        const next = { events: [1, 2, 3], other: 'x' };
        expect(prev.events).not.toBe(next.events);
        expect(rowPropsEqual(prev, next, ['events'])).toBe(true);
    });

    it('配列キー: 要素が1つ違えば false', () => {
        const prev = { events: [1, 2, 3] };
        const next = { events: [1, 2, 9] };
        expect(rowPropsEqual(prev, next, ['events'])).toBe(false);
    });

    it('配列キー: 長さが違えば false', () => {
        const prev = { events: [1, 2, 3] };
        const next = { events: [1, 2] };
        expect(rowPropsEqual(prev, next, ['events'])).toBe(false);
    });

    it('配列以外のprop(真偽値)が違えば false', () => {
        const prev = { flag: true };
        const next = { flag: false };
        expect(rowPropsEqual(prev, next, [])).toBe(false);
    });

    it('配列以外のprop(オブジェクト参照)が違えば false(内容が同じでも参照比較)', () => {
        const prev = { obj: { a: 1 } };
        const next = { obj: { a: 1 } };
        expect(rowPropsEqual(prev, next, [])).toBe(false);
    });

    it('配列以外のprop(関数参照)が違えば false', () => {
        const prev = { fn: () => 1 };
        const next = { fn: () => 1 };
        expect(rowPropsEqual(prev, next, [])).toBe(false);
    });

    it('片方にだけキーがあれば false', () => {
        const prev = { a: 1, b: 2 };
        const next = { a: 1 };
        expect(rowPropsEqual(prev, next, [])).toBe(false);
    });

    it('全キー一致(配列以外・同一参照込み)なら true', () => {
        const shared = { a: 1, b: 'x', c: true };
        expect(rowPropsEqual(shared, { ...shared }, [])).toBe(true);
    });
});
