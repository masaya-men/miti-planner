// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { FavoritesModal } from '../../components/housing/workspace/FavoritesModal';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';
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
});

function wrap(ui: React.ReactElement) {
    return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('FavoritesModal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useHousingFavoritesStore.getState().reset();
        useHousingTourStore.getState().reset();
        useHousingViewStore.getState().reset();
        useHousingListingsStore.getState().reset();
        useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
        localStorage.clear();
        sessionStorage.clear();
        MOCK_LISTINGS.slice(0, 3).forEach((l) => useHousingFavoritesStore.getState().add(l.id));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // §7.5 "入った瞬間に並び替えがアニメーションで可視化される" — FavoritesModal
    // stages tour ids first, then waits this long for the FLIP animation to
    // play before opening the manner notice or starting the tour.
    const STAGE_DELAY_MS = 700;

    it('renders nothing when closed', () => {
        const { container } = render(wrap(<FavoritesModal open={false} onClose={() => {}} />));
        expect(container.firstChild).toBeNull();
    });

    it('renders the run-all and close buttons when open', () => {
        render(wrap(<FavoritesModal open={true} onClose={() => {}} />));
        expect(
            screen.getByRole('button', { name: new RegExp(jaTranslations.housing.workspace.favorites.run_all) }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.favorites.close_modal }),
        ).toBeInTheDocument();
    });

    it('invokes onClose when the close button is clicked', () => {
        const onClose = vi.fn();
        render(wrap(<FavoritesModal open={true} onClose={onClose} />));
        fireEvent.click(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.favorites.close_modal }),
        );
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('opens the manner notice when starting a tour (first time)', () => {
        render(wrap(<FavoritesModal open={true} onClose={() => {}} />));
        const runAll = screen.getByRole('button', { name: new RegExp(jaTranslations.housing.workspace.favorites.run_all) });
        fireEvent.click(runAll);
        // Stage animation runs first; manner notice appears only after the delay.
        act(() => { vi.advanceTimersByTime(STAGE_DELAY_MS); });
        expect(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.manner.start }),
        ).toBeInTheDocument();
    });

    it('starts the tour and enters tour mode after confirming the manner notice', () => {
        const onClose = vi.fn();
        render(wrap(<FavoritesModal open={true} onClose={onClose} />));
        fireEvent.click(
            screen.getByRole('button', { name: new RegExp(jaTranslations.housing.workspace.favorites.run_all) }),
        );
        act(() => { vi.advanceTimersByTime(STAGE_DELAY_MS); });
        fireEvent.click(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.manner.start }),
        );
        expect(useHousingTourStore.getState().running).toBe(true);
        expect(useHousingTourStore.getState().listingIds.length).toBe(3);
        expect(useHousingViewStore.getState().mode).toBe('tour');
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('skips the manner notice when already dismissed', () => {
        localStorage.setItem('housing-manner-dismissed', 'true');
        const onClose = vi.fn();
        render(wrap(<FavoritesModal open={true} onClose={onClose} />));
        fireEvent.click(
            screen.getByRole('button', { name: new RegExp(jaTranslations.housing.workspace.favorites.run_all) }),
        );
        // Even when manner is dismissed, the stage animation delay still applies.
        act(() => { vi.advanceTimersByTime(STAGE_DELAY_MS); });
        expect(screen.queryByRole('button', { name: jaTranslations.housing.workspace.manner.start })).toBeNull();
        expect(useHousingTourStore.getState().running).toBe(true);
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('disables run-all when there are no favorites', () => {
        useHousingFavoritesStore.getState().reset();
        render(wrap(<FavoritesModal open={true} onClose={() => {}} />));
        const runAll = screen.getByRole('button', { name: new RegExp(jaTranslations.housing.workspace.favorites.run_all) });
        expect(runAll).toBeDisabled();
    });
});
