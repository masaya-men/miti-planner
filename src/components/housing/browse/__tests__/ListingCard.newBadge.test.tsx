// @vitest-environment happy-dom
/**
 * ListingCard: NEWリボン・ビーム演出・staggerDelayMs。
 * (ListingCard.test.tsx を分割したもの。共通の準備は listingCardTestSetup.tsx)
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useMasterDataStore } from '../../../../store/useMasterDataStore';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

vi.mock('thumbhash', async (orig) => ({
  ...(await orig<typeof import('thumbhash')>()),
  thumbHashToDataURL: () => 'data:image/png;base64,BLURMOCK',
}));

import { staggerDelayMs } from '../listingCardUtils';


import { mockListing, renderCard, setupListingCardEnv, resetIntersection, fireIntersection } from './listingCardTestSetup';

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
    expect(cardEl.querySelector('.housing-card-new-shine')).toBeNull();
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
    expect(cardEl.querySelector('.housing-card-new-shine')).not.toBeNull();
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
    const firstGlow = cardEl.querySelector('.housing-card-new-shine');
    expect(firstGlow).not.toBeNull();

    fireIntersection(false); // 画面外へ
    fireIntersection(true); // 再度画面内へ

    const secondGlow = cardEl.querySelector('.housing-card-new-shine');
    expect(secondGlow).not.toBeNull();
    expect(secondGlow).not.toBe(firstGlow); // 同一要素の使い回しではなく作り直されている
  });

  it('画面内に居続けたまま同じ交差通知が重複しても作り直さない (無駄な再生をしない)', () => {
    renderCard({ listing: recentListing, showNewBadge: true });
    fireIntersection(true);
    const cardEl = screen.getByTestId('housing-listing-card');
    const firstGlow = cardEl.querySelector('.housing-card-new-shine');

    fireIntersection(true); // 画面内のまま再通知 (実際のIOでも起こりうる)

    expect(cardEl.querySelector('.housing-card-new-shine')).toBe(firstGlow);
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
    const glow = screen.getByTestId('housing-listing-card').querySelector('.housing-card-new-shine') as HTMLElement;
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

  it('300以上1200未満の範囲に収まる', () => {
    const ids = ['a', 'listing-1', 'listing-2', 'とても長いID-0123456789', ''];
    for (const id of ids) {
      const delay = staggerDelayMs(id);
      expect(delay).toBeGreaterThanOrEqual(300);
      expect(delay).toBeLessThan(1200);
    }
  });
});
