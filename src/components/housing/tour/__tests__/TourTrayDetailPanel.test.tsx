// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import type { MockListing } from '../../../../data/housing/mockListings';

vi.mock('../../housinger/HousingerByline', () => ({
  HousingerByline: () => null,
}));

import { TourTrayDetailPanel } from '../TourTrayDetailPanel';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const listing: MockListing = {
  id: 'a', ownerUid: 'owner-1', title: 'テストの家', description: 'いい家です',
  area: 'Mist', ward: 1, plot: 1, buildingType: 'house', size: 'M', imageMode: 'none', tags: [],
  createdAt: 0, lastConfirmedAt: 0,
};

describe('TourTrayDetailPanel', () => {
  it('listingがnullなら空メッセージを出す', () => {
    wrap(<TourTrayDetailPanel listing={null} onStartClick={() => {}} startDisabled />);
    expect(screen.getByText('カードの「ツアーに追加」で行き先を積みましょう')).toBeInTheDocument();
  });

  it('選択中の家のタイトルとコメントを表示する', () => {
    wrap(<TourTrayDetailPanel listing={listing} onStartClick={() => {}} startDisabled={false} />);
    expect(screen.getByText('テストの家')).toBeInTheDocument();
    expect(screen.getByText('いい家です')).toBeInTheDocument();
  });

  it('開始ボタンクリックで onStartClick が呼ばれる', () => {
    const onStartClick = vi.fn();
    wrap(<TourTrayDetailPanel listing={listing} onStartClick={onStartClick} startDisabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /開始/ }));
    expect(onStartClick).toHaveBeenCalledTimes(1);
  });

  it('startDisabledがtrueなら開始ボタンが無効', () => {
    wrap(<TourTrayDetailPanel listing={listing} onStartClick={() => {}} startDisabled />);
    expect((screen.getByRole('button', { name: /開始/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
