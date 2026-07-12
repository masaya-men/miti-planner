// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { TourPhaseZone } from '../TourPhaseZone';
import type { TourCrossing } from '../../../../lib/housing/tourCrossing';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});
afterEach(() => vi.useRealTimers());

describe('TourPhaseZone', () => {
  it('moving: 行き方(テレポ+徒歩)を出す', () => {
    const { container, getByText } = render(
      <I18nextProvider i18n={i18n}>
        <TourPhaseZone phase="moving" directions={{ aetheryte: 'ゴブレットビュート', directions: '西へ少し' }} viewStartAt={null} />
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-tour-phasezone-route')).not.toBeNull();
    expect(getByText(/ゴブレットビュート/)).toBeInTheDocument();
    expect(getByText('西へ少し')).toBeInTheDocument();
    expect(container.querySelector('.housing-tour-phasezone-timer')).toBeNull();
  });

  it('moving + directions=null: タイマーも行き方も出さない', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <TourPhaseZone phase="moving" directions={null} viewStartAt={null} />
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-tour-phasezone-route')).toBeNull();
    expect(container.querySelector('.housing-tour-phasezone-timer')).toBeNull();
  });

  it('viewing: 開始時刻(14:32)と経過(0:00)を出す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T14:32:00'));
    const start = Date.now();
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <TourPhaseZone phase="viewing" directions={null} viewStartAt={start} />
      </I18nextProvider>,
    );
    const timer = container.querySelector('.housing-tour-phasezone-timer')!;
    expect(timer.textContent).toContain('14:32');
    expect(timer.textContent).toContain('0:00');
  });

  const renderZone = (crossing: TourCrossing, directions = null) =>
    render(
      <I18nextProvider i18n={i18n}>
        <TourPhaseZone phase="moving" directions={directions} viewStartAt={null} crossing={crossing} />
      </I18nextProvider>,
    );

  it('dc 跨ぎで DCトラベル行が出る', () => {
    renderZone({ kind: 'dc', dc: 'Gaia', world: 'Ifrit' });
    expect(screen.getByTestId('tour-phase-cross')).toHaveTextContent('Gaia');
    expect(screen.getByTestId('tour-phase-cross')).toHaveTextContent('Ifrit');
  });

  it('none 跨ぎでは行が出ない', () => {
    renderZone({ kind: 'none' });
    expect(screen.queryByTestId('tour-phase-cross')).toBeNull();
  });
});
