import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../housingAuthHeaders', () => ({ buildHousingHeaders: vi.fn(async () => ({ 'Content-Type': 'application/json' })) }));
vi.mock('../maintenanceFromResponse', () => ({ noteMaintenanceResponse: (r: Response) => r }));

import { registerListing, uploadListingThumbnail, setListingColors } from '../housingApiClient';

const fetchMock = vi.fn();
const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
const colors = { colorFamilies: ['red'], colorRule: 3 };

beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'x', addressKey: 'k' }) });
    vi.stubGlobal('fetch', fetchMock);
});

describe('housingApiClient の色の同梱(色で探す)', () => {
    it('registerListing: 色があれば本文に載せ、null(計算失敗・時間切れ)なら載せない', async () => {
        await registerListing({ title: 't' } as never, colors);
        expect(sentBody()).toMatchObject(colors);
        fetchMock.mockClear();
        await registerListing({ title: 't' } as never, null);
        expect('colorFamilies' in sentBody()).toBe(false);
    });
    it('uploadListingThumbnail: 色を載せるのは index 0 だけ', async () => {
        await uploadListingThumbnail({ listingId: 'l', base64: 'A', mimeType: 'image/webp', index: 0, colors });
        expect(sentBody()).toMatchObject(colors);
        fetchMock.mockClear();
        await uploadListingThumbnail({ listingId: 'l', base64: 'A', mimeType: 'image/webp', index: 1, colors });
        expect('colorFamilies' in sentBody()).toBe(false);
    });
    it('setListingColors は action=set-listing-colors へ listingId と色を送る', async () => {
        await setListingColors('l', colors);
        expect(fetchMock.mock.calls[0][0]).toContain('action=set-listing-colors');
        expect(sentBody()).toEqual({ listingId: 'l', ...colors });
    });
});
