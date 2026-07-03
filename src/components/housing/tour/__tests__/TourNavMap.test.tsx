// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { WARD_CENTER_NODE } from '../../../../lib/housing/wardRoute';
import { TourNavMap, type PlacedStep } from '../TourNavMap';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

// Mist ward の実データに存在する plot (kind='plot') のみ使用。
const placed: PlacedStep[] = [
  { index: 0, plot: 1, status: 'arrived' },
  { index: 1, plot: 6, status: 'current' },
  { index: 2, plot: 30, status: 'upcoming' },
];

function renderMap(props: Partial<React.ComponentProps<typeof TourNavMap>> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TourNavMap placed={placed} currentPlot={6} originNodeId={WARD_CENTER_NODE} {...props} />
    </I18nextProvider>
  );
}

describe('TourNavMap — 番号ノード', () => {
  it('placed.length 個の番号ノードが描画される', () => {
    const { container } = renderMap();
    expect(container.querySelectorAll('[data-testid="tour-map-node"]').length).toBe(placed.length);
  });

  it('配置不能な plot (存在しないデータ) はスキップされ、ノード数が減る', () => {
    const { container } = renderMap({
      placed: [...placed, { index: 3, plot: 999999, status: 'upcoming' }],
    });
    expect(container.querySelectorAll('[data-testid="tour-map-node"]').length).toBe(placed.length);
  });
});

describe('TourNavMap — 光ナビ経路', () => {
  it('currentPlot が有効な plot 番号なら経路 path を描画する', () => {
    const { container } = renderMap({ currentPlot: 6 });
    expect(container.querySelector('[data-testid="tour-map-route"]')).not.toBeNull();
  });

  it('currentPlot が null なら経路 path を描画しない', () => {
    const { container } = renderMap({ currentPlot: null });
    expect(container.querySelector('[data-testid="tour-map-route"]')).toBeNull();
  });
});
