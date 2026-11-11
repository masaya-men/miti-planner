// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useHousingFilterStore } from '../../../../../store/useHousingFilterStore';
import { HousingColorFilter } from '../HousingColorFilter';
import { wheelPosition } from '../ColorWheel';

// t(key, 値) を「キー|値」に直す(文言ではなく配線を確かめる)
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, o?: Record<string, unknown>) => (o ? `${key}|${JSON.stringify(o)}` : key),
    }),
}));

beforeEach(() => {
    cleanup();
    useHousingFilterStore.getState().clearAll();
});

describe('HousingColorFilter', () => {
    it('丸は色相40 + 無彩色10 = 50個', () => {
        const { container } = render(<HousingColorFilter pendingCount={0} />);
        expect(container.querySelectorAll('.housing-color-swatch')).toHaveLength(50);
    });
    it('丸を押すと選ばれ、もう一度押すと外れる', () => {
        const { container } = render(<HousingColorFilter pendingCount={0} />);
        const first = container.querySelectorAll('.housing-color-swatch')[0] as HTMLButtonElement;
        fireEvent.click(first);
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([0]);
        expect(first.getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(first);
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([]);
    });
    it('複数の丸を選べる', () => {
        const { container } = render(<HousingColorFilter pendingCount={0} />);
        const sw = container.querySelectorAll('.housing-color-swatch');
        fireEvent.click(sw[0]);
        fireEvent.click(sw[45]);
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([0, 45]);
    });
    it('真ん中の「外す」で全解除', () => {
        useHousingFilterStore.getState().toggleColor(2);
        useHousingFilterStore.getState().toggleColor(7);
        const { container } = render(<HousingColorFilter pendingCount={0} />);
        fireEvent.click(container.querySelector('.housing-color-wheel-core')!);
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([]);
    });
    it('地図表示では丸が無効', () => {
        const { container } = render(<HousingColorFilter disabled pendingCount={0} />);
        const sw = container.querySelectorAll('.housing-color-swatch') as NodeListOf<HTMLButtonElement>;
        expect([...sw].every((b) => b.disabled)).toBe(true);
    });
    it('確認中の注記は、色を選んでいて件数が1以上の時だけ', () => {
        const { container, rerender } = render(<HousingColorFilter pendingCount={3} />);
        expect(container.querySelector('.housing-color-filter-note')).toBeNull();
        useHousingFilterStore.getState().toggleColor(0);
        rerender(<HousingColorFilter pendingCount={3} />);
        expect(container.querySelector('.housing-color-filter-note')?.textContent).toContain('pending_note');
        rerender(<HousingColorFilter pendingCount={0} />);
        expect(container.querySelector('.housing-color-filter-note')).toBeNull();
    });
});

describe('wheelPosition', () => {
    it('色相0は真上、外側の段ほど端に近い', () => {
        const outer = wheelPosition(0, 0);
        const inner = wheelPosition(3, 0);
        expect(outer.x).toBeCloseTo(50, 5);
        expect(outer.y).toBeLessThan(inner.y);
        expect(inner.y).toBeLessThan(50);
    });
});
