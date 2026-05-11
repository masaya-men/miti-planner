// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSmoothWheelScroll } from '../useSmoothWheelScroll';

function setMatchMediaPc(): void {
    window.matchMedia = ((query: string) => {
        let matches = false;
        if (query === '(hover: hover) and (pointer: fine)') matches = true;
        return { matches, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
    }) as Window['matchMedia'];
}

function makeScrollableEl(scrollHeight: number, clientHeight: number, initialScrollTop = 0): HTMLDivElement {
    const el = document.createElement('div');
    document.body.appendChild(el);
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
    el.scrollTop = initialScrollTop;
    return el;
}

beforeEach(() => {
    setMatchMediaPc();
    document.body.innerHTML = '';
});

describe('useSmoothWheelScroll', () => {
    it('境界 (scrollTop=0 で上方向) では preventDefault を呼ばない (親に伝播させる)', () => {
        const el = makeScrollableEl(1000, 500, 0);
        const refObj = { current: el };
        renderHook(() => useSmoothWheelScroll(refObj as React.RefObject<HTMLElement | null>));

        const event = new WheelEvent('wheel', { deltaY: -50, bubbles: true, cancelable: true });
        const preventSpy = (event.preventDefault = (() => { (event as unknown as { _prevented: boolean })._prevented = true; }) as () => void);
        el.dispatchEvent(event);
        expect((event as unknown as { _prevented?: boolean })._prevented).not.toBe(true);
    });

    it('中間位置で wheel → preventDefault が呼ばれて scrollTop が変化する (raf 1 フレーム後)', async () => {
        const el = makeScrollableEl(1000, 500, 200);
        const refObj = { current: el };
        renderHook(() => useSmoothWheelScroll(refObj as React.RefObject<HTMLElement | null>));

        const event = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true });
        el.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        // raf 駆動なので 1 フレーム進める
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        expect(el.scrollTop).toBeGreaterThan(200);  // 下方向に進んだ
    });

    it('外部 scrollTop 急変 (>10px) で内部 state がリセットされる', async () => {
        const el = makeScrollableEl(1000, 500, 200);
        const refObj = { current: el };
        renderHook(() => useSmoothWheelScroll(refObj as React.RefObject<HTMLElement | null>));

        // wheel で spring を起動
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

        // 外部から大きく scrollTop を書き換える (scrollIntoView 等を想定)
        const before = el.scrollTop;
        el.scrollTop = 600;  // 大きくジャンプ
        el.dispatchEvent(new Event('scroll'));

        // state リセットされたので、 raf が止まる → scrollTop はそれ以上動かない
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        expect(el.scrollTop).toBe(600);  // 外部設定値から動かない (前の spring の慣性が消えた)
        expect(before).not.toBe(600);  // sanity: before は 600 でなかった
    });
});
