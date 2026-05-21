// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { TourProgressList } from '../../components/housing/workspace/TourProgressList';
import { useHousingTourStore } from '../../store/useHousingTourStore';
import { useHousingViewStore } from '../../store/useHousingViewStore';
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
    if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = () => {};
    }
});

function wrap(ui: React.ReactElement) {
    return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('TourProgressList', () => {
    beforeEach(() => {
        useHousingTourStore.getState().reset();
        useHousingViewStore.getState().reset();
        useHousingListingsStore.getState().reset();
        useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
        useHousingTourStore.getState().setListings(MOCK_LISTINGS.slice(0, 3).map((l) => l.id));
        useHousingTourStore.getState().start();
    });

    it('renders share button and exit button', () => {
        render(wrap(<TourProgressList tourId="t-xyz" />));
        expect(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.tour.share_aria }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.tour.exit_aria }),
        ).toBeInTheDocument();
    });

    it('marks the current step as active', () => {
        const { container } = render(wrap(<TourProgressList tourId="t-xyz" />));
        const active = container.querySelector('[data-active="true"]');
        expect(active).toBeTruthy();
    });

    it('renders one row per tour listing (plus share + exit)', () => {
        render(wrap(<TourProgressList tourId="t-xyz" />));
        const buttons = screen.getAllByRole('button');
        // 3 listing rows + share + exit
        expect(buttons.length).toBe(5);
    });

    it('exit button stops the tour and exits tour mode', () => {
        useHousingViewStore.getState().enterTourMode();
        render(wrap(<TourProgressList tourId="t-xyz" />));
        const exitBtn = screen.getByRole('button', { name: jaTranslations.housing.workspace.tour.exit_aria });
        exitBtn.click();
        expect(useHousingTourStore.getState().running).toBe(false);
        expect(useHousingViewStore.getState().mode).toBe('browse');
    });
});
