import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';

describe('useHousingFavoritesStore', () => {
    beforeEach(() => {
        localStorage.clear();
        useHousingFavoritesStore.getState().reset();
    });

    it('starts empty', () => {
        expect(useHousingFavoritesStore.getState().ids).toEqual([]);
    });

    it('adds a listing', () => {
        useHousingFavoritesStore.getState().add('listing-1');
        expect(useHousingFavoritesStore.getState().ids).toContain('listing-1');
    });

    it('removes a listing', () => {
        const s = useHousingFavoritesStore.getState();
        s.add('a');
        s.add('b');
        s.remove('a');
        expect(useHousingFavoritesStore.getState().ids).toEqual(['b']);
    });

    it('contains() reports membership', () => {
        useHousingFavoritesStore.getState().add('x');
        expect(useHousingFavoritesStore.getState().contains('x')).toBe(true);
        expect(useHousingFavoritesStore.getState().contains('y')).toBe(false);
    });

    it('does not add duplicates', () => {
        const s = useHousingFavoritesStore.getState();
        s.add('a');
        s.add('a');
        expect(useHousingFavoritesStore.getState().ids).toEqual(['a']);
    });
});
