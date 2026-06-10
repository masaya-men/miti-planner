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
