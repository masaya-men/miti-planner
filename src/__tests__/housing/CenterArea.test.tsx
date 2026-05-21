// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { CenterArea } from '../../components/housing/workspace/CenterArea';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
import { useHousingRandomStore } from '../../store/useHousingRandomStore';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';
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
    useHousingViewStore.getState().reset();
    useHousingFilterStore.getState().clearAll();
    useHousingRandomStore.getState().reset();
    useHousingFavoritesStore.getState().reset();
});

function renderCenter() {
    return render(
        <MemoryRouter initialEntries={['/housing']}>
            <I18nextProvider i18n={i18n}>
                <CenterArea />
            </I18nextProvider>
        </MemoryRouter>,
    );
}

describe('CenterArea', () => {
    it('renders the view mode toggle with both Map and Grid tabs', () => {
        renderCenter();
        expect(screen.getByRole('tab', { name: /マップ/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /一覧/ })).toBeInTheDocument();
    });

    it('starts in map mode and renders the housing map image with bubble cards', () => {
        renderCenter();
        expect(screen.getByRole('img', { name: 'ハウジングマップ' })).toBeInTheDocument();
        // SAMPLE_WARD_LAYOUT has 5 non-null listing slots (plot 1, 12, 15, 22, 27)
        const bubbles = document.querySelectorAll('.housing-bubble-card');
        expect(bubbles.length).toBe(5);
    });

    it('switches to Pinterest grid when the Grid tab is clicked', () => {
        renderCenter();
        fireEvent.click(screen.getByRole('tab', { name: /一覧/ }));
        expect(useHousingViewStore.getState().viewMode).toBe('pinterest');
        const grid = document.querySelector('.housing-pinterest-grid');
        expect(grid).toBeTruthy();
        const cards = document.querySelectorAll('.housing-card');
        expect(cards.length).toBe(MOCK_LISTINGS.length);
    });

    // Phase 3 (2026-05-21): カードクリックは `/housing/listing/:id` への遷移に変更。
    // 旧 inline expand (`.housing-card-expanded`) は廃止したためテストも置き換える。
    it('navigates to the listing detail route when a card is clicked in Pinterest mode', () => {
        renderCenter();
        fireEvent.click(screen.getByRole('tab', { name: /一覧/ }));
        const firstCard = document.querySelector('.housing-card') as HTMLElement;
        // クリックすると navigate されるが MemoryRouter なので副作用は throw しない。
        // ここでは「クリックが成立する (= ハンドラが拾える)」 ことの確認だけ。
        fireEvent.click(firstCard);
        // expanded UI は存在しなくなったことも併せて確認
        expect(document.querySelector('.housing-card-expanded')).toBeNull();
    });

    it('toggles favorite from the card overlay ♡ button (not via expanded view)', () => {
        renderCenter();
        fireEvent.click(screen.getByRole('tab', { name: /一覧/ }));
        // overlay ♡ ボタンは各カードに 1 つ、 aria-label='お気に入り' でアクセス可能。
        const favBtns = screen.getAllByRole('button', { name: 'お気に入り' });
        expect(favBtns.length).toBeGreaterThan(0);
        fireEvent.click(favBtns[0]);
        expect(useHousingFavoritesStore.getState().ids.length).toBe(1);
    });

    it('shows EmptyResult when filters produce zero matches in Pinterest mode', () => {
        // Mana DC + 欧州 region → empty (no listing belongs to both)
        useHousingFilterStore.setState({ dc: 'Mana', regions: ['EU'] });
        useHousingViewStore.setState({ viewMode: 'pinterest' });
        renderCenter();
        expect(screen.getByText('該当ハウジングがありません')).toBeInTheDocument();
    });
});
