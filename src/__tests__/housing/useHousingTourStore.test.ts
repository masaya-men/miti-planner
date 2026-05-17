import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingTourStore } from '../../store/useHousingTourStore';

describe('useHousingTourStore', () => {
    beforeEach(() => useHousingTourStore.getState().reset());

    it('starts empty, not running', () => {
        const s = useHousingTourStore.getState();
        expect(s.listingIds).toEqual([]);
        expect(s.running).toBe(false);
        expect(s.currentIndex).toBe(0);
    });

    it('sets listings', () => {
        useHousingTourStore.getState().setListings(['a', 'b', 'c']);
        expect(useHousingTourStore.getState().listingIds).toEqual(['a', 'b', 'c']);
    });

    it('starts and advances', () => {
        const s = useHousingTourStore.getState();
        s.setListings(['a', 'b', 'c']);
        s.start();
        expect(useHousingTourStore.getState().running).toBe(true);
        expect(useHousingTourStore.getState().currentIndex).toBe(0);
        s.next();
        expect(useHousingTourStore.getState().currentIndex).toBe(1);
        s.next();
        expect(useHousingTourStore.getState().currentIndex).toBe(2);
    });

    it('does not advance past last', () => {
        const s = useHousingTourStore.getState();
        s.setListings(['a', 'b']);
        s.start();
        s.next();
        s.next();
        s.next();
        expect(useHousingTourStore.getState().currentIndex).toBe(1);
    });

    it('prev decrements but not below 0', () => {
        const s = useHousingTourStore.getState();
        s.setListings(['a', 'b']);
        s.start();
        s.next();
        s.prev();
        expect(useHousingTourStore.getState().currentIndex).toBe(0);
        s.prev();
        expect(useHousingTourStore.getState().currentIndex).toBe(0);
    });

    it('stop resets running but keeps listings', () => {
        const s = useHousingTourStore.getState();
        s.setListings(['a', 'b']);
        s.start();
        s.stop();
        expect(useHousingTourStore.getState().running).toBe(false);
        expect(useHousingTourStore.getState().listingIds).toEqual(['a', 'b']);
    });
});
