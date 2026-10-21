// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStableCallback } from '../useStableCallback';

describe('useStableCallback', () => {
    it('再レンダーしても返す関数の参照が同じ', () => {
        const { result, rerender } = renderHook(
            ({ fn }: { fn: (x: number) => number }) => useStableCallback(fn),
            { initialProps: { fn: (x: number) => x + 1 } },
        );
        const first = result.current;
        rerender({ fn: (x: number) => x + 2 });
        expect(result.current).toBe(first);
    });

    it('呼び出すと直近の再レンダーで渡した fn の結果を返す(古いクロージャを呼ばない)', () => {
        const { result, rerender } = renderHook(
            ({ fn }: { fn: (x: number) => number }) => useStableCallback(fn),
            { initialProps: { fn: (x: number) => x + 1 } },
        );
        expect(result.current(10)).toBe(11);

        rerender({ fn: (x: number) => x + 100 });
        expect(result.current(10)).toBe(110);
    });
});
