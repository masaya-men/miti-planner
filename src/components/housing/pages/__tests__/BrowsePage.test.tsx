// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

// showToast をスパイして、 リージョン跨ぎブロック時に呼ばれることを検証する (計画 Task3 Step5)。
const showToastMock = vi.fn();
vi.mock('../../../Toast', () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

import { BrowsePage } from '../BrowsePage';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingFilterStore } from '../../../../store/useHousingFilterStore';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';
import { useEphemeralListingsStore } from '../../../../store/useEphemeralListingsStore';
import type { MockListing } from '../../../../data/housing/mockListings';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

// テスト基盤メモ: JP=Elemental/Aegis、 NA(別リージョン)=Aether/Gilgamesh (serverMasterData 実在値)。
function mk(id: string, region: 'JP' | 'NA', dc: string, server: string): MockListing {
  return {
    id,
    ownerUid: 'owner-x',
    dc,
    server,
    region,
    area: 'Mist',
    ward: 1,
    buildingType: 'house',
    plot: 1,
    imageMode: 'none',
    tags: [],
    title: id,
    createdAt: Date.now(),
    lastConfirmedAt: Date.now(),
    addressKey: `${dc}-${server}-Mist-1-1`,
  } as MockListing;
}

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <BrowsePage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('BrowsePage: リージョン跨ぎの追加時ブロック', () => {
  beforeEach(() => {
    useHousingFilterStore.getState().clearAll();
    useHousingViewStore.getState().reset();
    useHousingFavoritesStore.setState({ ids: [] });
    useEphemeralListingsStore.getState().clear();
    showToastMock.mockClear();
  });

  it('別リージョンの家をツアーに追加しようとすると弾かれ、トーストが出る', () => {
    const jp = mk('jp-1', 'JP', 'Elemental', 'Aegis');
    const na = mk('na-1', 'NA', 'Aether', 'Gilgamesh');
    useHousingListingsStore.setState({ status: 'ready', listings: [jp, na], myListings: [] } as never);

    renderPage();

    const addButtons = screen.getAllByRole('button', { name: 'ツアーに追加' });
    expect(addButtons).toHaveLength(2);

    // 1件目 (JP) は通常どおり追加できる。
    fireEvent.click(addButtons[0]);
    // 2件目 (NA・別リージョン) は弾かれる。
    fireEvent.click(addButtons[1]);

    const trayList = document.querySelector('.housing-tour-tray-list');
    expect(trayList).not.toBeNull();
    const trayItems = within(trayList as HTMLElement).getAllByRole('listitem');
    expect(trayItems).toHaveLength(1);

    expect(showToastMock).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('同リージョンの家は両方ともトレイに追加される (回帰なし)', () => {
    const jp1 = mk('jp-1', 'JP', 'Elemental', 'Aegis');
    const jp2 = mk('jp-2', 'JP', 'Gaia', 'Ifrit');
    useHousingListingsStore.setState({ status: 'ready', listings: [jp1, jp2], myListings: [] } as never);

    renderPage();

    const addButtons = screen.getAllByRole('button', { name: 'ツアーに追加' });
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[1]);

    const trayList = document.querySelector('.housing-tour-tray-list');
    const trayItems = within(trayList as HTMLElement).getAllByRole('listitem');
    expect(trayItems).toHaveLength(2);
    expect(showToastMock).not.toHaveBeenCalled();
  });
});
