// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../locales/ja.json';

const listAllPersonalTagsMock = vi.fn();
vi.mock('../../lib/housing/personalTagLookup', () => ({
  listAllPersonalTags: (...args: unknown[]) => listAllPersonalTagsMock(...args),
}));

import { HousingFilterSheet } from '../../components/housing/shell/HousingFilterSheet';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';
import { useHousingTagPickerStore } from '../../store/useHousingTagPickerStore';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';
import { useHousingViewStore } from '../../store/useHousingViewStore';
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
  useHousingTagPickerStore.setState({ pendingTags: [], lastSyncedCommitted: null });
  useHousingListingsStore.setState({ status: 'ready', listings: MOCK_LISTINGS, error: null });
  useHousingViewStore.getState().reset();
});

const wrap = (ui: React.ReactElement) => render(
  <MemoryRouter>
    <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
  </MemoryRouter>,
);

describe('HousingFilterSheet タグ検索 (インライン展開)', () => {
  it('「タグ」トリガーを押すとその場に展開する', async () => {
    wrap(<HousingFilterSheet isOpen onClose={vi.fn()} />);
    expect(screen.queryByText('ハウジンガー')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'タグ' }));
    await waitFor(() => expect(screen.getByText('ハウジンガー')).toBeInTheDocument());
  });

  it('「絞り込む」を押すとその場で折りたたまれるが、シートは閉じない (onCloseが呼ばれない)', async () => {
    const onClose = vi.fn();
    wrap(<HousingFilterSheet isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'タグ' }));
    await waitFor(() => expect(useHousingTagPickerStore.getState().lastSyncedCommitted).not.toBeNull());
    fireEvent.click(screen.getByText('この条件で絞り込む'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('ハウジンガー')).toBeNull();
  });
});
