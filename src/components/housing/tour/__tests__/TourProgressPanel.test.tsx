// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import type { TourProgress, TourStep } from '../../../../lib/housing/tourNav';
import { TourProgressPanel } from '../TourProgressPanel';

const a = MOCK_LISTINGS[0];
const b = MOCK_LISTINGS[1];
const baseProgress: TourProgress = {
  total: 5, arrivedCount: 2, remainingCount: 3, percent: 40,
  currentStep: { id: a.id, listing: a }, recent: [{ id: b.id, listing: b }],
};
const steps: TourStep[] = [{ id: a.id, listing: a }, { id: b.id, listing: b }];

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPanel(props: Partial<Parameters<typeof TourProgressPanel>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TourProgressPanel
        progress={baseProgress} steps={steps} currentIndex={0}
        phase="moving" viewStartAt={null}
        directions={{ aetheryte: 'ゴブレットビュート', directions: '西へ少し' }}
        canView={true} isLast={false}
        onPrev={() => {}} onViewStart={() => {}} onNext={() => {}} onFinish={() => {}}
        {...props}
      />
    </I18nextProvider>,
  );
}

describe('TourProgressPanel — 進捗＋操作', () => {
  it('円インジケーターのみ (percent) 表示・到着済/残りの箱は撤去', () => {
    const { container } = renderPanel();
    expect(screen.getByText('40% 完了')).toBeInTheDocument();
    expect(container.querySelector('.housing-tour-progress-summary')).not.toBeNull();
    expect(container.querySelector('.housing-tour-progress-stats')).toBeNull();
  });

  it('縦ステッパー(ルートのステップ)が steps 件数分出る', () => {
    const { container } = renderPanel();
    expect(container.querySelectorAll('.housing-tour-steps-item')).toHaveLength(steps.length);
  });

  it('moving では行き方、viewing ではタイマーがフェーズ枠に出る', () => {
    const { container, rerender } = renderPanel();
    expect(container.querySelector('.housing-tour-phasezone-route')).not.toBeNull();
    rerender(
      <I18nextProvider i18n={i18n}>
        <TourProgressPanel
          progress={baseProgress} steps={steps} currentIndex={0}
          phase="viewing" viewStartAt={new Date('2026-07-08T14:32:00').getTime()}
          directions={null} canView={true} isLast={false}
          onPrev={() => {}} onViewStart={() => {}} onNext={() => {}} onFinish={() => {}}
        />
      </I18nextProvider>,
    );
    expect(container.querySelector('.housing-tour-phasezone-timer')).not.toBeNull();
  });

  it('前へ: currentIndex===0 で disabled', () => {
    renderPanel({ currentIndex: 0 });
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled();
  });

  it('見学: canView=true で押せて onViewStart、canView=false で disabled', () => {
    const onViewStart = vi.fn();
    const { rerender } = renderPanel({ onViewStart, canView: true });
    screen.getByRole('button', { name: /見学開始/ }).click();
    expect(onViewStart).toHaveBeenCalledTimes(1);
    rerender(
      <I18nextProvider i18n={i18n}>
        <TourProgressPanel
          progress={baseProgress} steps={steps} currentIndex={0}
          phase="moving" viewStartAt={null} directions={null}
          canView={false} isLast={false}
          onPrev={() => {}} onViewStart={onViewStart} onNext={() => {}} onFinish={() => {}}
        />
      </I18nextProvider>,
    );
    expect(screen.getByRole('button', { name: /見学開始/ })).toBeDisabled();
  });

  it('次へ: 通常は「次へ」ラベルで onNext、isLast では「ツアーを完了」', () => {
    const onNext = vi.fn();
    const { rerender } = renderPanel({ onNext, isLast: false });
    screen.getByRole('button', { name: '次へ' }).click();
    expect(onNext).toHaveBeenCalledTimes(1);
    rerender(
      <I18nextProvider i18n={i18n}>
        <TourProgressPanel
          progress={baseProgress} steps={steps} currentIndex={0}
          phase="moving" viewStartAt={null} directions={null}
          canView={true} isLast={true}
          onPrev={() => {}} onViewStart={() => {}} onNext={onNext} onFinish={() => {}}
        />
      </I18nextProvider>,
    );
    expect(screen.getByRole('button', { name: 'ツアーを完了' })).toBeInTheDocument();
  });

  it('ツアーを終了で onFinish', () => {
    const onFinish = vi.fn();
    renderPanel({ onFinish });
    screen.getByRole('button', { name: 'ツアーを終了' }).click();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
