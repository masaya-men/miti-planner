import { describe, it, expect } from 'vitest';
import { isSmoothScrollSupported } from '../smoothScrollLogic';

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

    it('PC かつ reduce-motion 両方 ON の場合は reduce-motion 優先で false', () => {
        const win = makeWindow({ hoverHover: true, pointerFine: true, reduceMotion: true });
        expect(isSmoothScrollSupported(win)).toBe(false);
    });
});
