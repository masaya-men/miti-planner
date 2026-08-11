// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';

vi.mock('../../../../store/useHousingListingsStore', () => ({
  useHousingListingsStore: (sel: (s: unknown) => unknown) =>
    sel({
      listings: [
        { id: 'a', title: 'A', area: 'Mist', ward: 1, plot: 1, buildingType: 'house', size: 'M', imageMode: 'none', tags: [] },
        { id: 'b', title: 'B', area: 'Mist', ward: 1, plot: 2, buildingType: 'house', size: 'M', imageMode: 'none', tags: [] },
      ],
      myListings: [],
    }),
}));

import { TourTrayBoard } from '../TourTrayBoard';

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

describe('TourTrayBoard', () => {
  it('トレイが空なら空状態を表示する', () => {
    wrap(<TourTrayBoard listingIds={[]} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('カードの「ツアーに追加」で行き先を積みましょう')).toBeInTheDocument();
  });

  it('トレイの件数分カードを描画する', () => {
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('カードをクリックすると onSelect が呼ばれる', () => {
    const onSelect = vi.fn();
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={() => {}} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('A'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });

  it('削除ボタンで onChange が呼ばれる', () => {
    const onChange = vi.fn();
    wrap(<TourTrayBoard listingIds={['a', 'b']} onChange={onChange} selectedId={null} onSelect={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('案内文が表示される', () => {
    wrap(<TourTrayBoard listingIds={['a']} onChange={() => {}} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('ドラッグで並べ替え、ピンでこの位置に固定できます')).toBeInTheDocument();
  });
});
