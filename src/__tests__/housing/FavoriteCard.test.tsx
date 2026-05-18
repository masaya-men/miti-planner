// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FavoriteCard } from '../../components/housing/workspace/FavoriteCard';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

describe('FavoriteCard', () => {
    const listing = MOCK_LISTINGS[0];

    it('renders area / ward / plot label and description', () => {
        render(<FavoriteCard listing={listing} selected={false} onClick={() => {}} />);
        // mock-001 = Mana / Anima Shirogane 3-12 (M) 和風カフェ
        expect(screen.getByText(/Shirogane/)).toBeInTheDocument();
        expect(screen.getByText(listing.description!)).toBeInTheDocument();
    });

    it('exposes listing-id and selected state via data attributes', () => {
        const { container } = render(
            <FavoriteCard listing={listing} selected={true} onClick={() => {}} />,
        );
        const root = container.firstChild as HTMLElement;
        expect(root.getAttribute('data-selected')).toBe('true');
        expect(root.getAttribute('data-listing-id')).toBe(listing.id);
    });

    it('forwards Shift modifier through onClick', () => {
        const onClick = vi.fn();
        render(<FavoriteCard listing={listing} selected={false} onClick={onClick} />);
        fireEvent.click(screen.getByRole('button'), { shiftKey: true });
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ shift: true }));
    });
});
