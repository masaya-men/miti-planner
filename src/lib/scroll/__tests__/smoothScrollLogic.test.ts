import { describe, it, expect } from 'vitest';
import { isSmoothScrollSupported, isAtScrollBoundary } from '../smoothScrollLogic';

function makeWindow(opts: { hoverHover: boolean; pointerFine: boolean; reduceMotion: boolean; matchMediaUndefined?: boolean }): Window {
    const matchMedia = (query: string): MediaQueryList => {
        let matches = false;
        if (query === '(prefers-reduced-motion: reduce)') matches = opts.reduceMotion;
        else if (query === '(hover: hover) and (pointer: fine)') matches = opts.hoverHover && opts.pointerFine;
        return { matches, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
    };
    const win: Partial<Window> = {};
    if (!opts.matchMediaUndefined) win.matchMedia = matchMedia;
    return win as Window;
}

describe('isSmoothScrollSupported', () => {
    it('PC (hover + pointer fine + 非 reduce-motion) なら true', () => {
        const win = makeWindow({ hoverHover: true, pointerFine: true, reduceMotion: false });
        expect(isSmoothScrollSupported(win)).toBe(true);
    });

    it('タッチ専用 (hover: none) なら false', () => {
        const win = makeWindow({ hoverHover: false, pointerFine: false, reduceMotion: false });
        expect(isSmoothScrollSupported(win)).toBe(false);
    });

    it('reduce-motion ON なら false (PC でも)', () => {
        const win = makeWindow({ hoverHover: true, pointerFine: true, reduceMotion: true });
        expect(isSmoothScrollSupported(win)).toBe(false);
    });

    it('matchMedia 未対応環境 (SSR / 古い browser) なら false', () => {
        const win = makeWindow({ hoverHover: true, pointerFine: true, reduceMotion: false, matchMediaUndefined: true });
        expect(isSmoothScrollSupported(win)).toBe(false);
    });

    it('hover あるが pointer 粗 (タッチパネル PC など) なら false', () => {
        const win = makeWindow({ hoverHover: true, pointerFine: false, reduceMotion: false });
        expect(isSmoothScrollSupported(win)).toBe(false);
    });
});

describe('isAtScrollBoundary', () => {
    it('top で上方向 (deltaY < 0) なら "top"', () => {
        // scrollTop=0, scrollHeight=1000, clientHeight=500, deltaY=-50
        expect(isAtScrollBoundary(0, 1000, 500, -50)).toBe('top');
    });

    it('bottom で下方向 (deltaY > 0) なら "bottom"', () => {
        // scrollTop=500 (=max), scrollHeight=1000, clientHeight=500, deltaY=50
        expect(isAtScrollBoundary(500, 1000, 500, 50)).toBe('bottom');
    });

    it('中間 (境界以外) なら null', () => {
        expect(isAtScrollBoundary(200, 1000, 500, 50)).toBeNull();
        expect(isAtScrollBoundary(200, 1000, 500, -50)).toBeNull();
    });

    it('スクロール不能 (max <= 0) なら null', () => {
        // content が viewport より小さい
        expect(isAtScrollBoundary(0, 400, 500, 50)).toBeNull();
        expect(isAtScrollBoundary(0, 400, 500, -50)).toBeNull();
    });

    it('top でも下方向なら null (境界だが反対方向)', () => {
        // scrollTop=0 でも deltaY>0 (下にスクロールしようとしている) → 境界扱いしない
        expect(isAtScrollBoundary(0, 1000, 500, 50)).toBeNull();
        // 同じく bottom で上方向
        expect(isAtScrollBoundary(500, 1000, 500, -50)).toBeNull();
    });
});
