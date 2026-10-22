// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

// TourTrayRow (サムネイル部分) が useNavigate を使うため、他の react-router-dom export
// (MemoryRouter 等) は実物のまま useNavigate だけ差し替える。
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../store/useHousingListingsStore', () => ({
  useHousingListingsStore: (sel: (s: unknown) => unknown) =>
    sel({
      listings: [
        { id: 'a', area: 'Mist', ward: 1, plot: 1, buildingType: 'house', size: 'M', imageMode: 'none', tags: [] },
      ],
      myListings: [],
    }),
}));

import { TourTray } from '../../components/housing/browse/TourTray';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

const wrap = (ui: React.ReactElement) =>
  render(<MemoryRouter><I18nextProvider i18n={i18n}>{ui}</I18nextProvider></MemoryRouter>);

describe('TourTray', () => {
  it('disables both start buttons when empty', () => {
    wrap(<TourTray listingIds={[]} onChange={() => {}} onStart={() => {}} onReorder={() => {}} onAdd={() => {}} />);
    expect((screen.getByRole('button', { name: 'このまま開始' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '回る順番を変えてからツアー' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('「回る順番を変えてからツアー」で onReorder だけが呼ばれる', () => {
    const onStart = vi.fn();
    const onReorder = vi.fn();
    wrap(<TourTray listingIds={['a']} onChange={() => {}} onStart={onStart} onReorder={onReorder} onAdd={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '回る順番を変えてからツアー' }));
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('calls onStart when items present', () => {
    const onStart = vi.fn();
    wrap(<TourTray listingIds={['a']} onChange={() => {}} onStart={onStart} onReorder={() => {}} onAdd={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'このまま開始' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('removes an item via the × button', () => {
    const onChange = vi.fn();
    wrap(<TourTray listingIds={['a']} onChange={onChange} onStart={() => {}} onReorder={() => {}} onAdd={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /削除|remove/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('disables the clear button when empty', () => {
    wrap(<TourTray listingIds={[]} onChange={() => {}} onStart={() => {}} onReorder={() => {}} onAdd={() => {}} />);
    expect((screen.getByRole('button', { name: /空にする|clear/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears the whole tray via the clear button', () => {
    const onChange = vi.fn();
    wrap(<TourTray listingIds={['a']} onChange={onChange} onStart={() => {}} onReorder={() => {}} onAdd={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /空にする|clear/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
