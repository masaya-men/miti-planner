import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import { sortListingsForGallery } from '../sortListingsForGallery';

const listing = (over: Partial<MockListing>): MockListing => ({
    id: 'x', ownerUid: 'u', dc: 'Materia', server: 'Bismarck',
    region: 'OCE', area: 'LavenderBeds', ward: 23, buildingType: 'house',
    plot: 6, size: 'M', addressKey: 'k', imageMode: 'none', tags: [],
    createdAt: 1, lastConfirmedAt: 1,
    ...over,
});

describe('sortListingsForGallery', () => {
    it('空配列はそのまま空配列を返す', () => {
        expect(sortListingsForGallery([])).toEqual([]);
    });

    it('元配列を mutate しない (immutable)', () => {
        const input = [
            listing({ id: 'a', area: 'Mist', addressKey: 'addr-a' }),
            listing({ id: 'b', area: 'LavenderBeds', addressKey: 'addr-b' }),
        ];
        const snapshot = input.map((l) => l.id);
        sortListingsForGallery(input);
        expect(input.map((l) => l.id)).toEqual(snapshot);
    });

    it('area が違うときは HOUSING_AREAS の順 (Mist→LavenderBeds→Goblet→Shirogane→Empyreum)', () => {
        const input = [
            listing({ id: 'shi', area: 'Shirogane', addressKey: 'k-shi' }),
            listing({ id: 'mist', area: 'Mist', addressKey: 'k-mist' }),
            listing({ id: 'emp', area: 'Empyreum', addressKey: 'k-emp' }),
            listing({ id: 'lav', area: 'LavenderBeds', addressKey: 'k-lav' }),
            listing({ id: 'gob', area: 'Goblet', addressKey: 'k-gob' }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['mist', 'lav', 'gob', 'shi', 'emp']);
    });

    it('同 area 内では DC → server → ward → plot の昇順', () => {
        const input = [
            listing({ id: 'p10', area: 'Mist', dc: 'Mana', server: 'Anima', ward: 1, plot: 10, addressKey: 'k1' }),
            listing({ id: 'p3', area: 'Mist', dc: 'Mana', server: 'Anima', ward: 1, plot: 3, addressKey: 'k2' }),
            listing({ id: 'w2', area: 'Mist', dc: 'Mana', server: 'Anima', ward: 2, plot: 1, addressKey: 'k3' }),
            listing({ id: 'srv', area: 'Mist', dc: 'Mana', server: 'Belias', ward: 1, plot: 1, addressKey: 'k4' }),
            listing({ id: 'dc', area: 'Mist', dc: 'Gaia', server: 'Alpha', ward: 1, plot: 1, addressKey: 'k5' }),
        ];
        const out = sortListingsForGallery(input);
        // Gaia 先 (alphabetical) → Mana。 Mana 内では Anima 先 → Belias。
        // Anima 内では ward1 → ward2。 ward1 内では plot3 → plot10。
        expect(out.map((l) => l.id)).toEqual(['dc', 'p3', 'p10', 'w2', 'srv']);
    });

    it('同住所 (同 addressKey) 内では lastConfirmedAt desc で並ぶ', () => {
        const input = [
            listing({ id: 'a1', addressKey: 'addr', lastConfirmedAt: 500 }),
            listing({ id: 'a2', addressKey: 'addr', lastConfirmedAt: 900 }),
            listing({ id: 'a3', addressKey: 'addr', lastConfirmedAt: 200 }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['a2', 'a1', 'a3']);
    });

    it('同住所内で lastConfirmedAt が同値のとき createdAt desc で安定化', () => {
        const input = [
            listing({ id: 'older', createdAt: 100, addressKey: 'k', lastConfirmedAt: 500 }),
            listing({ id: 'newer', createdAt: 200, addressKey: 'k', lastConfirmedAt: 500 }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['newer', 'older']);
    });

    it('同 ward 内では house が apartment より先', () => {
        const input = [
            listing({
                id: 'apt', area: 'Mist', dc: 'Mana', server: 'Anima', ward: 1,
                buildingType: 'apartment', plot: undefined, size: undefined,
                apartmentBuilding: 1, roomNumber: 1, addressKey: 'apt-k',
            }),
            listing({
                id: 'house', area: 'Mist', dc: 'Mana', server: 'Anima', ward: 1,
                buildingType: 'house', plot: 60, addressKey: 'house-k',
            }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['house', 'apt']);
    });

    it('apartment 同士は apartmentBuilding 昇順 → roomNumber 昇順', () => {
        const input = [
            listing({
                id: 'b2-r1', buildingType: 'apartment', plot: undefined, size: undefined,
                apartmentBuilding: 2, roomNumber: 1, addressKey: 'b2-r1',
            }),
            listing({
                id: 'b1-r50', buildingType: 'apartment', plot: undefined, size: undefined,
                apartmentBuilding: 1, roomNumber: 50, addressKey: 'b1-r50',
            }),
            listing({
                id: 'b1-r5', buildingType: 'apartment', plot: undefined, size: undefined,
                apartmentBuilding: 1, roomNumber: 5, addressKey: 'b1-r5',
            }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['b1-r5', 'b1-r50', 'b2-r1']);
    });
});
