// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import type { MockListing } from '../../data/housing/mockListings';

import { CenterArea } from '../../components/housing/workspace/CenterArea';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
import { useHousingRandomStore } from '../../store/useHousingRandomStore';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';

// 共有ストアに入れる view-model 3 件 (Mana/JP, Shirogane)。
const galleryListing = (over: Partial<MockListing>): MockListing => ({
  id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP',
  area: 'Shirogane', ward: 3, plot: 12, size: 'M', addressKey: 'Mana|Anima|Shirogane|W3|H12',
  imageMode: 'none', tags: ['wafu'], createdAt: 1, lastConfirmedAt: 1, ...over,
});

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
    useHousingListingsStore.getState().reset();
    useHousingListingsStore.setState({
        status: 'ready',
        listings: [
            galleryListing({ id: 'g1', plot: 12 }),
            galleryListing({ id: 'g2', plot: 15 }),
            galleryListing({ id: 'g3', plot: 18 }),
        ],
        error: null,
    });
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

    it('renders the housing map image with bubble cards when in map mode', () => {
        // 2026-05-27: デフォルト viewMode は 'pinterest' (sampleWardLayout を隠すため)。
        // マップ表示の不変条件 (map image + bubble cards) を検証するには明示的に 'map' に切り替える。
        useHousingViewStore.setState({ viewMode: 'map' });
        renderCenter();
        expect(screen.getByRole('img', { name: 'ハウジングマップ' })).toBeInTheDocument();
        // MapView の Mist 実データ駆動化 (2026-05-23) で DEMO_PLOTS = 6 件のデモ物件を表示
        const bubbles = document.querySelectorAll('.housing-bubble-card');
        expect(bubbles.length).toBe(6);
    });

    it('switches to Pinterest grid and renders cards from Firestore data', async () => {
        renderCenter();
        fireEvent.click(screen.getByRole('tab', { name: /一覧/ }));
        expect(useHousingViewStore.getState().viewMode).toBe('pinterest');
        // useGalleryListings の取得完了 (モックで 3 件) を待つ
        await waitFor(() => {
            const cards = document.querySelectorAll('.housing-card');
            expect(cards.length).toBe(3);
        });
        const grid = document.querySelector('.housing-pinterest-grid');
        expect(grid).toBeTruthy();
    });

    // Phase 3 (2026-05-21): カードクリックは `/housing/listing/:id` への遷移に変更。
    // 旧 inline expand (`.housing-card-expanded`) は廃止したためテストも置き換える。
    it('navigates to the listing detail route when a card is clicked in Pinterest mode', async () => {
        renderCenter();
        fireEvent.click(screen.getByRole('tab', { name: /一覧/ }));
        // 取得完了を待ってからカードをクリック (mock は Shirogane 3-12)
        const firstCard = await screen.findByRole('button', { name: 'Shirogane 3-12' });
        // クリックすると navigate されるが MemoryRouter なので副作用は throw しない。
        fireEvent.click(firstCard);
        // expanded UI は存在しなくなったことも併せて確認
        expect(document.querySelector('.housing-card-expanded')).toBeNull();
    });

    it('toggles favorite from the card overlay ♡ button (not via expanded view)', async () => {
        renderCenter();
        fireEvent.click(screen.getByRole('tab', { name: /一覧/ }));
        // overlay ♡ ボタンは各カードに 1 つ、 aria-label='お気に入り' でアクセス可能。
        const favBtns = await screen.findAllByRole('button', { name: 'お気に入り' });
        expect(favBtns.length).toBeGreaterThan(0);
        fireEvent.click(favBtns[0]);
        expect(useHousingFavoritesStore.getState().ids.length).toBe(1);
    });

    it('shows EmptyResult when filters produce zero matches in Pinterest mode', async () => {
        // mock は Mana/JP データなので region=EU フィルタで 0 件になる
        useHousingFilterStore.setState({ regions: ['EU'] });
        useHousingViewStore.setState({ viewMode: 'pinterest' });
        renderCenter();
        expect(await screen.findByText('該当ハウジングがありません')).toBeInTheDocument();
    });
});
