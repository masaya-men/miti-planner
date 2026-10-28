// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';
import { MapDcMenu } from '../../components/housing/browse/map/MapDcMenu';
import { BrowseViewToggle } from '../../components/housing/browse/BrowseViewToggle';
import { buildMapIndex } from '../../lib/housing/browseMapIndex';
import type { MockListing } from '../../data/housing/mockListings';

let seq = 0;
function mk(over: Partial<MockListing> = {}): MockListing {
  seq += 1;
  return {
    id: `m-${seq}`, ownerUid: 'u', dc: 'Mana', server: 'Anima', region: 'JP',
    area: 'Mist', ward: 3, buildingType: 'house', plot: 5, size: 'M', imageMode: 'none',
    tags: [], createdAt: 1, lastConfirmedAt: 1, addressKey: `k-${seq}`, ...over,
  };
}

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja', resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('MapDcMenu', () => {
  const pool = [
    mk(), mk(), mk(),
    mk({ dc: 'Gaia', server: 'Ridill' }),
    mk({ dc: 'Chaos', server: 'Louisoix', region: 'EU' }),
  ];
  const index = buildMapIndex(pool);

  it('地域見出しごとに DC と件数を出し、0 件の DC は押せない', () => {
    const onPick = vi.fn();
    wrap(<MapDcMenu index={index} regions={[]} currentDc="Mana" onPick={onPick} />);
    const mana = screen.getByTestId('housing-dcmenu-Mana') as HTMLButtonElement;
    expect(mana.textContent).toContain('3 件');
    expect(mana.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('日本')).toBeTruthy();
    expect(screen.getByText('欧州')).toBeTruthy();
    const meteor = screen.getByTestId('housing-dcmenu-Meteor') as HTMLButtonElement;
    expect(meteor.disabled).toBe(true);
    fireEvent.click(meteor);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('housing-dcmenu-Gaia'));
    expect(onPick).toHaveBeenCalledWith('Gaia');
  });

  it('言語の地域分離: 絞り込みの地域に無い DC は出さない', () => {
    wrap(<MapDcMenu index={index} regions={['JP']} currentDc={null} onPick={() => {}} />);
    expect(screen.queryByTestId('housing-dcmenu-Mana')).toBeTruthy();
    expect(screen.queryByTestId('housing-dcmenu-Chaos')).toBeNull();
    expect(screen.queryByTestId('housing-dcmenu-Korea')).toBeNull();
    expect(screen.queryByText('欧州')).toBeNull();
  });
});

describe('BrowseViewToggle の DC メニュー', () => {
  it('マップ表示中は「マップ ▾ DC名」になり、メニューは外側クリックと Esc で閉じる', () => {
    const onClose = vi.fn();
    wrap(
      <div>
        <button type="button" data-testid="outside">外</button>
        <BrowseViewToggle
          value="map"
          onChange={() => {}}
          mapDcLabel="Mana"
          mapMenuOpen
          onMapMenuClose={onClose}
          mapMenu={<div data-testid="menu-body">menu</div>}
        />
      </div>,
    );
    expect(screen.getByTestId('menu-body')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /マップ.*Mana/ })).toBeTruthy();
    // メニュー内クリックでは閉じない
    fireEvent.pointerDown(screen.getByTestId('menu-body'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('マップ以外の表示ではメニューを出さず DC 名も付けない', () => {
    wrap(
      <BrowseViewToggle value="list" onChange={() => {}} mapDcLabel="Mana" mapMenu={<div data-testid="menu-body" />} />,
    );
    expect(screen.queryByTestId('menu-body')).toBeNull();
    expect(screen.getByRole('tab', { name: 'マップ' })).toBeTruthy();
  });
});
