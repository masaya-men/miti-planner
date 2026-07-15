// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import { MannerNoticeDialog } from '../../components/housing/workspace/MannerNoticeDialog';

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

    it('「次回から表示しない」チェックボックスは廃止されている(毎回表示・#4)', () => {
        render(wrap(<MannerNoticeDialog open={true} onCancel={() => {}} onStart={() => {}} />));
        expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('「はじめる」で onStart を呼ぶ(永続化なし)', () => {
        const onStart = vi.fn();
        render(wrap(<MannerNoticeDialog open={true} onCancel={() => {}} onStart={onStart} />));
        fireEvent.click(
            screen.getByRole('button', { name: jaTranslations.housing.workspace.manner.start }),
        );
        expect(onStart).toHaveBeenCalledOnce();
    });
});
