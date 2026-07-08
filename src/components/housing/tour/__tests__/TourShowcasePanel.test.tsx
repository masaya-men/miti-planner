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
import { getPlotDirections } from '../../../../lib/housing/wardDirections';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';

import { TourShowcasePanel } from '../TourShowcasePanel';

// mock-001: Shirogane (非ミスト) / size M / description あり
const currentListing = MOCK_LISTINGS[0];

const singleStep: TourStep = { id: currentListing.id, listing: currentListing };

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });

  if (!window.matchMedia) {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({
        matches: false, media: query, onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
      } as unknown as MediaQueryList);
  }
});

function renderPanel(props: Partial<Parameters<typeof TourShowcasePanel>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TourShowcasePanel
        currentStep={singleStep}
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

describe('TourShowcasePanel — 次の目的地の詳細', () => {
  // 住所/サイズ/ワールドは .housing-tour-dest-facts (dest カード) の中だけを見る。
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
    renderPanel({ currentStep: { id: noMemoListing.id, listing: noMemoListing } });
    expect(screen.getByText('メモはありません')).toBeInTheDocument();
  });

  it('行き方ブロック: 最寄りエーテライトへ移動 + 徒歩ナビが出る', () => {
    const { container } = renderPanel();
    const route = container.querySelector('.housing-tour-dest-route');
    expect(route).not.toBeNull();
    const dir = getPlotDirections(currentListing.area, currentListing.plot)!;
    expect(dir).not.toBeNull();
    expect(route!.textContent).toContain(dir.aetheryte);
    if (dir.directions) expect(route!.textContent).toContain(dir.directions);
  });

  it('旧「最寄りエーテライト(エリア名)」の dl 行は無い', () => {
    const { container } = renderPanel();
    const facts = container.querySelector('.housing-tour-dest-facts')!;
    expect(facts.textContent).not.toContain('最寄りエーテライト');
  });

  it('plot 無し(アパート等)では行き方ブロックが出ない', () => {
    const apt = { ...currentListing, buildingType: 'apartment' as const, plot: undefined };
    const { container } = renderPanel({ currentStep: { id: apt.id, listing: apt } });
    expect(container.querySelector('.housing-tour-dest-route')).toBeNull();
  });
});

describe('TourShowcasePanel — 操作', () => {
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

describe('TourShowcasePanel — 防御 (currentStep===null)', () => {
  it('currentStep===null でもクラッシュせず操作は描画される', () => {
    const { container } = renderPanel({ currentStep: null });
    expect(screen.getByRole('button', { name: '情報が違う・報告する' })).toBeInTheDocument();
    // 詳細カード (サムネ/住所/サイズ/ワールド/メモ) は出ない。
    expect(container.querySelector('.housing-tour-dest-card')).toBeNull();
  });
});

describe('TourShowcasePanel — 生きたカード hero (段階2)', () => {
  it('Provider 配下で目的地画像に ambient スライドショーが出る (複数画像)', () => {
    const multi = { ...currentListing, imageMode: 'sns' as const, sourceImageUrls: ['https://x/a.jpg', 'https://x/b.jpg'] };
    const step = { id: multi.id, listing: multi };
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HousingPlaybackProvider>
          <TourShowcasePanel
            currentStep={step}
            currentIndex={0}
            isLast={false}
            onPrev={() => {}}
            onPrimary={() => {}}
            onOpenReport={() => {}}
          />
        </HousingPlaybackProvider>
      </I18nextProvider>,
    );
    const wrap = container.querySelector('.housing-tour-dest-thumb-wrap');
    expect(wrap).not.toBeNull();
    expect(wrap!.querySelector('.housing-card-ambient-slideshow')).not.toBeNull();
    expect(container.querySelector('.housing-tour-dest-thumb')).not.toBeNull(); // ベース img 残存
  });
});
