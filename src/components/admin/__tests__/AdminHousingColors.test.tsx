// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
    gallery: vi.fn(),
    compute: vi.fn(),
    patch: vi.fn(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, o?: Record<string, unknown>) => (o ? `${key}|${JSON.stringify(o)}` : key),
    }),
}));
vi.mock('../../../lib/housing/publicHousingWindow', () => ({ fetchPublicGallery: h.gallery }));
vi.mock('../../../lib/housing/color/housingColorFromUrl', () => ({
    colorsFromImageUrl: h.compute,
    representativeUrlForColors: (l: { imageMode?: string; ogImageUrl?: string }) => (l.imageMode === 'sns' && l.ogImageUrl ? l.ogImageUrl : null),
}));
vi.mock('../../../lib/housing/color/adminHousingColorsApi', () => ({ patchHousingColors: h.patch }));
vi.mock('../../../constants/housing', () => ({ buildListingDetailPath: (id: string) => `/housing/listing/${id}` }));

import { AdminHousingColors } from '../AdminHousingColors';

const RULE = 3;
const colors = { colorFamilies: ['red'], colorRule: RULE };
const listing = (i: number) => ({ id: `x${i}`, imageMode: 'sns', ogImageUrl: `https://pbs.twimg.com/media/x${i}.jpg` });
const many = (n: number) => Array.from({ length: n }, (_, i) => listing(i));

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    h.compute.mockResolvedValue(colors);
    h.patch.mockImplementation(async (items: { id: string }[]) => ({ written: items.length, rejected: [], published: false }));
    vi.stubGlobal('confirm', vi.fn(() => true));
});

const btn = (key: string) => screen.getByText(new RegExp(`^admin\\.housing_colors\\.${key}$`)).closest('button') as HTMLButtonElement;

describe('AdminHousingColors', () => {
    it('未計算の件数を出す(計算済み・写真なしは数えない)', async () => {
        h.gallery.mockResolvedValue([...many(3), { id: 'done', imageMode: 'sns', ogImageUrl: 'https://x/a.jpg', colorFamilies: ['red'], colorRule: RULE }, { id: 'none', imageMode: 'none' }]);
        render(<AdminHousingColors />);
        await screen.findByText(/count_pending\|{"count":3}/);
    });

    it('「始める」で 25 件ずつ書き込み(final:false)、版は進めない', async () => {
        h.gallery.mockResolvedValue(many(60));
        render(<AdminHousingColors />);
        await screen.findByText(/count_pending\|{"count":60}/);
        fireEvent.click(btn('start'));
        await screen.findByText(/count_done\|{"count":60}/);
        expect(h.patch.mock.calls.map((c) => [c[0].length, c[1]])).toEqual([[25, false], [25, false], [10, false]]);
    });

    it('「止める」で次の束に進まず、「続きから再開」で残りを進める', async () => {
        h.gallery.mockResolvedValue(many(60));
        let first = true;
        h.patch.mockImplementation(async (items: { id: string }[]) => {
            if (first) {
                first = false;
                fireEvent.click(btn('stop')); // 1 束目の書き込み中に止める
            }
            return { written: items.length, rejected: [], published: false };
        });
        render(<AdminHousingColors />);
        await screen.findByText(/count_pending\|{"count":60}/);
        fireEvent.click(btn('start'));
        await screen.findByText(/count_done\|{"count":25}/);
        expect(h.patch).toHaveBeenCalledTimes(1);
        fireEvent.click(btn('resume'));
        await screen.findByText(/count_done\|{"count":60}/);
        // 続きは残りの 35 件(25 + 10)。済ませた 25 件を二度書かない
        expect(h.patch.mock.calls.slice(1).map((c) => c[0].length)).toEqual([25, 10]);
    });

    it('「反映する」は確認のあと、final:true を 1 回だけ送る。確認で止めたら送らない', async () => {
        h.gallery.mockResolvedValue(many(3));
        render(<AdminHousingColors />);
        await screen.findByText(/count_pending\|{"count":3}/);
        fireEvent.click(btn('start'));
        await screen.findByText(/count_done\|{"count":3}/);
        h.patch.mockClear();

        vi.stubGlobal('confirm', vi.fn(() => false));
        fireEvent.click(btn('publish'));
        expect(h.patch).not.toHaveBeenCalled();

        vi.stubGlobal('confirm', vi.fn(() => true));
        h.patch.mockResolvedValue({ written: 0, rejected: [], published: true });
        fireEvent.click(btn('publish'));
        await screen.findByText('admin.housing_colors.published');
        const finals = h.patch.mock.calls.filter((c) => c[1] === true);
        expect(finals).toHaveLength(1);
        expect(finals[0][0]).toEqual([]);
    });

    it('色を取れた家が無い間は「反映する」を押せない', async () => {
        h.gallery.mockResolvedValue(many(2));
        render(<AdminHousingColors />);
        await screen.findByText(/count_pending\|{"count":2}/);
        expect(btn('publish').disabled).toBe(true);
    });

    it('読めなかった家を一覧に出し、「もう一度試す」でその家だけ計算し直す', async () => {
        h.gallery.mockResolvedValue(many(3));
        h.compute.mockImplementation(async (url: string) => (url.includes('x1') ? null : colors));
        render(<AdminHousingColors />);
        await screen.findByText(/count_pending\|{"count":3}/);
        fireEvent.click(btn('start'));
        await screen.findByText(/unreadable_title\|{"count":1}/);
        expect(screen.getByText('x1').getAttribute('href')).toBe('/housing/listing/x1');
        expect(h.patch.mock.calls[0][0].map((i: { id: string }) => i.id)).toEqual(['x0', 'x2']);

        h.compute.mockClear();
        h.compute.mockResolvedValue(colors);
        fireEvent.click(btn('retry'));
        await waitFor(() => expect(screen.queryByText(/unreadable_title/)).toBeNull());
        expect(h.compute).toHaveBeenCalledTimes(1);
        expect(h.compute.mock.calls[0][0]).toContain('x1');
    });
});
