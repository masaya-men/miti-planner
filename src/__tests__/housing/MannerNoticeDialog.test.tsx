// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import {
    MannerNoticeDialog,
    isMannerNoticeDismissed,
} from '../../components/housing/workspace/MannerNoticeDialog';

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

describe('MannerNoticeDialog', () => {
    beforeEach(() => localStorage.clear());

    it('does not render anything when open=false', () => {
        const { container } = render(wrap(<MannerNoticeDialog open={false} onCancel={() => {}} onStart={() => {}} />));
        expect(container.firstChild).toBeNull();
    });

    it('renders title + start button when open', () => {
        render(wrap(<MannerNoticeDialog open={true} onCancel={() => {}} onStart={() => {}} />));
        expect(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.manner.start }),
        ).toBeInTheDocument();
    });

    it('persists dismissal when the checkbox is checked at start time', () => {
        const onStart = vi.fn();
        render(wrap(<MannerNoticeDialog open={true} onCancel={() => {}} onStart={onStart} />));
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.manner.start }),
        );
        expect(onStart).toHaveBeenCalledOnce();
        expect(isMannerNoticeDismissed()).toBe(true);
    });

    it('does NOT persist when the checkbox is left unchecked', () => {
        const onStart = vi.fn();
        render(wrap(<MannerNoticeDialog open={true} onCancel={() => {}} onStart={onStart} />));
        fireEvent.click(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.manner.start }),
        );
        expect(onStart).toHaveBeenCalledOnce();
        expect(isMannerNoticeDismissed()).toBe(false);
    });
});
