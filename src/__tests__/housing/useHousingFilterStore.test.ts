import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';

describe('useHousingFilterStore', () => {
    beforeEach(() => useHousingFilterStore.getState().clearAll());

    it('defaults to empty filters', () => {
        const s = useHousingFilterStore.getState();
        expect(s.dc).toBeNull();
        expect(s.regions).toEqual([]);
        expect(s.servers).toEqual([]);
        expect(s.areas).toEqual([]);
        expect(s.sizes).toEqual([]);
        expect(s.tags).toEqual([]);
        expect(s.resultCount).toBe(0);
        expect(s.totalCount).toBe(0);
    });

    it('sets DC (single select)', () => {
        useHousingFilterStore.getState().setDC('Mana');
        expect(useHousingFilterStore.getState().dc).toBe('Mana');
    });

    it('toggles area (multi select)', () => {
        const s = useHousingFilterStore.getState();
        s.toggleArea('Shirogane');
        expect(useHousingFilterStore.getState().areas).toEqual(['Shirogane']);
        s.toggleArea('LavenderBeds');
        expect(useHousingFilterStore.getState().areas).toEqual(['Shirogane', 'LavenderBeds']);
        s.toggleArea('Shirogane');
        expect(useHousingFilterStore.getState().areas).toEqual(['LavenderBeds']);
    });

    it('clearAll resets filters but keeps result/total counts intact', () => {
        const s = useHousingFilterStore.getState();
        s.setDC('Mana');
        s.toggleArea('Shirogane');
        s.setCounts(37, 300);
        s.clearAll();
        expect(useHousingFilterStore.getState().dc).toBeNull();
        expect(useHousingFilterStore.getState().areas).toEqual([]);
        expect(useHousingFilterStore.getState().resultCount).toBe(37);
        expect(useHousingFilterStore.getState().totalCount).toBe(300);
    });
});
