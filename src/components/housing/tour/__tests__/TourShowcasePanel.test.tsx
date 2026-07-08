// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import type { TourStep } from '../../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../../lib/housing/formatHousingAddress';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';
import { TourShowcasePanel } from '../TourShowcasePanel';

const cur = MOCK_LISTINGS[0];   // Shirogane / size M / description あり
const nxt = MOCK_LISTINGS[1];
const curStep: TourStep = { id: cur.id, listing: cur };
const nextStep: TourStep = { id: nxt.id, listing: nxt };

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja', fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList);
  }
});

function renderPanel(props: Partial<Parameters<typeof TourShowcasePanel>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <HousingPlaybackProvider>
        <TourShowcasePanel currentStep={curStep} nextStep={nextStep} onOpenReport={() => {}} {...props} />
      </HousingPlaybackProvider>
    </I18nextProvider>,
  );
}

describe('TourShowcasePanel — 表示専用ショーケース', () => {
  it('住所＋サイズが1行に集約されて出る', () => {
    const { container } = renderPanel();
    const line = container.querySelector('.housing-tour-dest-addrsize')!;
    expect(line.textContent).toContain(formatHousingAddress(cur, 'ja'));
    expect(line.textContent).toContain(cur.size!);
  });

  it('DC/サーバーが1回だけ出る', () => {
    const { container } = renderPanel();
    expect(container.querySelectorAll('.housing-tour-dest-world')).toHaveLength(1);
  });

  it('紹介文ラベルが「紹介文」で本文が出る', () => {
    renderPanel();
    expect(screen.getByText('紹介文')).toBeInTheDocument();
    expect(screen.getByText(cur.description!)).toBeInTheDocument();
  });

  it('紹介文が空なら no_memo（紹介文はありません）', () => {
    const empty = { ...cur, description: undefined };
    renderPanel({ currentStep: { id: empty.id, listing: empty } });
    expect(screen.getByText('紹介文はありません')).toBeInTheDocument();
  });

  it('次の目的地カード(生きたメディア)が出る', () => {
    const { container } = renderPanel();
    const nextCard = container.querySelector('.housing-tour-dest-nextcard');
    expect(nextCard).not.toBeNull();
    expect(nextCard!.querySelector('.housing-tour-living-media')).not.toBeNull();
  });

  it('nextStep=null（最後の目的地）では次の目的地カードが出ない', () => {
    const { container } = renderPanel({ nextStep: null });
    expect(container.querySelector('.housing-tour-dest-nextcard')).toBeNull();
  });

  it('操作ボタン(前へ/次へ)と行き方は左パネルに無い', () => {
    const { container } = renderPanel();
    expect(screen.queryByRole('button', { name: '前へ' })).toBeNull();
    expect(container.querySelector('.housing-tour-dest-route')).toBeNull();
    expect(container.querySelector('.housing-tour-dest-actions')).toBeNull();
  });

  it('報告ボタンで onOpenReport が呼ばれる', () => {
    const onOpenReport = vi.fn();
    renderPanel({ onOpenReport });
    screen.getByRole('button', { name: '情報が違う・報告する' }).click();
    expect(onOpenReport).toHaveBeenCalledTimes(1);
  });

  it('currentStep=null でもクラッシュせず報告ボタンは出る', () => {
    const { container } = renderPanel({ currentStep: null });
    expect(screen.getByRole('button', { name: '情報が違う・報告する' })).toBeInTheDocument();
    expect(container.querySelector('.housing-tour-dest-card')).toBeNull();
  });
});
