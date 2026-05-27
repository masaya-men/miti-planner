import { describe, it, expect } from 'vitest';
import { firestoreToGalleryListing } from '../galleryAdapter';
import type { HousingListing } from '../../../types/housing';

const base: HousingListing = {
  id: 'x',
  ownerUid: 'u',
  dc: 'Materia',
  server: 'Bismarck',
  area: 'LavenderBeds',
  ward: 23,
  buildingType: 'house',
  plot: 6,
  size: 'M',
  addressKey: 'k',
  imageMode: 'none',
  tags: ['luxury'],
  description: 'desc',
  createdAt: 100,
  updatedAt: 100,
  lastConfirmedAt: 100,
  isHidden: false,
  reportCount: 0,
  deletedAt: null,
};

describe('firestoreToGalleryListing', () => {
  it('dc から region を導出して写す (Materia→OCE)', () => {
    const r = firestoreToGalleryListing(base);
    expect(r).not.toBeNull();
    expect(r!.region).toBe('OCE');
    expect(r!.id).toBe('x');
    expect(r!.tags).toEqual(['luxury']);
    expect(r!.createdAt).toBe(100);
  });

  it('未知の dc（region 導出不可）は null', () => {
    const r = firestoreToGalleryListing({ ...base, dc: 'UnknownDC' });
    expect(r).toBeNull();
  });

  it('plot が無い（個室/アパート等）は null', () => {
    const r = firestoreToGalleryListing({ ...base, plot: undefined });
    expect(r).toBeNull();
  });

  it('size が無い場合も null', () => {
    const r = firestoreToGalleryListing({ ...base, size: undefined });
    expect(r).toBeNull();
  });

  it('createdAt が Firestore Timestamp 風オブジェクトなら toMillis で number 化', () => {
    const ts = { toMillis: () => 999 } as unknown as number;
    const r = firestoreToGalleryListing({ ...base, createdAt: ts });
    expect(r!.createdAt).toBe(999);
  });

  it('tags 欠損は空配列にフォールバック', () => {
    const r = firestoreToGalleryListing({ ...base, tags: undefined as unknown as string[] });
    expect(r!.tags).toEqual([]);
  });
});
