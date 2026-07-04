// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';

import { TourEmptyState } from '../TourEmptyState';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderEmptyState(onGoFavorites: () => void = () => {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TourEmptyState onGoFavorites={onGoFavorites} />
    </I18nextProvider>
  );
}

describe('TourEmptyState — ツアー未開始の空状態', () => {
  it('タイトルが出る', () => {
    renderEmptyState();
    expect(screen.getByText('ツアーがまだ始まっていません')).toBeInTheDocument();
  });

  it('リード文が出る', () => {
    renderEmptyState();
    expect(
      screen.getByText('お気に入りから行きたいハウジングを選んでツアーを始めましょう。')
    ).toBeInTheDocument();
  });

  it('「お気に入りへ」クリックで onGoFavorites が呼ばれる', () => {
    const onGoFavorites = vi.fn();
    renderEmptyState(onGoFavorites);
    fireEvent.click(screen.getByRole('button', { name: 'お気に入りへ' }));
    expect(onGoFavorites).toHaveBeenCalledTimes(1);
  });
});
