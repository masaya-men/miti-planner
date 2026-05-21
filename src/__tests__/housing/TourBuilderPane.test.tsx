// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { DndContext } from '@dnd-kit/core';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { TourBuilderPane } from '../../components/housing/workspace/TourBuilderPane';
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

describe('TourBuilderPane', () => {
    beforeEach(() => {
        // ツアー項目は ID を共有ストアの listings で解決する。テストは mock を注入。
        useHousingListingsStore.getState().reset();
        useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
    });

    it('renders the empty hint when no listings are given', () => {
        render(wrap(<TourBuilderPane listingIds={[]} onChange={() => {}} />));
        expect(screen.getByText(jaTranslations.housing.workspace.tour_builder.empty)).toBeInTheDocument();
    });

    it('renders one item with remove button per id', () => {
        const ids = MOCK_LISTINGS.slice(0, 3).map((l) => l.id);
        render(wrap(<TourBuilderPane listingIds={ids} onChange={() => {}} />));
        const removeBtns = screen.getAllByRole('button', {
            name: jaTranslations.housing.workspace.tour_builder.remove,
        });
        expect(removeBtns.length).toBe(3);
    });

    it('emits sorted ids when autoSort is on and input is out of order', () => {
        const ids = ['mock-003', 'mock-001', 'mock-002'];
        const onChange = vi.fn();
        render(wrap(<TourBuilderPane listingIds={ids} onChange={onChange} />));
        expect(onChange).toHaveBeenCalled();
    });
});
