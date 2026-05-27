import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import { sortListingsForGallery } from '../sortListingsForGallery';

const listing = (over: Partial<MockListing>): MockListing => ({
    id: 'x', ownerUid: 'u', dc: 'Materia', server: 'Bismarck',
    region: 'OCE', area: 'LavenderBeds', ward: 23, buildingType: 'house',
    plot: 6, size: 'M', addressKey: 'k', imageMode: 'none', tags: [],
    createdAt: 1, updatedAt: 1, lastConfirmedAt: 1,
    isHidden: false, reportCount: 0, deletedAt: null,
    ...over,
});

describe('sortListingsForGallery', () => {
    it('空配列はそのまま空配列を返す', () => {
        expect(sortListingsForGallery([])).toEqual([]);
    });

    it('元配列を mutate しない (immutable)', () => {
        const input = [
            listing({ id: 'a', createdAt: 1, addressKey: 'addr-a' }),
            listing({ id: 'b', createdAt: 2, addressKey: 'addr-b' }),
        ];
        const snapshot = input.map((l) => l.id);
        sortListingsForGallery(input);
        expect(input.map((l) => l.id)).toEqual(snapshot);
    });

    it('全 listing が別住所のとき createdAt desc で並ぶ', () => {
        const input = [
            listing({ id: 'old', createdAt: 100, addressKey: 'a' }),
            listing({ id: 'new', createdAt: 300, addressKey: 'b' }),
            listing({ id: 'mid', createdAt: 200, addressKey: 'c' }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['new', 'mid', 'old']);
    });

    it('同住所内では lastConfirmedAt desc で並ぶ', () => {
        const input = [
            listing({ id: 'a1', createdAt: 100, addressKey: 'addr', lastConfirmedAt: 500 }),
            listing({ id: 'a2', createdAt: 100, addressKey: 'addr', lastConfirmedAt: 900 }),
            listing({ id: 'a3', createdAt: 100, addressKey: 'addr', lastConfirmedAt: 200 }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['a2', 'a1', 'a3']);
    });

    it('複数住所混在: 各住所の代表 (= 同住所内で lastConfirmedAt 最大の listing) の createdAt desc で並ぶ', () => {
        const input = [
            // addr-X (代表 createdAt=300, 最新確認=800)
            listing({ id: 'x1', createdAt: 300, addressKey: 'addr-X', lastConfirmedAt: 800 }),
            listing({ id: 'x2', createdAt: 250, addressKey: 'addr-X', lastConfirmedAt: 400 }),
            // addr-Y (代表 createdAt=500, 最新確認=600)
            listing({ id: 'y1', createdAt: 500, addressKey: 'addr-Y', lastConfirmedAt: 600 }),
            // addr-Z (単独 createdAt=400)
            listing({ id: 'z1', createdAt: 400, addressKey: 'addr-Z', lastConfirmedAt: 100 }),
        ];
        const out = sortListingsForGallery(input);
        // 各住所内: x1, x2 / y1 / z1
        // 各住所の代表 createdAt: addr-Y=500 > addr-Z=400 > addr-X=300
        expect(out.map((l) => l.id)).toEqual(['y1', 'z1', 'x1', 'x2']);
    });

    it('lastConfirmedAt が同値のときは createdAt desc を保つ (= 安定 sort)', () => {
        const input = [
            listing({ id: 'older', createdAt: 100, addressKey: 'k', lastConfirmedAt: 500 }),
            listing({ id: 'newer', createdAt: 200, addressKey: 'k', lastConfirmedAt: 500 }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['newer', 'older']);
    });
});
