// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

vi.mock('../../store/useHousingListingsStore', () => ({
  useHousingListingsStore: (sel: (s: unknown) => unknown) =>
    sel({
      listings: [
        { id: 'a', area: 'Mist', ward: 1, plot: 1, buildingType: 'house', size: 'M', imageMode: 'none', tags: [] },
      ],
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

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('TourTray', () => {
  it('disables start when empty', () => {
    wrap(<TourTray listingIds={[]} onChange={() => {}} onStart={() => {}} onAdd={() => {}} />);
    expect((screen.getByRole('button', { name: /開始|start/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onStart when items present', () => {
    const onStart = vi.fn();
    wrap(<TourTray listingIds={['a']} onChange={() => {}} onStart={onStart} onAdd={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /開始|start/ }));
    expect(onStart).toHaveBeenCalled();
  });

  it('removes an item via the × button', () => {
    const onChange = vi.fn();
    wrap(<TourTray listingIds={['a']} onChange={onChange} onStart={() => {}} onAdd={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /削除|remove/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
