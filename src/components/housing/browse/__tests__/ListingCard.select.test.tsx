// @vitest-environment happy-dom
/**
 * ListingCard: 選択UI・クリック遷移・♡・画像まわり・非破壊回帰。
 * (ListingCard.test.tsx を分割したもの。共通の準備は listingCardTestSetup.tsx)
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useMasterDataStore } from '../../../../store/useMasterDataStore';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

vi.mock('thumbhash', async (orig) => ({
  ...(await orig<typeof import('thumbhash')>()),
  thumbHashToDataURL: () => 'data:image/png;base64,BLURMOCK',
}));



import { mockListing, renderCard, setupListingCardEnv, resetIntersection } from './listingCardTestSetup';

beforeEach(() => {
  navigate.mockReset();
  useTourTrayStore.setState({ trayIds: [], pinnedIds: [] });
  useHousingListingsStore.setState({ listings: [], myListings: [] } as never);
  useMasterDataStore.setState({ config: null } as never);
});

beforeAll(() => {
  setupListingCardEnv();
});

beforeEach(() => {
  resetIntersection();
});

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

describe('ListingCard — 背景にも使うトグル', () => {
  it('selected=falseなら背景トグルは出ない', () => {
    renderCard({ selectable: true, selected: false, onToggleSelect: vi.fn(), onToggleBackground: vi.fn() });
    expect(screen.queryByTestId('housing-card-background-select')).not.toBeInTheDocument();
  });

  it('selected=trueかつonToggleBackground指定なら背景トグルが出る', () => {
    renderCard({ selectable: true, selected: true, onToggleSelect: vi.fn(), onToggleBackground: vi.fn() });
    expect(screen.getByTestId('housing-card-background-select')).toBeInTheDocument();
  });

  it('onToggleBackground未指定なら背景トグルは出ない', () => {
    renderCard({ selectable: true, selected: true, onToggleSelect: vi.fn() });
    expect(screen.queryByTestId('housing-card-background-select')).not.toBeInTheDocument();
  });

  it('背景トグルをクリックするとonToggleBackgroundがlisting.idで呼ばれる', () => {
    const onToggleBackground = vi.fn();
    renderCard({ selectable: true, selected: true, onToggleSelect: vi.fn(), onToggleBackground });
    fireEvent.click(screen.getByTestId('housing-card-background-select'));
    expect(onToggleBackground).toHaveBeenCalledWith(mockListing.id);
  });

  it('isBackground=trueのとき is-selected クラスが付く', () => {
    renderCard({
      selectable: true, selected: true, onToggleSelect: vi.fn(),
      onToggleBackground: vi.fn(), isBackground: true,
    });
    expect(screen.getByTestId('housing-card-background-select')).toHaveClass('is-selected');
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

describe('ListingCard — メイン画像の最適化 (Task 9)', () => {
  it('直接アップロード物件のメイン画像は派生 srcSet + decoding=async を持つ', () => {
    const listing = {
      ...mockListing,
      imageMode: 'thumbnail' as const,
      thumbnailPath: 'https://lopoly.app/housing-media/L1/u.webp',
      thumbnailPaths: ['https://lopoly.app/housing-media/L1/u.webp'],
    };
    const { container } = renderCard({ listing });
    const img = container.querySelector('img.housing-listing-card-img') as HTMLImageElement;
    expect(img.getAttribute('srcset')).toContain('u-480.webp 480w');
    expect(img.getAttribute('srcset')).toContain('u-1440.webp 1440w');
    expect(img.getAttribute('srcset')).not.toContain('1920w'); // カードは原本を入れない
    expect(img.getAttribute('decoding')).toBe('async');
  });

  it('X 物件のメイン画像は ?name=small の src(srcSet なし)', () => {
    const listing = {
      ...mockListing,
      imageMode: 'sns' as const,
      ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg',
      sourceImageUrls: ['https://pbs.twimg.com/media/ABC.jpg'],
    };
    const { container } = renderCard({ listing });
    const img = container.querySelector('img.housing-listing-card-img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://pbs.twimg.com/media/ABC.jpg?name=small');
    expect(img.hasAttribute('srcset')).toBe(false);
  });
});

describe('ListingCard — ThumbHash ぼかしレイヤー (Task 11)', () => {
  it('coverThumbHash があればぼかしレイヤーを敷く', () => {
    const listing = {
      ...mockListing,
      imageMode: 'thumbnail' as const,
      thumbnailPath: 'https://lopoly.app/housing-media/L1/u.webp',
      thumbnailPaths: ['https://lopoly.app/housing-media/L1/u.webp'],
      coverThumbHash: btoa('fakehashbytes'),
    };
    const { container } = renderCard({ listing });
    const blur = container.querySelector('.housing-listing-card-blur') as HTMLElement;
    expect(blur).toBeTruthy();
    expect(blur.style.backgroundImage).toContain('BLURMOCK');
    // load 前はメディア div に data-blur-pending が立ち、CSS でメイン画像を opacity:0 にして
    // ぼかしを見せる (load 完了で外れ、画像が 0→1 にフェードして鮮明画像がぼかしの上に現れる)。
    const media = container.querySelector('.housing-listing-card-media') as HTMLElement;
    expect(media.hasAttribute('data-blur-pending')).toBe(true);
  });

  it('coverThumbHash が無ければぼかしレイヤーは出さない', () => {
    const listing = {
      ...mockListing,
      imageMode: 'sns' as const,
      ogImageUrl: 'https://pbs.twimg.com/media/ABC.jpg',
    };
    const { container } = renderCard({ listing });
    expect(container.querySelector('.housing-listing-card-blur')).toBeNull();
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
