import { describe, it, expect } from 'vitest';
import { applyFilters, type FilterCondition } from '../../lib/housing/applyFilters';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';
import { PALETTE_RULE } from '../../lib/housing/color/housingExtractPalette';

const EMPTY: FilterCondition = { dc: null, regions: [], servers: [], areas: [], sizes: [], tags: [] };
const base = MOCK_LISTINGS[0];
const make = (id: string, colorFamilies?: string[], extra: object = {}) => ({
    ...base, id, colorFamilies, colorRule: colorFamilies ? PALETTE_RULE : undefined, ...extra,
});

describe('applyFilters colors', () => {
    const red = make('red', ['red']);
    const blueGreen = make('bg', ['blue', 'green']);
    const none = make('none', []);
    const pending = make('pending');
    const all = [red, blueGreen, none, pending];

    it('colors 省略・空なら不変(未計算の家も残る)', () => {
        expect(applyFilters(all, EMPTY)).toHaveLength(4);
        expect(applyFilters(all, { ...EMPTY, colors: [] })).toHaveLength(4);
    });
    it('1色で絞る', () => {
        expect(applyFilters(all, { ...EMPTY, colors: ['red'] }).map((l) => l.id)).toEqual(['red']);
    });
    it('複数色は OR', () => {
        expect(applyFilters(all, { ...EMPTY, colors: ['red', 'green'] }).map((l) => l.id)).toEqual(['red', 'bg']);
    });
    it('未計算と空配列の家は除外', () => {
        const ids = applyFilters(all, { ...EMPTY, colors: ['red', 'blue', 'green'] }).map((l) => l.id);
        expect(ids).not.toContain('pending');
        expect(ids).not.toContain('none');
    });
    it('他の条件と AND', () => {
        const a = make('a', ['red'], { area: 'Mist' });
        const b = make('b', ['red'], { area: 'Goblet' });
        expect(applyFilters([a, b], { ...EMPTY, areas: ['Mist'], colors: ['red'] }).map((l) => l.id)).toEqual(['a']);
    });
});
