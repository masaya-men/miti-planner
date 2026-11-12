// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useHousingFilterStore } from '../../../../../store/useHousingFilterStore';
import { HousingColorFilter } from '../HousingColorFilter';

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
    it('丸は13個(1系統1個)で、番号順(10=白・11=灰・12=黒)に並ぶ', () => {
        const { container } = render(<HousingColorFilter pendingCount={0} />);
        const labels = [...container.querySelectorAll('.housing-color-swatch')].map((b) => b.getAttribute('aria-label'));
        expect(labels).toHaveLength(13);
        expect(labels.slice(10)).toEqual(['housing.workspace.filter.color.family.white', 'housing.workspace.filter.color.family.gray', 'housing.workspace.filter.color.family.black']);
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
        fireEvent.click(sw[12]);
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([0, 12]);
    });
    it('選んだ色が格子の上に選んだ順で並び、押すとその色だけ外れる', () => {
        useHousingFilterStore.getState().toggleColor(2);
        useHousingFilterStore.getState().toggleColor(7);
        const { container } = render(<HousingColorFilter pendingCount={0} />);
        const picked = container.querySelectorAll('.housing-color-filter-picked');
        expect(picked).toHaveLength(2);
        expect(picked[0].textContent).toContain('family.yellow');
        fireEvent.click(picked[0]);
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([7]);
    });
    it('「色を外す」の文字ボタンは無い(外すのは選んだ色から)', () => {
        useHousingFilterStore.getState().toggleColor(2);
        const { container } = render(<HousingColorFilter pendingCount={0} />);
        expect(container.querySelector('.housing-color-filter-clear')).toBeNull();
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
