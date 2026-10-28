// @vitest-environment happy-dom
/**
 * ListingCard: マイページの家主向け管理コントロール (公開状態メニュー・編集ボタン・印) の動き。
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useMasterDataStore } from '../../../../store/useMasterDataStore';
import { useAuthStore } from '../../../../store/useAuthStore';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { mockListing, renderCard, setupListingCardEnv, resetIntersection } from './listingCardTestSetup';

beforeAll(() => {
  setupListingCardEnv();
});

beforeEach(() => {
  navigate.mockReset();
  resetIntersection();
  useTourTrayStore.setState({ trayIds: [], pinnedIds: [] });
  useHousingListingsStore.setState({ listings: [], myListings: [] } as never);
  useMasterDataStore.setState({ config: null } as never);
  useHousingFavoritesStore.setState({} as never);
  useAuthStore.setState({ user: null } as never);
});

const badge = () => document.querySelector('.housing-card-visibility-badge') as HTMLButtonElement;

describe('ListingCard — 家主向け管理コントロール', () => {
  it('showOwnerControls 未指定なら公開状態バッジも編集ボタンも出ない', () => {
    renderCard();
    expect(badge()).toBeNull();
    expect(document.querySelector('.housing-card-edit-btn')).toBeNull();
  });

  it('バッジを押すとメニューが body 直下に開き、カードは遷移しない', () => {
    renderCard({ showOwnerControls: true });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(badge());
    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(badge().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('現在の公開状態のメニュー項目だけ disabled', () => {
    renderCard({ showOwnerControls: true });
    fireEvent.click(badge());
    const disabled = screen.getAllByRole('menuitem').filter((b) => (b as HTMLButtonElement).disabled);
    expect(disabled).toHaveLength(1);
  });

  it('項目を選ぶと onRequestVisibilityChange が呼ばれメニューが閉じる', () => {
    const onReq = vi.fn();
    renderCard({ showOwnerControls: true, onRequestVisibilityChange: onReq });
    fireEvent.click(badge());
    const enabled = screen.getAllByRole('menuitem').filter((b) => !(b as HTMLButtonElement).disabled);
    fireEvent.click(enabled[0]);
    expect(onReq).toHaveBeenCalledTimes(1);
    expect(onReq.mock.calls[0][0]).toBe(mockListing.id);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Escape でメニューが閉じる', () => {
    renderCard({ showOwnerControls: true });
    fireEvent.click(badge());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('メニューの外をクリックすると閉じる', () => {
    renderCard({ showOwnerControls: true });
    fireEvent.click(badge());
    fireEvent.mouseDown(document.body);
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('バッジをもう一度押すと閉じる', () => {
    renderCard({ showOwnerControls: true });
    fireEvent.click(badge());
    fireEvent.click(badge());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('編集ボタンで onEditListing が listing.id で呼ばれ、カードは遷移しない', () => {
    const onEdit = vi.fn();
    renderCard({ showOwnerControls: true, onEditListing: onEdit });
    fireEvent.click(document.querySelector('.housing-card-edit-btn') as HTMLElement);
    expect(onEdit).toHaveBeenCalledWith(mockListing.id);
    expect(navigate).not.toHaveBeenCalled();
  });
});
