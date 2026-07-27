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

import { TagPickerPanel } from '../../components/housing/browse/tagpicker/TagPickerPanel';
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
});

const wrap = (ui: React.ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe('TagPickerPanel', () => {
  it('マウント時に committed tags からpendingを初期化する', async () => {
    useHousingFilterStore.getState().setTags(['theme_wafu']);
    wrap(<TagPickerPanel onApplied={vi.fn()} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']);
  });

  it('チップを選んでもすぐには committed tags に反映しない', async () => {
    wrap(<TagPickerPanel onApplied={vi.fn()} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    fireEvent.click(screen.getByText('和風'));
    expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']);
    expect(useHousingFilterStore.getState().tags).toEqual([]);
  });

  it('「絞り込む」を押すと committed tags に反映し onApplied を呼ぶ', async () => {
    const onApplied = vi.fn();
    wrap(<TagPickerPanel onApplied={onApplied} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    fireEvent.click(screen.getByText('和風'));
    fireEvent.click(screen.getByText('この条件で絞り込む'));
    expect(useHousingFilterStore.getState().tags).toEqual(['theme_wafu']);
    expect(onApplied).toHaveBeenCalledOnce();
  });

  it('「クリア」を押すと pending だけ空にする (committed tagsは変えない)', async () => {
    useHousingFilterStore.getState().setTags(['theme_wafu']);
    wrap(<TagPickerPanel onApplied={vi.fn()} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']));
    fireEvent.click(screen.getByText('選択をクリア'));
    expect(useHousingTagPickerStore.getState().pendingTags).toEqual([]);
    expect(useHousingFilterStore.getState().tags).toEqual(['theme_wafu']);
  });

  it('件数プレビューを表示する', async () => {
    wrap(<TagPickerPanel onApplied={vi.fn()} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    expect(screen.getByText(`この条件で ${MOCK_LISTINGS.length}件`)).toBeInTheDocument();
  });

  it('コンポーネントがアンマウント→再マウントされても保留中の選択(committedと異なる状態)は保持される', async () => {
    const first = wrap(<TagPickerPanel onApplied={vi.fn()} />);
    await waitFor(() => expect(useHousingTagPickerStore.getState().initialized).toBe(true));
    fireEvent.click(screen.getByText('和風'));
    expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']);
    expect(useHousingFilterStore.getState().tags).toEqual([]);

    first.unmount();

    wrap(<TagPickerPanel onApplied={vi.fn()} />);
    expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']);
  });
});
