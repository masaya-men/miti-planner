// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { FilterPanel } from '../../components/housing/workspace/FilterPanel';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
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

beforeEach(() => {
    useHousingFilterStore.getState().clearAll();
    useHousingListingsStore.getState().reset();
    // 件数は共有ストアの実データから。テストは mock 50 件を注入。
    useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
});

function renderPanel(props?: Partial<React.ComponentProps<typeof FilterPanel>>) {
    const onClose = props?.onClose ?? vi.fn();
    const onRegisterClick = props?.onRegisterClick ?? vi.fn();
    return {
        ...render(
            <I18nextProvider i18n={i18n}>
                <FilterPanel onClose={onClose} onRegisterClick={onRegisterClick} />
            </I18nextProvider>,
        ),
        onClose,
        onRegisterClick,
    };
}

describe('FilterPanel', () => {
    it('renders FILTER title and 5 base sections (DC / Region / Area / Size / Theme)', () => {
        renderPanel();
        expect(screen.getByText('FILTER')).toBeInTheDocument();
        expect(screen.getAllByText('DC').length).toBeGreaterThan(0);
        expect(screen.getByText('地域')).toBeInTheDocument();
        expect(screen.getByText('エリア')).toBeInTheDocument();
        expect(screen.getByText('サイズ')).toBeInTheDocument();
        // 'テーマ' label exists; 'テーマ' is also a region in REGION_LABELS? no.
        // chip group title appears once via FilterSection
        expect(screen.getAllByText('テーマ').length).toBeGreaterThanOrEqual(1);
    });

    it('shows result / total = 50 / 50 by default', () => {
        renderPanel();
        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText(`/ ${MOCK_LISTINGS.length}`)).toBeInTheDocument();
    });

    it('selects DC via dropdown and decreases result count', () => {
        renderPanel();
        // ドロップダウンを開いて Mana を選ぶ (単一選択)。
        fireEvent.click(screen.getByRole('button', { name: 'DC' }));
        fireEvent.click(screen.getByRole('option', { name: 'Mana' }));
        expect(useHousingFilterStore.getState().dc).toBe('Mana');
        expect(useHousingFilterStore.getState().resultCount).toBeLessThan(MOCK_LISTINGS.length);
    });

    it('shows Server dropdown only after DC is selected', () => {
        renderPanel();
        expect(screen.queryByText('サーバー')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'DC' }));
        fireEvent.click(screen.getByRole('option', { name: 'Mana' }));
        expect(screen.getByText('サーバー')).toBeInTheDocument();
    });

    it('toggles area via dropdown and updates result count', () => {
        renderPanel();
        const before = useHousingFilterStore.getState().resultCount;
        fireEvent.click(screen.getByRole('button', { name: 'エリア' }));
        fireEvent.click(screen.getByRole('option', { name: 'Shirogane' }));
        expect(useHousingFilterStore.getState().areas).toContain('Shirogane');
        expect(useHousingFilterStore.getState().resultCount).toBeLessThan(before);
    });

    // Apartment チップは Sub-spec 2B で再実装予定のためスキップ
    it.skip('renders apartment chip with localized short label but Apartment aria', () => {
        renderPanel();
        const aptChip = screen.getByRole('button', { name: 'Apartment' });
        expect(aptChip).toBeInTheDocument();
        expect(aptChip.textContent).toBe('Apt');
    });

    it('marks zero result with data-zero=true when no listing matches', () => {
        renderPanel();
        // Mana (JP DC) + 欧州 (Europe region) = empty。ドロップダウンから選択。
        fireEvent.click(screen.getByRole('button', { name: 'DC' }));
        fireEvent.click(screen.getByRole('option', { name: 'Mana' }));
        fireEvent.click(screen.getByRole('button', { name: '地域' }));
        fireEvent.click(screen.getByRole('option', { name: '欧州' }));
        const badge = document.querySelector('.housing-result-count') as HTMLElement;
        expect(badge.getAttribute('data-zero')).toBe('true');
    });

    it('invokes onClose when the close button is clicked', () => {
        const { onClose } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: '左パネルを閉じる' }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('invokes onRegisterClick when the register CTA is clicked', () => {
        const { onRegisterClick } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: 'ハウジング登録モーダルを開く' }));
        expect(onRegisterClick).toHaveBeenCalledOnce();
    });
});
