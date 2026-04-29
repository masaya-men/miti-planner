// @vitest-environment happy-dom
import { act, render } from '@testing-library/react';
import { AnimatedDamage } from '../AnimatedDamage';

describe('AnimatedDamage', () => {
    it('renders formatted value as per-character spans', () => {
        const { container } = render(<AnimatedDamage value={10000} />);
        const slot = container.querySelector('.dmg-slot');
        expect(slot).toBeTruthy();
        const chars = slot!.querySelectorAll('.ch');
        // "10,000" => 6 文字
        expect(chars).toHaveLength(6);
        expect(slot!.textContent).toBe('10,000');
    });

    it('does NOT replace DOM when value is unchanged', () => {
        const { container, rerender } = render(<AnimatedDamage value={10000} />);
        const firstSpan = container.querySelector('.ch');
        rerender(<AnimatedDamage value={10000} />);
        const sameSpan = container.querySelector('.ch');
        // DOM 要素そのものが同一参照であること
        expect(sameSpan).toBe(firstSpan);
    });

    it('on value change, transitions through exit then enter phases', () => {
        vi.useFakeTimers();
        try {
            const { container, rerender } = render(<AnimatedDamage value={10000} />);
            // 初回: exit / enter クラスは無し
            expect(container.querySelectorAll('.ch.exit')).toHaveLength(0);
            expect(container.querySelectorAll('.ch.enter')).toHaveLength(0);

            rerender(<AnimatedDamage value={7000} />);

            // 値変化直後: 旧文字列が exit クラス、新文字列はまだ無し
            const exitChars = container.querySelectorAll('.ch.exit');
            expect(exitChars).toHaveLength(6); // "10,000"
            expect(container.querySelectorAll('.ch.enter')).toHaveLength(0);

            // exit 完了 + micro_delay 経過後
            // exit 120ms + stagger 10ms × 5 = 170ms + delay 10ms = 180ms
            act(() => {
                vi.advanceTimersByTime(180);
            });

            const enterChars = container.querySelectorAll('.ch.enter');
            expect(enterChars).toHaveLength(5); // "7,000"
            expect(container.querySelectorAll('.ch.exit')).toHaveLength(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not animate on initial mount', () => {
        const { container } = render(<AnimatedDamage value={10000} />);
        // 初回マウント: enter クラスは付かない（即静止表示）
        expect(container.querySelectorAll('.ch.enter')).toHaveLength(0);
        expect(container.querySelectorAll('.ch.exit')).toHaveLength(0);
        // 文字は表示されている
        expect(container.querySelector('.dmg-slot')!.textContent).toBe('10,000');
    });
});
