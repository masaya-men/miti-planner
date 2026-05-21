// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { DndContext } from '@dnd-kit/core';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { FavoritesListPane } from '../../components/housing/workspace/FavoritesListPane';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

beforeAll(() => {
    if (!i18n.isInitialized) {
        i18n.use(initReactI18next).init({
            lng: 'ja',
            fallbackLng: 'ja',
            resources: { ja: { translation: jaTranslations } },
            interpolation: { escapeValue: false },
        });
    }
});

function wrap(ui: React.ReactElement) {
    return (
        <I18nextProvider i18n={i18n}>
            <DndContext>{ui}</DndContext>
        </I18nextProvider>
    );
}

describe('FavoritesListPane', () => {
    beforeEach(() => {
        useHousingFavoritesStore.getState().reset();
        useHousingListingsStore.getState().reset();
        // お気に入りは ID を共有ストアの listings で解決する。テストは mock を注入。
        useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
        MOCK_LISTINGS.slice(0, 5).forEach((l) => useHousingFavoritesStore.getState().add(l.id));
    });

    it('renders one FavoriteCard per favorited listing', () => {
        render(wrap(<FavoritesListPane selected={new Set()} onSelectionChange={() => {}} />));
        const cards = screen.getAllByRole('button').filter((b) => b.getAttribute('data-listing-id'));
        expect(cards.length).toBe(5);
    });

    it('replaces selection on a single (no-modifier) click', () => {
        const onSelectionChange = vi.fn();
        render(wrap(<FavoritesListPane selected={new Set(['mock-001'])} onSelectionChange={onSelectionChange} />));
        const cards = screen.getAllByRole('button').filter((b) => b.getAttribute('data-listing-id'));
        fireEvent.click(cards[1]);
        expect(onSelectionChange).toHaveBeenCalled();
        const newSet = onSelectionChange.mock.calls[0][0] as Set<string>;
        expect(newSet.size).toBe(1);
        expect(newSet.has(cards[1].getAttribute('data-listing-id')!)).toBe(true);
    });

    it('shows the empty state when no favorites are stored', () => {
        useHousingFavoritesStore.getState().reset();
        render(wrap(<FavoritesListPane selected={new Set()} onSelectionChange={() => {}} />));
        expect(screen.getByText(jaTranslations.housing.workspace.favorites.empty)).toBeInTheDocument();
    });
});
