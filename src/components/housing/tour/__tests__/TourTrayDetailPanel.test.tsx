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

  it('タイトルあり+住所公開なら、タイトルの下に住所が1行出る', () => {
    const { container } = wrap(<TourTrayDetailPanel listing={listing} onStartClick={() => {}} startDisabled={false} />);
    const addr = container.querySelector('.housing-tour-dest-addrsize');
    expect(addr).not.toBeNull();
    expect(addr?.textContent).toMatch(/ミスト/);
  });

  it('住所非公開(unlisted)なら住所行は出ない', () => {
    const { container } = wrap(
      <TourTrayDetailPanel listing={{ ...listing, visibility: 'unlisted', area: undefined, ward: undefined }} onStartClick={() => {}} startDisabled={false} />,
    );
    expect(container.querySelector('.housing-tour-dest-addrsize')).toBeNull();
  });

  it('タイトル未入力なら住所は h2 の1回だけ(重複させない)', () => {
    const { container } = wrap(
      <TourTrayDetailPanel listing={{ ...listing, title: '' }} onStartClick={() => {}} startDisabled={false} />,
    );
    expect(container.querySelector('.housing-tour-dest-addrsize')).toBeNull();
    expect(container.querySelector('h2')?.textContent).toMatch(/ミスト/);
  });

  it('startLabel と note を指定するとその文言が出る', () => {
    wrap(<TourTrayDetailPanel listing={listing} onStartClick={() => {}} startDisabled={false} startLabel="ツアーに戻る" note="再開の説明" />);
    expect(screen.getByRole('button', { name: 'ツアーに戻る' })).toBeInTheDocument();
    expect(screen.getByText('再開の説明')).toBeInTheDocument();
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
