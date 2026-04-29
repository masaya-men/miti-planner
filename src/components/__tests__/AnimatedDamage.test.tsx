// @vitest-environment happy-dom
import { render } from '@testing-library/react';
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
});
