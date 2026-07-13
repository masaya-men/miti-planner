// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { FilterPanel } from '../../components/housing/workspace/FilterPanel';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { useHousingViewStore } from '../../store/useHousingViewStore';
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
    // browseView を既定 (list) に戻す。地域外DC自動クリアは地図モードでは無効化されるため。
    useHousingViewStore.getState().reset();
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
        expect(screen.getAllByText('データセンター').length).toBeGreaterThan(0);
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
        fireEvent.click(screen.getByRole('button', { name: 'データセンター' }));
        fireEvent.click(screen.getByRole('option', { name: 'Mana' }));
        expect(useHousingFilterStore.getState().dc).toBe('Mana');
        expect(useHousingFilterStore.getState().resultCount).toBeLessThan(MOCK_LISTINGS.length);
    });

    it('shows Server dropdown only after DC is selected', () => {
        renderPanel();
        expect(screen.queryByText('サーバー')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'データセンター' }));
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

    it('narrows DC options to the selected region (④ 地域連動)', () => {
        renderPanel();
        act(() => useHousingFilterStore.getState().toggleRegion('JP'));
        fireEvent.click(screen.getByRole('button', { name: 'データセンター' }));
        // 日本を選ぶと NA の DC (Aether) は候補に出ず、JP の DC (Mana) は出る。
        expect(screen.queryByRole('option', { name: 'Aether' })).toBeNull();
        expect(screen.getByRole('option', { name: 'Mana' })).toBeInTheDocument();
    });

    it('auto-clears a selected DC when its region goes out of range (④ 残留フィルタ防止)', () => {
        renderPanel();
        fireEvent.click(screen.getByRole('button', { name: 'データセンター' }));
        fireEvent.click(screen.getByRole('option', { name: 'Mana' }));
        expect(useHousingFilterStore.getState().dc).toBe('Mana');
        // 北米を選ぶと Mana (JP) は範囲外 → 自動クリア (servers も連鎖クリア)。
        act(() => useHousingFilterStore.getState().toggleRegion('NA'));
        expect(useHousingFilterStore.getState().dc).toBeNull();
        expect(useHousingFilterStore.getState().servers).toEqual([]);
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
        // 地域×DC の矛盾は地域連動 (地域を選ぶと DC がその地域配下に絞られ、範囲外 DC は
        // 自動クリア) で解消されるため、確実に 0 件を作れる検索キーワードで検証する。
        act(() => {
            useHousingFilterStore.getState().setKeyword('__no_such_listing_zzz__');
        });
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
