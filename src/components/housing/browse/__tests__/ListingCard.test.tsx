// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { ListingCard } from '../ListingCard';

const mockListing = MOCK_LISTINGS[0];

beforeEach(() => {
  navigate.mockReset();
});

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });

  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
      } as unknown as MediaQueryList);
  }
});

function renderCard(props: Partial<Parameters<typeof ListingCard>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ListingCard listing={mockListing} onAddToTour={() => {}} {...props} />
    </I18nextProvider>
  );
}

describe('ListingCard — selectable (選択UI)', () => {
  it('selectable未指定なら housing-card-select は描画されない', () => {
    renderCard();
    expect(screen.queryByTestId('housing-card-select')).not.toBeInTheDocument();
  });

  it('selectable=trueなら housing-card-select が描画される', () => {
    renderCard({ selectable: true, selected: false, onToggleSelect: vi.fn() });
    expect(screen.getByTestId('housing-card-select')).toBeInTheDocument();
  });

  it('選択チェックをクリックすると onToggleSelect が listing.id で呼ばれる', () => {
    const onToggle = vi.fn();
    renderCard({ selectable: true, selected: false, onToggleSelect: onToggle });
    fireEvent.click(screen.getByTestId('housing-card-select'));
    expect(onToggle).toHaveBeenCalledWith(mockListing.id);
  });

  it('selected=trueのとき is-selected クラスが付く', () => {
    renderCard({ selectable: true, selected: true, onToggleSelect: vi.fn() });
    expect(screen.getByTestId('housing-card-select')).toHaveClass('is-selected');
  });
});

describe('ListingCard — ♡と選択の独立性', () => {
  it('選択クリックが ♡(favorites)状態を変えない', () => {
    useHousingFavoritesStore.setState({ ids: [] });
    const onToggle = vi.fn();
    renderCard({ selectable: true, selected: false, onToggleSelect: onToggle });
    const before = useHousingFavoritesStore.getState().ids.slice();
    fireEvent.click(screen.getByTestId('housing-card-select'));
    expect(useHousingFavoritesStore.getState().ids).toEqual(before);
  });
});

