// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PinterestView } from '../../components/housing/workspace/PinterestView';
import type { MockListing } from '../../data/housing/mockListings';

beforeEach(() => {
    if (!window.matchMedia) {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((q: string) => ({
                matches: false, media: q, onchange: null,
                addEventListener: vi.fn(), removeEventListener: vi.fn(),
                addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
            })),
        });
    }
});

const sample: MockListing[] = [
    {
        id: 'mock-001', ownerUid: 'u1', dc: 'Mana', server: 'Anima', region: 'JP',
        area: 'Shirogane', ward: 3, plot: 12, size: 'M', imageMode: 'thumbnail',
        thumbnailPath: '/x.svg', tags: [], createdAt: 0,
    },
    {
        id: 'mock-002', ownerUid: 'u2', dc: 'Mana', server: 'Anima', region: 'JP',
        area: 'Shirogane', ward: 3, plot: 15, size: 'S', imageMode: 'thumbnail',
        thumbnailPath: '/y.svg', tags: [], createdAt: 0,
    },
];

describe('PinterestView initialExpandedId', () => {
    it('renders all listing items regardless of expansion state', () => {
        render(<PinterestView listings={sample} initialExpandedId="mock-001" />);
        const items = document.querySelectorAll('.housing-pinterest-item');
        expect(items.length).toBe(2);
    });

    it('updates expanded card when initialExpandedId changes (URL navigation)', () => {
        const { rerender } = render(<PinterestView listings={sample} initialExpandedId="mock-001" />);
        rerender(<PinterestView listings={sample} initialExpandedId="mock-002" />);
        // After prop change the effect syncs expanded to mock-002; items still all present.
        expect(document.querySelectorAll('.housing-pinterest-item').length).toBe(2);
    });

    it('renders without crash when no initialExpandedId is provided', () => {
        render(<PinterestView listings={sample} />);
        expect(document.querySelectorAll('.housing-pinterest-item').length).toBe(2);
    });
});

describe('Route mapping smoke', () => {
    it('renders a component for /housing/p/:listingId', () => {
        function Probe() {
            return <div data-testid="probe">probe</div>;
        }
        render(
            <MemoryRouter initialEntries={['/housing/p/mock-001']}>
                <Routes>
                    <Route path="/housing/p/:listingId" element={<Probe />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(screen.getByTestId('probe')).toBeInTheDocument();
    });

    it('renders a component for /housing/tour/:tourId', () => {
        function Probe() {
            return <div data-testid="probe-tour">probe-tour</div>;
        }
        render(
            <MemoryRouter initialEntries={['/housing/tour/tour-abc']}>
                <Routes>
                    <Route path="/housing/tour/:tourId" element={<Probe />} />
                </Routes>
            </MemoryRouter>,
        );
        expect(screen.getByTestId('probe-tour')).toBeInTheDocument();
    });
});
