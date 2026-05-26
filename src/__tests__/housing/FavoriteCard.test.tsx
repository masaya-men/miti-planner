// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { FavoriteCard } from '../../components/housing/workspace/FavoriteCard';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

function withDnd(ui: React.ReactElement) {
    return <DndContext>{ui}</DndContext>;
}

describe('FavoriteCard', () => {
    const listing = MOCK_LISTINGS[0];

    it('renders area / ward / plot label and description', () => {
        render(withDnd(<FavoriteCard listing={listing} selected={false} onClick={() => {}} />));
        // 2026-05-27 多言語化: formatHousingAddress が i18n.language に応じて訳す。
        // test 環境では ja フォールバックで「シロガネ 3-12」 表示 (mock-001 = Mana / Anima)。
        expect(screen.getByText(/シロガネ/)).toBeInTheDocument();
        expect(screen.getByText(listing.description!)).toBeInTheDocument();
    });

    it('exposes listing-id and selected state via data attributes', () => {
        const { container } = render(
            withDnd(<FavoriteCard listing={listing} selected={true} onClick={() => {}} />),
        );
        const root = container.querySelector('[data-listing-id]') as HTMLElement;
        expect(root.getAttribute('data-selected')).toBe('true');
        expect(root.getAttribute('data-listing-id')).toBe(listing.id);
    });

    it('forwards Shift modifier through onClick', () => {
        const onClick = vi.fn();
        render(withDnd(<FavoriteCard listing={listing} selected={false} onClick={onClick} />));
        fireEvent.click(screen.getByRole('button'), { shiftKey: true });
        expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ shift: true }));
    });
});