describe('ListingCard — カードクリックで詳細へ (B9)', () => {
  it('カード本体クリックで /housing/listing/{id} へ遷移する', () => {
    renderCard();
    fireEvent.click(screen.getByTestId('housing-listing-card'));
    expect(navigate).toHaveBeenCalledWith(`/housing/listing/${mockListing.id}`);
  });

  it('Enter キーでも遷移する (キーボード操作)', () => {
    renderCard();
    fireEvent.keyDown(screen.getByTestId('housing-listing-card'), { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith(`/housing/listing/${mockListing.id}`);
  });

  it('ツアー追加クリックでは遷移しない', () => {
    const onAddToTour = vi.fn();
    renderCard({ onAddToTour });
    const addBtn = screen.getAllByRole('button').find(
      (btn) => btn.className.includes('housing-card-add-btn')
    );
    fireEvent.click(addBtn!);
    expect(onAddToTour).toHaveBeenCalledWith(mockListing.id);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('♡クリックでは遷移しない', () => {
    useHousingFavoritesStore.setState({ ids: [] });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'お気に入り' }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('選択チェッククリックでは遷移しない', () => {
    renderCard({ selectable: true, selected: false, onToggleSelect: vi.fn() });
    fireEvent.click(screen.getByTestId('housing-card-select'));
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('ListingCard — onCardClick override', () => {
  it('onCardClick 指定時、カード本体クリックは navigate せず onCardClick を呼ぶ', () => {
    const onCardClick = vi.fn();
    renderCard({ onCardClick });
    fireEvent.click(screen.getByTestId('housing-listing-card'));
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('onCardClick 指定時、Enter キーでも navigate せず onCardClick を呼ぶ', () => {
    const onCardClick = vi.fn();
    renderCard({ onCardClick });
    fireEvent.keyDown(screen.getByTestId('housing-listing-card'), { key: 'Enter' });
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('onCardClick 指定時でも♡クリックは onCardClick を呼ばない (stopPropagation 維持)', () => {
    useHousingFavoritesStore.setState({ ids: [] });
    const onCardClick = vi.fn();
    renderCard({ onCardClick });
    fireEvent.click(screen.getByRole('button', { name: 'お気に入り' }));
    expect(onCardClick).not.toHaveBeenCalled();
  });
});

describe('ListingCard — YouTubeサムネ フォールバック配線 (灰色プレースホルダ根治)', () => {
  const ytListing = {
    ...mockListing,
    imageMode: 'sns' as const,
    ogImageUrl: 'https://img.youtube.com/vi/Ypg8w7Dmq9o/maxresdefault.jpg',
  };

  it('maxresdefault が 120x90 グレー画像 (HTTP 200) として load されたら hqdefault へ差し替える', () => {
    const { container } = renderCard({ listing: ytListing });
    const img = container.querySelector('.housing-listing-card-img') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('maxresdefault.jpg');
    // maxresdefault 不在動画: YouTube は 404 でなく 120x90 のグレーTV画像を 200 で返す
    Object.defineProperty(img, 'naturalWidth', { value: 120, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 90, configurable: true });
    fireEvent.load(img);
    expect(img.src).toContain('hqdefault.jpg');
  });

  it('404 (onError) でも次段 quality (hqdefault) へ差し替える', () => {
    const { container } = renderCard({ listing: ytListing });
    const img = container.querySelector('.housing-listing-card-img') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.src).toContain('hqdefault.jpg');
  });
});

describe('ListingCard — 非破壊回帰(selectable未指定)', () => {
  it('♡クリックでfavoritesにIDが追加される', () => {
    useHousingFavoritesStore.setState({ ids: [] });
    renderCard();
    // aria-label は翻訳済み（「お気に入り」）
    const favBtn = screen.getByRole('button', { name: 'お気に入り' });
    fireEvent.click(favBtn);
    expect(useHousingFavoritesStore.getState().ids).toContain(mockListing.id);
  });

  it('onAddToTour が listing.id で呼ばれる', () => {
    const onAddToTour = vi.fn();
    renderCard({ onAddToTour });
    // ツアー追加ボタンをクリック
    const addBtn = screen.getAllByRole('button').find(
      (btn) => btn.className.includes('housing-card-add-btn')
    );
    expect(addBtn).toBeTruthy();
    fireEvent.click(addBtn!);
    expect(onAddToTour).toHaveBeenCalledWith(mockListing.id);
  });
});

describe('ListingCard — unlisted は住所を出さない (住所漏洩防止)', () => {
  // galleryAdapter の窓口で unlisted は住所系フィールドが undefined になる。title 未入力時の
  // フォールバックが formatHousingAddress (area 名等) に落ちず、addressPrivate になることを確認する。
  const unlistedListing = {
    ...mockListing,
    title: undefined,
    visibility: 'unlisted' as const,
    area: undefined,
    ward: undefined,
    dc: undefined,
    server: undefined,
    region: undefined,
    plot: undefined,
    addressKey: undefined,
  };

  it('title 未入力 + unlisted は housing.card.addressPrivate を表示する', () => {
    renderCard({ listing: unlistedListing });
    expect(screen.getByText('住所は非公開です')).toBeInTheDocument();
  });

  it('formatHousingAddress の結果 (area 名等) は表示しない', () => {
    renderCard({ listing: unlistedListing });
    // MOCK_LISTINGS[0] は Shirogane なので、通常表示なら和名 (シロガネ) 等が出るはず。
    expect(screen.queryByText(/シロガネ/)).not.toBeInTheDocument();
  });
});

describe('ListingCard — ツアー追加ボタン (unlisted は無効化・Task7)', () => {
  const unlistedListing = { ...mockListing, visibility: 'unlisted' as const };
  const publicListing = { ...mockListing, visibility: 'public' as const };

  it('unlisted のツアー追加ボタンは disabled になる', () => {
    renderCard({ listing: unlistedListing });
    const addBtn = screen.getAllByRole('button').find(
      (btn) => btn.className.includes('housing-card-add-btn')
    );
    expect(addBtn).toBeDisabled();
  });

  it('unlisted のツアー追加ボタンをクリックしても onAddToTour は呼ばれない', () => {
    const onAddToTour = vi.fn();
    renderCard({ listing: unlistedListing, onAddToTour });
    const addBtn = screen.getAllByRole('button').find(
      (btn) => btn.className.includes('housing-card-add-btn')
    );
    fireEvent.click(addBtn!);
    expect(onAddToTour).not.toHaveBeenCalled();
  });

  it('public のツアー追加ボタンは従来どおり有効で onAddToTour が呼ばれる', () => {
    const onAddToTour = vi.fn();
    renderCard({ listing: publicListing, onAddToTour });
    const addBtn = screen.getAllByRole('button').find(
      (btn) => btn.className.includes('housing-card-add-btn')
    );
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn!);
    expect(onAddToTour).toHaveBeenCalledWith(publicListing.id);
  });
});

describe('ListingCard — 生きたカード配線 (段階2)', () => {
  const multiImage = {
    ...mockListing,
    imageMode: 'sns' as const,
    sourceImageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  };

  it('Provider 配下では ambient スライドショーが media 内に描画される (複数画像)', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <ListingCard listing={multiImage} onAddToTour={() => {}} />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    const media = container.querySelector('.housing-listing-card-media');
    expect(media?.querySelector('.housing-card-ambient-slideshow')).not.toBeNull();
    // フレーム数分の img (sourceImageUrls 2 枚)
    expect(media?.querySelectorAll('.housing-card-ambient-slideshow img')).toHaveLength(2);
  });

  it('ベース img (.housing-listing-card-img) は残る (静止フォールバック・非破壊)', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <ListingCard listing={multiImage} onAddToTour={() => {}} />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-listing-card-img')).not.toBeNull();
  });
});
