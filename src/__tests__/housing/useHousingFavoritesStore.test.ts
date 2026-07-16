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

    // バグ修正 (2026-07-17): add() の重複ガードは新規追加にしか効かず、何らかの経路で
    // localStorage に既に紛れ込んだ重複 id は rehydrate のたびにそのまま読み込まれ続けていた
    // (お気に入り件数の水増し/カードの2重表示の一因)。rehydrate 時に正規化する。
    it('rehydrate 時に永続化データの重複 id を1件へ正規化する (先勝ちで順序維持)', async () => {
        localStorage.setItem(
            'housing-favorites',
            JSON.stringify({ state: { ids: ['a', 'b', 'a', 'c', 'b'] }, version: 0 }),
        );

        await useHousingFavoritesStore.persist.rehydrate();

        expect(useHousingFavoritesStore.getState().ids).toEqual(['a', 'b', 'c']);
    });
});
