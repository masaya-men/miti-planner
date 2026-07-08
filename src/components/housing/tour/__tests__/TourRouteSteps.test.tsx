// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import type { TourStep } from '../../../../lib/housing/tourNav';

import { TourRouteSteps } from '../TourRouteSteps';

const currentListing = MOCK_LISTINGS[0];
const mistListing = MOCK_LISTINGS[4];

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

describe('TourRouteSteps — 状態バッジ / 注記', () => {
  const mixedSteps: TourStep[] = [
    { id: mistListing.id, listing: mistListing }, // index0: 到着済み (ミスト・plotあり→配置可能)
    { id: currentListing.id, listing: currentListing }, // index1: 次に訪問 (シロガネ・plotあり→配置可能)
    { id: 'missing-1', listing: null }, // index2: 未到着 (欠落)
  ];

  function renderSteps(currentIndex = 1) {
    return render(
      <I18nextProvider i18n={i18n}>
        <TourRouteSteps steps={mixedSteps} currentIndex={currentIndex} />
      </I18nextProvider>
    );
  }

  it('各ステップの状態が stepStatus 通りに data-status / class へ反映される', () => {
    const { container } = renderSteps(1);
    const items = container.querySelectorAll('.housing-tour-steps-item');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute('data-status', 'arrived');
    expect(items[0]).toHaveClass('housing-tour-steps-item--arrived');
    expect(items[1]).toHaveAttribute('data-status', 'current');
    expect(items[1]).toHaveClass('housing-tour-steps-item--current');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).toHaveAttribute('data-status', 'upcoming');
    expect(items[2]).toHaveClass('housing-tour-steps-item--upcoming');
  });

  it('各ステップに青丸(dot)が付き、旧 index 数字は撤去されている', () => {
    const { container } = renderSteps(1);
    expect(container.querySelectorAll('.housing-tour-steps-dot')).toHaveLength(3);
    expect(container.querySelector('.housing-tour-steps-index')).toBeNull();
  });

  it('plot無しhouse (地図に解決できない) のステップに map_pending 注記が出る', () => {
    const noPlotHouse = { ...currentListing, buildingType: 'house' as const, plot: undefined };
    const noPlotSteps: TourStep[] = [{ id: noPlotHouse.id, listing: noPlotHouse }];
    render(
      <I18nextProvider i18n={i18n}>
        <TourRouteSteps steps={noPlotSteps} currentIndex={0} />
      </I18nextProvider>
    );
    expect(screen.getByText('地図データなし（区画情報なし）')).toBeInTheDocument();
  });

  it('listing===null のステップに missing 注記が出る (address の代わりに表示)', () => {
    renderSteps(1);
    expect(screen.getByText('このハウジングは見つかりません')).toBeInTheDocument();
  });

  it('plotありのステップ (全エリア) には map_pending 注記が出ない', () => {
    const { container } = renderSteps(1);
    const items = container.querySelectorAll('.housing-tour-steps-item');
    expect(items[0].querySelector('.housing-tour-steps-note')).toBeNull(); // Mist
    expect(items[1].querySelector('.housing-tour-steps-note')).toBeNull(); // Shirogane (非ミスト)
  });
});
