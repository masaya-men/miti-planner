// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

const listAllPersonalTagsMock = vi.fn();
vi.mock('../../lib/housing/personalTagLookup', () => ({
  listAllPersonalTags: (...args: unknown[]) => listAllPersonalTagsMock(...args),
}));

import { BrowseTagView } from '../../components/housing/browse/BrowseTagView';
import { useHousingViewStore } from '../../store/useHousingViewStore';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
import { useHousingTagPickerStore } from '../../store/useHousingTagPickerStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { MOCK_LISTINGS } from '../../data/housing/mockListings';

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
  listAllPersonalTagsMock.mockReset();
  listAllPersonalTagsMock.mockResolvedValue([]);
  useHousingFilterStore.getState().clearAll();
  useHousingTagPickerStore.setState({ pendingTags: [], initialized: false });
  useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
  useHousingViewStore.getState().reset();
  useHousingViewStore.getState().setBrowseView('tags');
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('BrowseTagView', () => {
  it('絞り込むを押すと browseView が list に戻る', async () => {
    wrap(<BrowseTagView />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    fireEvent.click(screen.getByText('この条件で絞り込む'));
    expect(useHousingViewStore.getState().browseView).toBe('list');
  });
});
