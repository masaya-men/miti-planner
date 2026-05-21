// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { RightPanel } from '../../components/housing/workspace/RightPanel';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { useHousingTourStore } from '../../store/useHousingTourStore';
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

describe('RightPanel', () => {
    beforeEach(() => {
        useHousingViewStore.getState().reset();
        useHousingTourStore.getState().reset();
        useHousingListingsStore.getState().reset();
        // 一覧系は共有ストアから読む。テストは mock データを直接注入 (load は呼ばない)。
        useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
        sessionStorage.clear();
    });

    it('renders the auto-scroll list in browse mode', () => {
        render(wrap(<RightPanel onClose={() => {}} />));
        // browse mode で複数の listing item + 1 close button
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(3);
    });

    it('switches to tour progress when entering tour mode', () => {
        useHousingTourStore.getState().setListings([MOCK_LISTINGS[0].id]);
        useHousingTourStore.getState().start();
        useHousingViewStore.getState().enterTourMode();
        render(wrap(<RightPanel onClose={() => {}} />));
        expect(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.tour.share_aria }),
        ).toBeInTheDocument();
    });

    it('hides the close button while in tour mode (panel locked)', () => {
        useHousingTourStore.getState().setListings([MOCK_LISTINGS[0].id]);
        useHousingTourStore.getState().start();
        useHousingViewStore.getState().enterTourMode();
        render(wrap(<RightPanel onClose={() => {}} />));
        const closeBtn = screen.queryByRole('button', {
            name: jaTranslations.housing.workspace.panel.close_right,
        });
        expect(closeBtn).toBeNull();
    });
});
