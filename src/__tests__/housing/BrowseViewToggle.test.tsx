// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

import { BrowseViewToggle } from '../../components/housing/browse/BrowseViewToggle';
import { useHousingViewStore } from '../../store/useHousingViewStore';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

beforeEach(() => {
  useHousingViewStore.getState().reset();
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

// store に直結したホスト (実際の BrowsePage での使われ方を模す)。
const Host: React.FC = () => {
  const browseView = useHousingViewStore((s) => s.browseView);
  const setBrowseView = useHousingViewStore((s) => s.setBrowseView);
  return <BrowseViewToggle value={browseView} onChange={setBrowseView} />;
};

describe('BrowseViewToggle', () => {
  it('renders a tablist with list/map tabs, aria-label = view_aria', () => {
    wrap(<BrowseViewToggle value="list" onChange={() => {}} />);
    const tablist = screen.getByRole('tablist', { name: '表示切替' });
    expect(tablist).toBeTruthy();
    expect(screen.getByRole('tab', { name: '一覧' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'マップ' })).toBeTruthy();
  });

  it('marks the current value as selected (data-selected / aria-selected)', () => {
    wrap(<BrowseViewToggle value="map" onChange={() => {}} />);
    const listTab = screen.getByRole('tab', { name: '一覧' }) as HTMLButtonElement;
    const mapTab = screen.getByRole('tab', { name: 'マップ' }) as HTMLButtonElement;
    expect(listTab.getAttribute('data-selected')).toBe('false');
    expect(listTab.getAttribute('aria-selected')).toBe('false');
    expect(mapTab.getAttribute('data-selected')).toBe('true');
    expect(mapTab.getAttribute('aria-selected')).toBe('true');
  });

  it('switching list -> map updates the housing view store (integration via Host)', () => {
    wrap(<Host />);
    expect(useHousingViewStore.getState().browseView).toBe('list');
    fireEvent.click(screen.getByRole('tab', { name: 'マップ' }));
    expect(useHousingViewStore.getState().browseView).toBe('map');
  });

  it('switching map -> list updates the housing view store', () => {
    useHousingViewStore.getState().setBrowseView('map');
    wrap(<Host />);
    fireEvent.click(screen.getByRole('tab', { name: '一覧' }));
    expect(useHousingViewStore.getState().browseView).toBe('list');
  });
});
