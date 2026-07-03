// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import type { TourProgress } from '../../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../../lib/housing/formatHousingAddress';

import { TourProgressPanel } from '../TourProgressPanel';

const nextListing = MOCK_LISTINGS[0];
const recentListing = MOCK_LISTINGS[1];

const baseProgress: TourProgress = {
  total: 5,
  arrivedCount: 2,
  remainingCount: 3,
  percent: 40,
  currentStep: { id: nextListing.id, listing: nextListing },
  recent: [{ id: recentListing.id, listing: recentListing }],
};

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPanel(props: Partial<Parameters<typeof TourProgressPanel>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TourProgressPanel progress={baseProgress} onFinish={() => {}} {...props} />
    </I18nextProvider>
  );
}

describe('TourProgressPanel — 進捗表示', () => {
  it('percent表示 (40% 完了) が出る', () => {
    renderPanel();
    expect(screen.getByText('40% 完了')).toBeInTheDocument();
  });

  it('到着済み/残りの数字が出る', () => {
    const { container } = renderPanel();
    const values = Array.from(
      container.querySelectorAll('.housing-tour-progress-stat-value')
    ).map((el) => el.textContent);
    expect(values).toEqual(['2', '3']);
  });

  it('次に訪れる場所の住所が出る', () => {
    renderPanel();
    expect(screen.getByText(formatHousingAddress(nextListing, 'ja'))).toBeInTheDocument();
  });
});

describe('TourProgressPanel — ツアーを終了', () => {
  it('「ツアーを終了」クリックで onFinish が呼ばれる', () => {
    const onFinish = vi.fn();
    renderPanel({ onFinish });
    fireEvent.click(screen.getByRole('button', { name: 'ツアーを終了' }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
