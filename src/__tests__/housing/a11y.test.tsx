// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { HousingWorkspace } from '../../components/housing/workspace/HousingWorkspace';
import { useHousingViewStore } from '../../store/useHousingViewStore';

beforeAll(() => {
    i18n.use(initReactI18next).init({
        lng: 'ja',
        fallbackLng: 'ja',
        resources: { ja: { translation: jaTranslations } },
        interpolation: { escapeValue: false },
    });

    if (!window.matchMedia) {
        (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) => ({
            matches: false, media: query, onchange: null,
            addListener: () => {}, removeListener: () => {},
            addEventListener: () => {}, removeEventListener: () => {},
            dispatchEvent: () => false,
        } as unknown as MediaQueryList);
    }
    if (typeof (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
        (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }
});

afterEach(() => {
    useHousingViewStore.getState().reset();
});

function renderWorkspace() {
    return render(
        <I18nextProvider i18n={i18n}>
            <MemoryRouter>
                <HousingWorkspace />
            </MemoryRouter>
        </I18nextProvider>
    );
}

describe('a11y smoke test for HousingWorkspace', () => {
    it('every <button> has either visible text or aria-label or aria-labelledby', () => {
        const { container } = renderWorkspace();
        const buttons = container.querySelectorAll('button');
        const offenders: string[] = [];
        buttons.forEach((b) => {
            const text = (b.textContent || '').trim();
            const label = b.getAttribute('aria-label');
            const labelledBy = b.getAttribute('aria-labelledby');
            const ok =
                text.length > 0 ||
                (label !== null && label.length > 0) ||
                (labelledBy !== null && labelledBy.length > 0);
            if (!ok) {
                offenders.push(b.outerHTML.slice(0, 200));
            }
        });
        if (offenders.length > 0) {
            // eslint-disable-next-line no-console
            console.error('Buttons without accessible name:', offenders);
        }
        expect(offenders).toEqual([]);
    });

    it('every <img> has an alt attribute (empty string OK for decorative images)', () => {
        const { container } = renderWorkspace();
        const imgs = container.querySelectorAll('img');
        imgs.forEach((img) => {
            expect(img.getAttribute('alt')).not.toBeNull();
        });
    });
});
