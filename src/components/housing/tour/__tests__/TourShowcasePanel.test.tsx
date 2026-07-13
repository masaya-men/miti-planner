// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import type { TourStep } from '../../../../lib/housing/tourNav';
import { formatHousingAddress, formatFullHousingAddress } from '../../../../lib/housing/formatHousingAddress';
import { HousingPlaybackProvider } from '../../../../lib/housing/HousingPlaybackContext';
import { createEphemeralListing } from '../../../../lib/housing/ephemeralListing';
import { consumeRegisterPrefill } from '../../../../lib/housing/registerPrefill';

// TourShowcasePanel は Task5 で useNavigate を使うため、Router なしで render するこの
// テストでは react-router-dom を差し替える (ListingCard.test.tsx / TourNavPage.test.tsx と同じパターン)。
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

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
  beforeEach(() => {
    navigate.mockReset();
    window.sessionStorage.clear();
  });

  it('住所＋サイズが1行に集約されて出る', () => {
    const { container } = renderPanel();
    const line = container.querySelector('.housing-tour-dest-addrsize')!;
    expect(line.textContent).toContain(formatHousingAddress(cur, 'ja'));
    expect(line.textContent).toContain(cur.size!);
  });

  // N: 現在の目的地の住所行は DC込みの完全住所 (リージョン/DC/ワールド + area+ward+plot)。
  it('現在の目的地の住所行に DC込みの完全住所(リージョン/DC/ワールド)が出る', () => {
    const { container } = renderPanel();
    const line = container.querySelector('.housing-tour-dest-addrsize')!;
    // cur = MOCK_LISTINGS[0] = JP / Mana / Anima / Shirogane 3-12
    expect(line.textContent).toContain(formatFullHousingAddress(cur, 'ja'));
    expect(line.textContent).toContain(cur.dc);      // 'Mana'
    expect(line.textContent).toContain(cur.server);  // 'Anima'
    expect(line.textContent).toContain(' / ');       // ` / ` 区切り
    expect(line.textContent).toContain(cur.size!);   // サイズ併記は維持
  });

  it('DC/サーバー行は撤去されている', () => {
    const { container } = renderPanel();
    expect(container.querySelector('.housing-tour-dest-world')).toBeNull();
  });

  it('コメントラベルが「コメント」で本文が出る', () => {
    renderPanel();
    expect(screen.getByText('コメント')).toBeInTheDocument();
    expect(screen.getByText(cur.description!)).toBeInTheDocument();
  });

  it('コメントが空なら ── が出る', () => {
    const empty = { ...cur, description: undefined };
    renderPanel({ currentStep: { id: empty.id, listing: empty } });
    expect(screen.getByText('──')).toBeInTheDocument();
  });

  it('次の目的地(ラベル+タイトル+住所+小メディア)が出る', () => {
    const { container } = renderPanel();
    const nextEl = container.querySelector('.housing-tour-dest-next');
    expect(nextEl).not.toBeNull();
    expect(nextEl!.querySelector('.housing-tour-dest-next-title')).not.toBeNull();
    expect(nextEl!.querySelector('.housing-tour-dest-next-addr')).not.toBeNull();
    expect(nextEl!.querySelector('.housing-tour-living-media')).not.toBeNull();
  });

  it('nextStep=null（最後の目的地）では次の目的地が出ない', () => {
    const { container } = renderPanel({ nextStep: null });
    expect(container.querySelector('.housing-tour-dest-next')).toBeNull();
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

  // 計画: 住所登録なし一時ツアー Task5 — 「この家を登録する」リンク
  describe('「この家を登録する」リンク (一時の家にのみ)', () => {
    it('登録済み listing (mock) にはリンクが出ない', () => {
      renderPanel();
      expect(screen.queryByText('この家を登録する')).toBeNull();
    });

    it('一時の家にはリンクが出て、押すと住所/SNS URL が渡り /housing/register へ遷移する', () => {
      const ephemeral = createEphemeralListing({
        area: 'LavenderBeds',
        ward: 29,
        buildingType: 'house',
        plot: 3,
        size: 'L',
        postUrl: 'https://x.com/a/status/1',
      });
      renderPanel({ currentStep: { id: ephemeral.id, listing: ephemeral } });

      const link = screen.getByText('この家を登録する');
      link.click();

      expect(consumeRegisterPrefill()).toEqual({
        area: 'LavenderBeds',
        ward: 29,
        buildingType: 'house',
        plot: 3,
        size: 'L',
        apartmentBuilding: undefined,
        roomNumber: undefined,
        postUrl: 'https://x.com/a/status/1',
      });
      expect(navigate).toHaveBeenCalledWith('/housing/register');
    });
  });
});
