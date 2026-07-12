// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { RoomListPanel } from '../../components/housing/browse/map/RoomListPanel';
import type { BrowseMapSpot } from '../../lib/housing/browseMapSpots';
import type { MockListing } from '../../data/housing/mockListings';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({ lng: 'ja', fallbackLng: 'ja', resources: { ja: { translation: jaTranslations } }, interpolation: { escapeValue: false } });
  }
});

let seq = 0;
const L = (over: Partial<MockListing> = {}): MockListing => {
  seq += 1;
  return { id: `l-${seq}`, ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP', area: 'Mist', ward: 1, buildingType: 'house', plot: 5, size: 'M', imageMode: 'none', tags: [], createdAt: 1, lastConfirmedAt: 1, addressKey: `k-${seq}`, ...over } as MockListing;
};
const spot = (over: Partial<BrowseMapSpot>): BrowseMapSpot => {
  const listings = over.listings ?? [L()];
  return { key: 'plot:5', kind: 'plot', plot: 5, listings, representative: listings[0], ...over };
};
const renderPanel = (s: BrowseMapSpot, onClose = vi.fn()) =>
  render(<I18nextProvider i18n={i18n}><MemoryRouter><RoomListPanel spot={s} onClose={onClose} onAddToTour={() => {}} /></MemoryRouter></I18nextProvider>);

describe('RoomListPanel', () => {
  it('戻るボタンで onClose を呼ぶ', () => {
    const onClose = vi.fn();
    renderPanel(spot({ listings: [L(), L()] }), onClose);
    fireEvent.click(screen.getByRole('button', { name: '地図に戻る' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('FC個室レイアウト: 家全体1件 + 個室ありのとき「家全体」と「個室 N件」の見出しを出す', () => {
    const house = L();
    const chambers = [L({ roomKind: 'private_chamber', roomNumber: 1 }), L({ roomKind: 'private_chamber', roomNumber: 2 })];
    renderPanel(spot({ kind: 'plot', listings: [house, ...chambers] }));
    expect(screen.getByText('家全体')).toBeTruthy();
    expect(screen.getByText('個室 2件')).toBeTruthy();
    expect(screen.getAllByTestId('housing-listing-card')).toHaveLength(3); // 家 + 個室2
  });

  it('アパート: タイトルにアパート、全部屋をグリッド表示', () => {
    const rooms = [L({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 1 }), L({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 2 })];
    renderPanel(spot({ key: 'apart:1', kind: 'apart', plot: 1, listings: rooms }));
    expect(screen.getByText('アパート')).toBeTruthy();
    expect(screen.getAllByTestId('housing-listing-card')).toHaveLength(2);
  });
});
