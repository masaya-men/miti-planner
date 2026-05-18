import { MOCK_LISTINGS, type MockListing } from './mockListings';

export interface PlotPosition {
    plot: number;
    /** 0..1 normalized within the map image's intrinsic box. */
    x: number;
    y: number;
    listingId: string | null;
}

/** Initial sample ward for the map view (Mana / Anima / Shirogane / Ward 3). */
export const SAMPLE_WARD_KEY = 'mana-anima-shirogane-3';

export const SAMPLE_WARD_LAYOUT: PlotPosition[] = [
    { plot: 1,  x: 0.12, y: 0.18, listingId: 'mock-001' },
    { plot: 2,  x: 0.22, y: 0.18, listingId: null },
    { plot: 3,  x: 0.32, y: 0.18, listingId: null },
    { plot: 4,  x: 0.42, y: 0.18, listingId: null },
    { plot: 5,  x: 0.52, y: 0.18, listingId: null },
    { plot: 6,  x: 0.62, y: 0.18, listingId: null },
    { plot: 7,  x: 0.12, y: 0.30, listingId: null },
    { plot: 8,  x: 0.22, y: 0.30, listingId: null },
    { plot: 9,  x: 0.32, y: 0.30, listingId: null },
    { plot: 10, x: 0.42, y: 0.30, listingId: null },
    { plot: 11, x: 0.52, y: 0.30, listingId: null },
    { plot: 12, x: 0.62, y: 0.30, listingId: 'mock-001' },
    { plot: 13, x: 0.12, y: 0.42, listingId: null },
    { plot: 14, x: 0.22, y: 0.42, listingId: null },
    { plot: 15, x: 0.32, y: 0.42, listingId: 'mock-002' },
    { plot: 16, x: 0.42, y: 0.42, listingId: null },
    { plot: 17, x: 0.52, y: 0.42, listingId: null },
    { plot: 18, x: 0.62, y: 0.42, listingId: null },
    { plot: 19, x: 0.12, y: 0.54, listingId: null },
    { plot: 20, x: 0.22, y: 0.54, listingId: null },
    { plot: 21, x: 0.32, y: 0.54, listingId: null },
    { plot: 22, x: 0.42, y: 0.54, listingId: 'mock-004' },
    { plot: 23, x: 0.52, y: 0.54, listingId: null },
    { plot: 24, x: 0.62, y: 0.54, listingId: null },
    { plot: 25, x: 0.12, y: 0.66, listingId: null },
    { plot: 26, x: 0.22, y: 0.66, listingId: null },
    { plot: 27, x: 0.32, y: 0.66, listingId: 'mock-009' },
    { plot: 28, x: 0.42, y: 0.66, listingId: null },
    { plot: 29, x: 0.52, y: 0.66, listingId: null },
    { plot: 30, x: 0.62, y: 0.66, listingId: null },
];

export function listingForPlot(plot: number): MockListing | null {
    const p = SAMPLE_WARD_LAYOUT.find((entry) => entry.plot === plot);
    if (!p || !p.listingId) return null;
    return MOCK_LISTINGS.find((l) => l.id === p.listingId) ?? null;
}
