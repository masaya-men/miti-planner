// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// framer-motion の exit アニメを除去し、isVisible に同期して即時 mount/unmount させる
vi.mock('framer-motion', () => ({
    motion: new Proxy({}, { get: () => (props: any) => <div {...props} /> }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

import { Tooltip } from '../Tooltip';

beforeEach(() => {
    vi.useFakeTimers();
    // happy-dom を PC 幅にして isMobile=false (モバイルはツールチップ非表示のため)
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
});
afterEach(() => {
    vi.useRealTimers();
});

describe('Tooltip ドラッグ時の残留防止 (回帰)', () => {
    it('ドラッグ開始 (document pointerdown) で表示中のツールチップが消える', () => {
        render(
            <Tooltip content="軽減情報">
                <button>icon</button>
            </Tooltip>,
        );

        // ホバー → delay 後に表示
        fireEvent.mouseEnter(screen.getByText('icon').parentElement!);
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect(screen.queryByText('軽減情報')).toBeTruthy();

        // ドラッグ開始: setPointerCapture により mouseleave は発火しない。
        // pointerdown を全体監視して強制的に閉じる (修正前はここで消えず残留する)。
        act(() => {
            document.dispatchEvent(new Event('pointerdown'));
        });
        expect(screen.queryByText('軽減情報')).toBeNull();
    });
});

describe('Tooltip below 配置の左右クランプ', () => {
    const setup = (below: boolean | undefined, x: number) => {
        // happy-dom はレイアウトしないので、ポップアップの幅・高さを固定する
        const w = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
        const h = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { value: 200, configurable: true });
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { value: 40, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
        render(<Tooltip content="TIP" below={below}><button>icon</button></Tooltip>);
        fireEvent.mouseEnter(screen.getByText('icon').parentElement!, { clientX: x, clientY: 100 });
        act(() => { vi.advanceTimersByTime(150); });
        act(() => { vi.advanceTimersByTime(50); });
        const left = parseFloat((screen.getByText('TIP') as HTMLElement).style.left);
        if (w) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', w);
        if (h) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', h);
        return left;
    };

    it('右端のカーソルでも右端が画面内(vw - 幅 - 8)に収まる', () => {
        expect(setup(true, 1270)).toBe(1280 - 200 - 8);
    });
    it('左端のカーソルでも左端が 8px 以上', () => {
        expect(setup(true, 10)).toBe(8);
    });
    it('below 無しは従来どおり右端で左側へ反転(カーソル x - 16 - 幅)', () => {
        expect(setup(undefined, 1270)).toBe(1270 - 16 - 200);
    });
});
