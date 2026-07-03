// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import type { TourStep } from '../../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../../lib/housing/formatHousingAddress';

import { TourNextDestinationPanel } from '../TourNextDestinationPanel';
import { TourRouteSteps } from '../TourRouteSteps';

// mock-001: Shirogane (非ミスト) / size M / description あり
const currentListing = MOCK_LISTINGS[0];
// mock-002: 同じく Shirogane
const otherListing = MOCK_LISTINGS[1];
// mock-005: Mist (ミスト配置対象)
const mistListing = MOCK_LISTINGS[4];

const steps: TourStep[] = [
  { id: currentListing.id, listing: currentListing },
  { id: otherListing.id, listing: otherListing },
];

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

function renderPanel(props: Partial<Parameters<typeof TourNextDestinationPanel>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TourNextDestinationPanel
        currentStep={steps[0]}
        steps={steps}
        currentIndex={0}
        isLast={false}
        onPrev={() => {}}
        onPrimary={() => {}}
        onOpenReport={() => {}}
        {...props}
      />
    </I18nextProvider>
  );
}

describe('TourNextDestinationPanel — 次の目的地の詳細', () => {
  // 住所/サイズ/ワールドは .housing-tour-dest-facts (dest カード) の中だけを見る。
  // steps[0]=currentListing のため TourRouteSteps 側にも同じ住所文字列が出て
  // screen.getByText だと複数ヒットしてしまう (下の TourRouteSteps 連携テストで別途検証)。
  it('住所 (formatHousingAddress) が出る', () => {
    const { container } = renderPanel();
    const facts = within(container.querySelector('.housing-tour-dest-facts')!);
    expect(facts.getByText(formatHousingAddress(currentListing, 'ja'))).toBeInTheDocument();
  });

  it('サイズが出る', () => {
    const { container } = renderPanel();
    const facts = within(container.querySelector('.housing-tour-dest-facts')!);
    expect(facts.getByText(currentListing.size!)).toBeInTheDocument();
  });

  it('ワールド (server) が出る', () => {
    const { container } = renderPanel();
    const facts = within(container.querySelector('.housing-tour-dest-facts')!);
    expect(facts.getByText(currentListing.server)).toBeInTheDocument();
  });

  it('ひとことメモ (description) が出る', () => {
    renderPanel();
    expect(screen.getByText(currentListing.description!)).toBeInTheDocument();
  });

  it('メモが無いときは no_memo が出る', () => {
    const noMemoListing = { ...currentListing, description: undefined };
    renderPanel({
      currentStep: { id: noMemoListing.id, listing: noMemoListing },
      steps: [{ id: noMemoListing.id, listing: noMemoListing }],
    });
    expect(screen.getByText('メモはありません')).toBeInTheDocument();
  });
});

describe('TourNextDestinationPanel — 操作', () => {
  it('「前へ」で onPrev が呼ばれる', () => {
    const onPrev = vi.fn();
    renderPanel({ onPrev, currentIndex: 1 });
    fireEvent.click(screen.getByRole('button', { name: '前へ' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('currentIndex===0 のとき「前へ」が disabled', () => {
    renderPanel({ currentIndex: 0 });
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled();
  });

  it('主ボタンで onPrimary が呼ばれ、通常時ラベルは arrive_next', () => {
    const onPrimary = vi.fn();
    renderPanel({ onPrimary, isLast: false });
    const btn = screen.getByRole('button', { name: '到着した → 次へ' });
    fireEvent.click(btn);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('isLast===true のとき主ボタンラベルが complete になり onPrimary が呼ばれる', () => {
    const onPrimary = vi.fn();
    renderPanel({ onPrimary, isLast: true });
    const btn = screen.getByRole('button', { name: 'ツアーを完了' });
    fireEvent.click(btn);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('report_button クリックで onOpenReport が呼ばれる', () => {
    const onOpenReport = vi.fn();
    renderPanel({ onOpenReport });
    fireEvent.click(screen.getByRole('button', { name: '情報が違う・報告する' }));
    expect(onOpenReport).toHaveBeenCalledTimes(1);
  });
});

describe('TourNextDestinationPanel — TourRouteSteps 連携', () => {
  it('ルートのステップ見出しが出る', () => {
    renderPanel();
    expect(screen.getByText('ルートのステップ')).toBeInTheDocument();
  });
});

describe('TourNextDestinationPanel — 防御 (currentStep===null)', () => {
  it('currentStep===null でもクラッシュせず操作は描画される', () => {
    const { container } = renderPanel({ currentStep: null });
    expect(screen.getByRole('button', { name: '情報が違う・報告する' })).toBeInTheDocument();
    // 詳細カード (サムネ/住所/サイズ/ワールド/メモ) は出ない。
    // TourRouteSteps 側の住所表示は steps prop に依存するため対象外 (別テストで検証済み)。
    expect(container.querySelector('.housing-tour-dest-card')).toBeNull();
  });
});

describe('TourRouteSteps — 状態バッジ / 注記', () => {
  const mixedSteps: TourStep[] = [
    { id: mistListing.id, listing: mistListing }, // index0: 到着済み (ミスト)
    { id: currentListing.id, listing: currentListing }, // index1: 次に訪問 (非ミスト)
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

  it('非ミストのステップに map_pending 注記が出る', () => {
    renderSteps(1);
    expect(screen.getByText('地図は準備中（全エリアは近日）')).toBeInTheDocument();
  });

  it('listing===null のステップに missing 注記が出る (address の代わりに表示)', () => {
    renderSteps(1);
    expect(screen.getByText('このハウジングは見つかりません')).toBeInTheDocument();
  });

  it('ミストのステップには map_pending 注記が出ない', () => {
    const { container } = renderSteps(1);
    const mistItem = container.querySelectorAll('.housing-tour-steps-item')[0];
    expect(mistItem.querySelector('.housing-tour-steps-note')).toBeNull();
  });
});
