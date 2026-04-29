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

            // exit 完了 + micro_delay + rAF 経過後
            // exit 120ms + stagger 10ms × 5 = 170ms + delay 10ms = 180ms
            // + requestAnimationFrame 1 frame (~16ms) を吸収するため余裕を持って 200ms
            act(() => {
                vi.advanceTimersByTime(200);
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

    it('cancels mid-swap and jumps to latest value on rapid changes', () => {
        vi.useFakeTimers();
        try {
            const { container, rerender } = render(<AnimatedDamage value={10000} />);
            expect(container.querySelector('.dmg-slot')!.textContent).toBe('10,000');

            // 1 回目の変更（mid-swap 状態に入る）
            act(() => {
                rerender(<AnimatedDamage value={7000} />);
            });
            // 直後: exiting に旧値、entering は空
            expect(container.querySelectorAll('.ch.exit')).toHaveLength(6);
            expect(container.querySelectorAll('.ch.enter')).toHaveLength(0);

            act(() => {
                vi.advanceTimersByTime(50); // exit 中
            });

            // 2 回目の変更（mid-swap 中の割り込み）
            act(() => {
                rerender(<AnimatedDamage value={5000} />);
            });

            // exit クラスは消え、即 enter で 5000 が表示される
            // （実装上は exiting=[], entering=[5,000] の即遷移）
            expect(container.querySelector('.dmg-slot')!.textContent).toBe('5,000');
            // 新しい文字列に enter クラスが付いていること
            expect(container.querySelectorAll('.ch.enter')).toHaveLength(5); // "5,000"
            // 古い "7,000" は残っていない
            const allText = container.textContent;
            expect(allText).not.toContain('7,000');
            expect(allText).not.toContain('10,000');
        } finally {
            vi.useRealTimers();
        }
    });

    it('applies lethal styling when isLethal=true', () => {
        const { container } = render(<AnimatedDamage value={50000} isLethal />);
        const slot = container.querySelector('.dmg-slot');
        expect(slot?.classList.contains('lethal')).toBe(true);
    });

    it('applies passed className', () => {
        const { container } = render(<AnimatedDamage value={50000} className="my-extra" />);
        const slot = container.querySelector('.dmg-slot');
        expect(slot?.classList.contains('my-extra')).toBe(true);
    });
});
