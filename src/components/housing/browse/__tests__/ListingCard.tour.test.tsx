// @vitest-environment happy-dom
/**
 * ListingCard: unlisted の扱い・ツアー追加・生きたカード・ツアー追加フィードバック。
 * (ListingCard.test.tsx を分割したもの。共通の準備は listingCardTestSetup.tsx)
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useMasterDataStore } from '../../../../store/useMasterDataStore';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

vi.mock('thumbhash', async (orig) => ({
  ...(await orig<typeof import('thumbhash')>()),
  thumbHashToDataURL: () => 'data:image/png;base64,BLURMOCK',
}));

import { ListingCard } from '../ListingCard';


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

describe('ListingCard — ツアー追加のフィードバック(2026-08-10)', () => {
  it('追加成功で「追加済み」表示になりaria-pressedがtrueになる', () => {
    const onAddToTour = vi.fn();
    renderCard({ onAddToTour, listing: { ...mockListing, region: 'JP' } });
    const addBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('housing-card-add-btn'),
    )!;
    fireEvent.click(addBtn);
    expect(addBtn).toHaveTextContent('追加済み');
    expect(addBtn).toHaveAttribute('aria-pressed', 'true');
    expect(addBtn).toHaveClass('is-added');
    expect(onAddToTour).toHaveBeenCalledWith(mockListing.id);
  });

  it('追加済みの状態でもう一度押すとトレイから外れ「ツアーに追加」表示に戻る', () => {
    renderCard({ listing: { ...mockListing, region: 'JP' } });
    const addBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('housing-card-add-btn'),
    )!;
    fireEvent.click(addBtn); // 追加
    fireEvent.click(addBtn); // 外す
    expect(addBtn).toHaveTextContent('ツアーに追加');
    expect(addBtn).toHaveAttribute('aria-pressed', 'false');
    expect(useTourTrayStore.getState().trayIds).toEqual([]);
  });

  it('別リージョンのためブロックされたときは onAddToTour を呼ばず吹き出しを出す', () => {
    useHousingListingsStore.setState({
      listings: [{ id: 'other1', region: 'NA' } as never],
      myListings: [],
    } as never);
    useTourTrayStore.setState({ trayIds: ['other1'], pinnedIds: [] });
    const onAddToTour = vi.fn();
    renderCard({ onAddToTour, listing: { ...mockListing, region: 'JP' } });
    const addBtn = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('housing-card-add-btn'),
    )!;
    fireEvent.click(addBtn);
    expect(onAddToTour).not.toHaveBeenCalled();
    expect(screen.getByTestId('housing-tour-error-bubble')).toBeInTheDocument();
    expect(useTourTrayStore.getState().trayIds).toEqual(['other1']);
  });
});

describe('ListingCard — tourAddVariant="overlay" (ハウジンガーページ)', () => {
  const overlayBtn = () => screen.queryAllByTestId('housing-card-add-overlay');

  it('ボタンは 1 個だけ出て、押すとトレイに入り「追加済み」になる (フッターは出ない)', () => {
    const onAddToTour = vi.fn();
    renderCard({ tourAddVariant: 'overlay', onAddToTour, listing: { ...mockListing, region: 'JP', visibility: 'public' } });
    expect(overlayBtn()).toHaveLength(1);
    expect(document.querySelector('.housing-card-add-btn')).toBeNull();
    const btn = overlayBtn()[0];
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(onAddToTour).toHaveBeenCalledWith(mockListing.id);
    expect(useTourTrayStore.getState().trayIds).toEqual([mockListing.id]);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveTextContent('追加済み');
    expect(navigate).not.toHaveBeenCalled(); // カードの詳細遷移は発火しない
  });

  it('住所非公開 (unlisted) ではボタンも印も出ない', () => {
    useTourTrayStore.setState({ trayIds: [mockListing.id], pinnedIds: [] });
    renderCard({ tourAddVariant: 'overlay', listing: { ...mockListing, visibility: 'unlisted' } });
    expect(overlayBtn()).toHaveLength(0);
    expect(screen.queryByTestId('housing-card-added-mark')).not.toBeInTheDocument();
  });

  it('追加済みなら「✓ ツアー」の印が出る / 未追加なら出ない', () => {
    const { unmount } = renderCard({ tourAddVariant: 'overlay', listing: { ...mockListing, visibility: 'public' } });
    expect(screen.queryByTestId('housing-card-added-mark')).not.toBeInTheDocument();
    fireEvent.click(overlayBtn()[0]);
    expect(screen.getByTestId('housing-card-added-mark')).toHaveTextContent('✓ ツアー');
    unmount();
  });

  it('onAddToTour 未指定ならボタンを出さない', () => {
    renderCard({ tourAddVariant: 'overlay', onAddToTour: undefined, listing: { ...mockListing, visibility: 'public' } });
    expect(overlayBtn()).toHaveLength(0);
  });
});
