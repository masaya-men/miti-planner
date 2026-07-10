// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { BrowseMapView } from '../../components/housing/browse/map/BrowseMapView';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import type { MockListing } from '../../data/housing/mockListings';

// MockListing は必須フィールドが多いため最小限を埋めるフィクスチャビルダー
// (browseMapSpots.test.ts の mkListing パターンを踏襲)。
let seq = 0;
function mkListing(over: Partial<MockListing> = {}): MockListing {
  seq += 1;
  return {
    id: `l-${seq}`,
    ownerUid: 'u1',
    dc: 'Mana',
    server: 'Anima',
    region: 'JP',
    area: 'Mist',
    ward: 3,
    buildingType: 'house',
    plot: 5,
    size: 'M',
    imageMode: 'none',
    tags: [],
    createdAt: 1000,
    lastConfirmedAt: 1000,
    addressKey: `k-${seq}`,
    ...over,
  };
}

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
  useHousingViewStore.getState().reset();
});

const renderView = (filtered: MockListing[] = [], onAddToTour: (id: string) => void = () => {}) =>
  render(
    <I18nextProvider i18n={i18n}>
      <BrowseMapView filtered={filtered} onAddToTour={onAddToTour} />
    </I18nextProvider>,
  );

describe('BrowseMapView', () => {
  describe('WorldSelectGate (servers.length !== 1)', () => {
    it('servers が 0件ならゲートを表示する', () => {
      renderView();
      expect(screen.getByTestId('housing-world-gate')).toBeTruthy();
    });

    it('servers が 2件以上ならゲートを表示する', () => {
      useHousingFilterStore.setState({ servers: ['Anima', 'Asura'] });
      renderView();
      expect(screen.getByTestId('housing-world-gate')).toBeTruthy();
    });

    it('servers が 1件ならゲートを表示しない (地図側へ)', () => {
      useHousingFilterStore.setState({ servers: ['Anima'] });
      renderView([mkListing({ area: 'Mist', ward: 3 })]);
      expect(screen.queryByTestId('housing-world-gate')).toBeNull();
    });

    it('DC→ワールドの順に選択すると setDC + setServerExclusive が呼ばれる', () => {
      renderView();
      fireEvent.click(screen.getByRole('button', { name: 'Mana' }));
      fireEvent.click(screen.getByRole('button', { name: 'Anima' }));
      expect(useHousingFilterStore.getState().dc).toBe('Mana');
      expect(useHousingFilterStore.getState().servers).toEqual(['Anima']);
    });

    it('dc が選択済みならそのDCのワールド一覧から開始する (DC再選択不要)', () => {
      useHousingFilterStore.setState({ dc: 'Mana' });
      renderView();
      expect(screen.getByRole('button', { name: 'Anima' })).toBeTruthy();
    });

    it('ワールド選択後はゲートが自動的に外れる', () => {
      const { rerender } = renderView();
      fireEvent.click(screen.getByRole('button', { name: 'Mana' }));
      fireEvent.click(screen.getByRole('button', { name: 'Anima' }));
      rerender(
        <I18nextProvider i18n={i18n}>
          <BrowseMapView filtered={[mkListing({ area: 'Mist', ward: 3 })]} onAddToTour={() => {}} />
        </I18nextProvider>,
      );
      expect(screen.queryByTestId('housing-world-gate')).toBeNull();
    });
  });

  describe('空状態 (servers.length===1 だが findInitialWardTarget が null)', () => {
    it('このワールドに登録がない場合、空状態 + 一覧に戻るボタンを表示する', () => {
      useHousingFilterStore.setState({ servers: ['Anima'] });
      renderView([]);
      expect(screen.getByText('このワールドにはまだ登録がありません')).toBeTruthy();
      const backBtn = screen.getByRole('button', { name: '一覧に戻る' });
      fireEvent.click(backBtn);
      expect(useHousingViewStore.getState().browseView).toBe('list');
    });

    it('登録がある場合は空状態を表示しない', () => {
      useHousingFilterStore.setState({ servers: ['Anima'] });
      renderView([mkListing({ area: 'Mist', ward: 3 })]);
      expect(screen.queryByText('このワールドにはまだ登録がありません')).toBeNull();
    });
  });
});
