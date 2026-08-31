// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useMasterDataStore } from '../../../../store/useMasterDataStore';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { ListingCard, staggerDelayMs } from '../ListingCard';

const mockListing = MOCK_LISTINGS[0];

beforeEach(() => {
  navigate.mockReset();
  useTourTrayStore.setState({ trayIds: [], pinnedIds: [] });
  useHousingListingsStore.setState({ listings: [], myListings: [] } as never);
  useMasterDataStore.setState({ config: null } as never);
});

// NEWビーム演出 (ListingCard.tsx) の IntersectionObserver をモック。happy-dom は実際の
// 交差判定をしないため、テスト側で「画面内に入った」を疑似的に発火できるようにする。
let ioCallback: IntersectionObserverCallback | null = null;
class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) { ioCallback = cb; }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
function fireIntersection(isIntersecting: boolean): void {
  act(() => {
    ioCallback?.(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

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

  (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

beforeEach(() => {
  ioCallback = null;
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

describe('ListingCard — NEWリボン (2026-08-16・探すページ限定)', () => {
  const recentListing = { ...mockListing, createdAt: Date.now() };
  const oldListing = { ...mockListing, createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000 };

  it('showNewBadge未指定なら投稿が新しくてもリボンは出ない', () => {
    renderCard({ listing: recentListing });
    expect(screen.queryByTestId('housing-card-new-ribbon')).not.toBeInTheDocument();
  });

  it('showNewBadge=true + 7日以内の投稿ならリボンが出る', () => {
    renderCard({ listing: recentListing, showNewBadge: true });
    expect(screen.getByTestId('housing-card-new-ribbon')).toBeInTheDocument();
    expect(screen.getByTestId('housing-card-new-ribbon')).toHaveTextContent('NEW');
  });

  it('管理画面の設定 (newListingWindowDays) を優先する: 3日設定なら5日前の投稿はリボン無し', () => {
    useMasterDataStore.setState({ config: { newListingWindowDays: 3 } } as never);
    const fiveDaysAgo = { ...mockListing, createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000 };
    renderCard({ listing: fiveDaysAgo, showNewBadge: true });
    expect(screen.queryByTestId('housing-card-new-ribbon')).not.toBeInTheDocument();
  });

  it('管理画面の設定 (newListingWindowDays) を優先する: 10日設定なら8日前の投稿でもリボンが出る', () => {
    useMasterDataStore.setState({ config: { newListingWindowDays: 10 } } as never);
    renderCard({ listing: oldListing, showNewBadge: true }); // oldListing = 8日前
    expect(screen.getByTestId('housing-card-new-ribbon')).toBeInTheDocument();
  });

  it('showNewBadge=true でも7日より前の投稿ならリボンは出ない', () => {
    renderCard({ listing: oldListing, showNewBadge: true });
    expect(screen.queryByTestId('housing-card-new-ribbon')).not.toBeInTheDocument();
  });

  it('マウント直後 (まだ画面内に入っていない) はビーム演出が付かない (画面外での無駄光り防止)', () => {
    renderCard({ listing: recentListing, showNewBadge: true });
    const cardEl = screen.getByTestId('housing-listing-card');
    expect(cardEl).not.toHaveClass('housing-card-new-beam');
    expect(cardEl.querySelector('.housing-card-new-beam-glow')).toBeNull();
  });

  it('管理者が pinnedNewUntil を未来に設定していれば、投稿が古くてもリボンが出る (2026-08-24)', () => {
    const pinnedOld = {
      ...oldListing,
      pinnedNewUntil: Date.now() + 3 * 24 * 60 * 60 * 1000,
    };
    renderCard({ listing: pinnedOld, showNewBadge: true });
    expect(screen.getByTestId('housing-card-new-ribbon')).toBeInTheDocument();
  });

  it('pinnedNewUntil が過去なら (期限切れ)、投稿が新しくなくても自動判定にフォールバックする (2026-08-24)', () => {
    const expiredPin = {
      ...oldListing,
      pinnedNewUntil: Date.now() - 1000,
    };
    renderCard({ listing: expiredPin, showNewBadge: true });
    expect(screen.queryByTestId('housing-card-new-ribbon')).not.toBeInTheDocument();
  });

  it('pinnedNewUntil が設定されていても showNewBadge=false なら出ない (2026-08-24)', () => {
    const pinnedOld = {
      ...oldListing,
      pinnedNewUntil: Date.now() + 3 * 24 * 60 * 60 * 1000,
    };
    renderCard({ listing: pinnedOld });
    expect(screen.queryByTestId('housing-card-new-ribbon')).not.toBeInTheDocument();
  });

  it('IntersectionObserverが交差(isIntersecting)を通知したらビーム演出クラス+光る輪が付く', () => {
    renderCard({ listing: recentListing, showNewBadge: true });
    fireIntersection(true);
    const cardEl = screen.getByTestId('housing-listing-card');
    expect(cardEl).toHaveClass('housing-card-new-beam');
    expect(cardEl.querySelector('.housing-card-new-beam-glow')).not.toBeNull();
  });

  it('isIntersecting=false の通知だけでは付かない (実際に交差するまで待つ)', () => {
    renderCard({ listing: recentListing, showNewBadge: true });
    fireIntersection(false);
    expect(screen.getByTestId('housing-listing-card')).not.toHaveClass('housing-card-new-beam');
  });

  it('画面外に出て(false)また入る(true)と、光る輪のDOM要素が作り直される (再生のkeyが変わる)', () => {
    renderCard({ listing: recentListing, showNewBadge: true });
    fireIntersection(true);
    const cardEl = screen.getByTestId('housing-listing-card');
    const firstGlow = cardEl.querySelector('.housing-card-new-beam-glow');
    expect(firstGlow).not.toBeNull();

    fireIntersection(false); // 画面外へ
    fireIntersection(true); // 再度画面内へ

    const secondGlow = cardEl.querySelector('.housing-card-new-beam-glow');
    expect(secondGlow).not.toBeNull();
    expect(secondGlow).not.toBe(firstGlow); // 同一要素の使い回しではなく作り直されている
  });

  it('画面内に居続けたまま同じ交差通知が重複しても作り直さない (無駄な再生をしない)', () => {
    renderCard({ listing: recentListing, showNewBadge: true });
    fireIntersection(true);
    const cardEl = screen.getByTestId('housing-listing-card');
    const firstGlow = cardEl.querySelector('.housing-card-new-beam-glow');

    fireIntersection(true); // 画面内のまま再通知 (実際のIOでも起こりうる)

    expect(cardEl.querySelector('.housing-card-new-beam-glow')).toBe(firstGlow);
  });

  it('リボン非表示のときはビーム演出クラスが付かない (既存構造を変えない)', () => {
    renderCard({ listing: oldListing, showNewBadge: true });
    fireIntersection(true);
    expect(screen.getByTestId('housing-listing-card')).not.toHaveClass('housing-card-new-beam');
  });

  it('光る輪に listing.id 由来の --beam-delay CSS変数が付く (複数カード同時発光を避けるずらし)', () => {
    // 実際に回転しているのは疑似要素 (::before) で React の style を直接当てられないため、
    // CSS変数 (--beam-delay) 経由で橋渡しする。素の style.animationDelay ではなく
    // カスタムプロパティを確認する (2026-08-16 実機指摘で判明したバグの回帰防止)。
    renderCard({ listing: recentListing, showNewBadge: true });
    fireIntersection(true);
    const glow = screen.getByTestId('housing-listing-card').querySelector('.housing-card-new-beam-glow') as HTMLElement;
    expect(glow.style.getPropertyValue('--beam-delay')).toBe(`${staggerDelayMs(recentListing.id)}ms`);
  });
});

describe('staggerDelayMs', () => {
  it('同じidなら常に同じ値を返す (決定的)', () => {
    expect(staggerDelayMs('listing-abc')).toBe(staggerDelayMs('listing-abc'));
  });

  it('idが違えば基本的に異なる値になる (完全一致は稀)', () => {
    const a = staggerDelayMs('listing-abc');
    const b = staggerDelayMs('listing-xyz');
    expect(a).not.toBe(b);
  });

  it('0以上3000未満の範囲に収まる', () => {
    const ids = ['a', 'listing-1', 'listing-2', 'とても長いID-0123456789', ''];
    for (const id of ids) {
      const delay = staggerDelayMs(id);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThan(3000);
    }
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
