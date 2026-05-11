// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSmoothScroll } from '../useSmoothScroll';

// vi.hoisted() で変数を hoist してからモック定義
const { lenisCtor, lenisDestroy } = vi.hoisted(() => ({
    lenisCtor: vi.fn(),
    lenisDestroy: vi.fn(),
}));

vi.mock('lenis', () => {
    return {
        default: vi.fn(function (opts: unknown) {
            lenisCtor(opts);
            return {
                raf: vi.fn(),
                destroy: lenisDestroy,
            };
        }),
    };
});

function setMatchMedia(opts: { hover: boolean; pointer: boolean; reduce: boolean }): void {
    window.matchMedia = ((query: string) => {
        let matches = false;
        if (query === '(prefers-reduced-motion: reduce)') matches = opts.reduce;
        else if (query === '(hover: hover) and (pointer: fine)') matches = opts.hover && opts.pointer;
        return { matches, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
    }) as Window['matchMedia'];
}

beforeEach(() => {
    lenisCtor.mockClear();
    lenisDestroy.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useSmoothScroll', () => {
    it('reduce-motion ON のときは Lenis インスタンスを作らない', () => {
        setMatchMedia({ hover: true, pointer: true, reduce: true });
        renderHook(() => useSmoothScroll());
        expect(lenisCtor).not.toHaveBeenCalled();
    });

    it('PC + 非 reduce-motion で Lenis 生成 + unmount で destroy 呼ばれる', () => {
        setMatchMedia({ hover: true, pointer: true, reduce: false });
        const { unmount } = renderHook(() => useSmoothScroll());
        expect(lenisCtor).toHaveBeenCalledOnce();
        expect(lenisDestroy).not.toHaveBeenCalled();
        unmount();
        expect(lenisDestroy).toHaveBeenCalledOnce();
    });
});
