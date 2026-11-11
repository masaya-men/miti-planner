import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';

describe('useHousingFilterStore colorSwatches', () => {
    beforeEach(() => useHousingFilterStore.getState().clearAll());

    it('初期は空', () => {
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([]);
    });
    it('toggleColor で追加し、同じ丸をもう一度で外れる(複数可)', () => {
        const s = useHousingFilterStore.getState();
        s.toggleColor(3);
        s.toggleColor(12);
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([3, 12]);
        useHousingFilterStore.getState().toggleColor(3);
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([12]);
    });
    it('clearColors で全部外れる', () => {
        useHousingFilterStore.getState().toggleColor(1);
        useHousingFilterStore.getState().clearColors();
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([]);
    });
    it('clearAll でも空になる', () => {
        useHousingFilterStore.getState().toggleColor(1);
        useHousingFilterStore.getState().clearAll();
        expect(useHousingFilterStore.getState().colorSwatches).toEqual([]);
    });
});
