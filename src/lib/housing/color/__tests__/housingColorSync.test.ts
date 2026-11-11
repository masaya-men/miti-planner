// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
    fromUrl: vi.fn(),
    fromBase64: vi.fn(),
    setColors: vi.fn(),
}));

vi.mock('../housingColorFromUrl', async (orig) => ({
    ...(await orig<typeof import('../housingColorFromUrl')>()),
    colorsFromImageUrl: h.fromUrl,
    colorsFromBase64: h.fromBase64,
}));
vi.mock('../../../housingApiClient', () => ({ setListingColors: h.setColors }));

import { computeRegistrationColors, ensureListingColors } from '../housingColorSync';
import { useListingColorSync } from '../useListingColorSync';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { PALETTE_RULE } from '../housingExtractPalette';
import type { MockListing } from '../../../../data/housing/mockListings';

const colors = { colorFamilies: ['blue'], colorRule: PALETTE_RULE };
const snsListing = (id: string, extra: object = {}) =>
    ({ id, imageMode: 'sns', ogImageUrl: `https://pbs.twimg.com/media/${id}.jpg`, tags: [], ...extra }) as unknown as MockListing;

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    h.fromUrl.mockResolvedValue(colors);
    h.fromBase64.mockResolvedValue(colors);
    h.setColors.mockResolvedValue(undefined);
    useHousingListingsStore.setState({ listings: [], myListings: [] });
});
afterEach(() => vi.useRealTimers());

describe('computeRegistrationColors(登録の直前)', () => {
    it('sns は画像 URL から、直接アップロードは手元のファイルから計算する', async () => {
        expect(await computeRegistrationColors({ imageMode: 'sns', ogImageUrl: 'https://x/a.jpg' }, [])).toEqual(colors);
        expect(h.fromUrl).toHaveBeenCalledWith('https://x/a.jpg');
        expect(await computeRegistrationColors({ imageMode: 'none' }, [{ base64: 'AAA', mimeType: 'image/webp' }])).toEqual(colors);
        expect(h.fromBase64).toHaveBeenCalledWith('AAA', 'image/webp');
    });
    it('画像が無ければ null', async () => {
        expect(await computeRegistrationColors({ imageMode: 'none' }, [])).toBeNull();
    });
    it('6 秒たっても計算が終わらなければ諦めて null(色なしで登録に進める)', async () => {
        vi.useFakeTimers();
        h.fromUrl.mockReturnValue(new Promise(() => {})); // 永遠に終わらない
        const p = computeRegistrationColors({ imageMode: 'sns', ogImageUrl: 'https://x/a.jpg' }, []);
        let settled: unknown = 'pending';
        void p.then((v) => { settled = v; });
        await vi.advanceTimersByTimeAsync(5900);
        expect(settled).toBe('pending');
        await vi.advanceTimersByTimeAsync(200);
        expect(settled).toBeNull();
    });
});

describe('ensureListingColors(編集のあと・編集ページを開いた時)', () => {
    it('色が無い家は計算して保存し、手元の一覧にも重ねる', async () => {
        useHousingListingsStore.setState({ listings: [snsListing('a')] });
        expect(await ensureListingColors('a')).toEqual(colors);
        expect(h.setColors).toHaveBeenCalledWith('a', colors);
        expect(useHousingListingsStore.getState().listings[0]).toMatchObject(colors);
    });
    it('すでに今の決まりで計算済みなら何もしない', async () => {
        useHousingListingsStore.setState({ listings: [snsListing('a', colors)] });
        expect(await ensureListingColors('a')).toBeNull();
        expect(h.fromUrl).not.toHaveBeenCalled();
        expect(h.setColors).not.toHaveBeenCalled();
    });
    it('古い決まりで計算した家は計算し直す', async () => {
        useHousingListingsStore.setState({ listings: [snsListing('a', { colorFamilies: ['red'], colorRule: PALETTE_RULE - 1 })] });
        await ensureListingColors('a');
        expect(h.setColors).toHaveBeenCalledTimes(1);
    });
    it('一覧に無い家は、渡された家の情報(編集ページの初期値)で補う', async () => {
        await ensureListingColors('z', { imageMode: 'sns', ogImageUrl: 'https://pbs.twimg.com/media/z.jpg' });
        expect(h.fromUrl).toHaveBeenCalledWith('https://pbs.twimg.com/media/z.jpg');
        expect(h.setColors).toHaveBeenCalledWith('z', colors);
    });
    it('写真が読めない・保存に失敗した時は何もせず null(編集は成功のまま)', async () => {
        useHousingListingsStore.setState({ listings: [snsListing('a')] });
        h.fromUrl.mockResolvedValueOnce(null);
        expect(await ensureListingColors('a')).toBeNull();
        expect(h.setColors).not.toHaveBeenCalled();
        h.setColors.mockRejectedValueOnce(new Error('403'));
        expect(await ensureListingColors('a')).toBeNull();
    });
});

describe('useListingColorSync(編集ページを開いた時の補完)', () => {
    it('色が無ければ開いた時に 1 回補う', async () => {
        const listing = { id: 'e', imageMode: 'sns', ogImageUrl: 'https://pbs.twimg.com/media/e.jpg' };
        renderHook(() => useListingColorSync(listing));
        await vi.waitFor(() => expect(h.setColors).toHaveBeenCalledWith('e', colors));
        expect(h.setColors).toHaveBeenCalledTimes(1);
    });
    it('色が計算済みなら何もしない', async () => {
        renderHook(() => useListingColorSync({ id: 'e', imageMode: 'sns', ogImageUrl: 'https://x/e.jpg', ...colors }));
        await Promise.resolve();
        expect(h.fromUrl).not.toHaveBeenCalled();
        expect(h.setColors).not.toHaveBeenCalled();
    });
    it('家が無い(作成モード)なら何もしない', async () => {
        renderHook(() => useListingColorSync(undefined));
        await Promise.resolve();
        expect(h.fromUrl).not.toHaveBeenCalled();
    });
});
