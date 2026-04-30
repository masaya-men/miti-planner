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
        expect(sameSpan).toBe(firstSpan);
    });

    it('does NOT animate on initial mount', () => {
        const { container } = render(<AnimatedDamage value={10000} />);
        expect(container.querySelectorAll('.ch.enter')).toHaveLength(0);
        expect(container.querySelectorAll('.ch.exit')).toHaveLength(0);
        expect(container.querySelector('.dmg-slot')!.textContent).toBe('10,000');
    });

    it('does NOT animate when value changes but isLethal stays the same', () => {
        const { container, rerender } = render(<AnimatedDamage value={10000} isLethal={false} />);
        rerender(<AnimatedDamage value={7000} isLethal={false} />);
        // サイレント更新: アニメクラスは付かない
        expect(container.querySelectorAll('.ch.enter')).toHaveLength(0);
        expect(container.querySelectorAll('.ch.exit')).toHaveLength(0);
        // テキストは新値に更新されている
        expect(container.querySelector('.dmg-slot')!.textContent).toBe('7,000');
    });

    it('animates with overlap when isLethal flips', () => {
        vi.useFakeTimers();
        try {
            const { container, rerender } = render(<AnimatedDamage value={50000} isLethal={false} />);
            // 初回: アニメクラス無し
            expect(container.querySelectorAll('.ch.enter')).toHaveLength(0);
            expect(container.querySelectorAll('.ch.exit')).toHaveLength(0);

            // 致死状態反転: false → true（同時に値も変化）
            rerender(<AnimatedDamage value={60000} isLethal={true} />);

            // オーバーラップ: exit と enter が同時に存在する
            const exitChars = container.querySelectorAll('.ch.exit');
            const enterChars = container.querySelectorAll('.ch.enter');
            expect(exitChars).toHaveLength(6); // "50,000"
            expect(enterChars).toHaveLength(6); // "60,000"

            // exit 完了 + rAF
            // exit 150ms + stagger 12ms × 5 = 210ms に rAF (~16ms) を加味して 240ms
            act(() => {
                vi.advanceTimersByTime(240);
            });

            // exit-layer は DOM から除去されている
            expect(container.querySelectorAll('.ch.exit')).toHaveLength(0);
            // enter は残る
            expect(container.querySelectorAll('.ch.enter')).toHaveLength(6);
        } finally {
            vi.useRealTimers();
        }
    });

    it('animates when isLethal flips even if value is unchanged', () => {
        vi.useFakeTimers();
        try {
            const { container, rerender } = render(<AnimatedDamage value={50000} isLethal={false} />);
            // value 同じ、isLethal だけ反転（HP 変化等で起こる）
            rerender(<AnimatedDamage value={50000} isLethal={true} />);

            // 値変化していないが、致死反転したのでアニメ起動
            expect(container.querySelectorAll('.ch.exit').length).toBeGreaterThan(0);
            expect(container.querySelectorAll('.ch.enter').length).toBeGreaterThan(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('cancels mid-swap and overlaps with new value when isLethal flips again rapidly', () => {
        vi.useFakeTimers();
        try {
            const { container, rerender } = render(<AnimatedDamage value={50000} isLethal={false} />);
            // 1 回目: false → true で swap 起動
            rerender(<AnimatedDamage value={60000} isLethal={true} />);
            act(() => {
                vi.advanceTimersByTime(50); // 半分だけ進める
            });

            // 2 回目: true → false で再 swap（mid-swap 割り込み）
            act(() => {
                rerender(<AnimatedDamage value={30000} isLethal={false} />);
            });

            // 直近の値が表示されている
            expect(container.querySelector('.dmg-layer-enter')!.textContent).toBe('30,000');
            // 中間値の "60,000" は exit 中か消えている、entering には無いことを確認
            const enterText = container.querySelector('.dmg-layer-enter')!.textContent;
            expect(enterText).toBe('30,000');
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
