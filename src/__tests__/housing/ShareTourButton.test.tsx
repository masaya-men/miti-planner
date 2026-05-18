// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { ShareTourButton } from '../../components/housing/workspace/ShareTourButton';

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

describe('ShareTourButton', () => {
    it('renders share label initially', () => {
        render(wrap(<ShareTourButton tourId="abc123" />));
        expect(screen.getByRole('button')).toHaveTextContent(jaTranslations.housing.workspace.tour.share);
    });

    it('writes share URL containing tour id to clipboard on click', async () => {
        // happy-dom exposes navigator.clipboard via a getter only, so we have to
        // redefine the property descriptor instead of using Object.assign.
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
        render(wrap(<ShareTourButton tourId="abc123" />));
        fireEvent.click(screen.getByRole('button'));
        await Promise.resolve();
        expect(writeText).toHaveBeenCalledOnce();
        expect(writeText.mock.calls[0][0]).toContain('/housing/tour/abc123');
    });
});
