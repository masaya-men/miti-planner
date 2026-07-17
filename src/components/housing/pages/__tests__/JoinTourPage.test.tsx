// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import type { JoinTourState } from '../../../../lib/sharedTour/useJoinTour';
import type { TourSnapshot } from '../../../../types/sharedTour';

// useJoinTour(Firestore 購読)は差し替え、状態だけをテストから直接コントロールする
// (TourNavPage.test.tsx が react-router-dom / HousingReportModal を差し替えるのと同じパターン)。
const { mockState } = vi.hoisted(() => ({
  mockState: { current: { kind: 'connecting', meta: null, live: null } as JoinTourState },
}));
vi.mock('../../../../lib/sharedTour/useJoinTour', () => ({
  useJoinTour: () => mockState.current,
}));

// useIsMobile: TourNavPage.test.tsx / BrowsePage.test.tsx と同じモック流儀 (既定 false)。
vi.mock('../../../../hooks/useIsMobile', () => ({ useIsMobile: vi.fn().mockReturnValue(false) }));

import { JoinTourPage } from '../JoinTourPage';
import { useIsMobile } from '../../../../hooks/useIsMobile';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

// 実データエリア(Mist)+ 地図が引ける plot(1) を使用 (TourNavMap.test.tsx / TourNavPage.test.tsx と同じ)。
const snap: TourSnapshot = {
  id: 'join-snap-1',
  area: 'Mist',
  ward: 12,
  buildingType: 'house',
  plot: 1,
  size: 'M',
  dc: 'Elemental',
  server: 'Aegis',
  region: 'JP',
  imageMode: 'none',
  tags: [],
  title: 'テストの家',
};

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/housing/tour/tok-123']}>
        <Routes>
          <Route path="/housing/tour/:tourToken" element={<JoinTourPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('JoinTourPage — 参加者の閲覧専用ツアー描画 (Task 2.4)', () => {
  it('connecting: 中央1枚の接続中メッセージのみ(3パネルは出ない)', () => {
    mockState.current = { kind: 'connecting', meta: null, live: null };
    renderPage();
    expect(screen.getByText('接続中…')).toBeInTheDocument();
    expect(screen.queryByTestId('join-tour-viewing')).not.toBeInTheDocument();
  });

  it('viewing: 3パネル(showcase/map/progress)が描画される', () => {
    mockState.current = {
      kind: 'viewing',
      meta: {
        tourToken: 'tok-123', hostUid: 'host-1', snapshot: [snap],
        containsHiddenAddress: false, createdAt: Date.now(),
      },
      live: { status: 'live', currentIndex: 0, phase: 'moving', viewStartAt: null, lastActivityAt: Date.now() },
    };
    const { container } = renderPage();
    expect(screen.getByTestId('join-tour-viewing')).toBeInTheDocument();
    expect(container.querySelector('[data-region="left"]')).not.toBeNull();
    expect(container.querySelector('[data-region="tour-map"]')).not.toBeNull();
    expect(container.querySelector('[data-region="right"]')).not.toBeNull();
    expect(screen.getByText('ツアー進行状況')).toBeInTheDocument();
  });

  it('viewing: readOnly注記「幹事が案内中」が出て、操作ボタン(次へ/ツアーを終了)は無い', () => {
    mockState.current = {
      kind: 'viewing',
      meta: {
        tourToken: 'tok-123', hostUid: 'host-1', snapshot: [snap],
        containsHiddenAddress: false, createdAt: Date.now(),
      },
      live: { status: 'live', currentIndex: 0, phase: 'moving', viewStartAt: null, lastActivityAt: Date.now() },
    };
    renderPage();
    expect(screen.getByText('幹事が案内中')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '次へ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ツアーを終了' })).not.toBeInTheDocument();
  });

  it('viewing: 報告ボタンは出ない(参加者は報告不可)', () => {
    mockState.current = {
      kind: 'viewing',
      meta: {
        tourToken: 'tok-123', hostUid: 'host-1', snapshot: [snap],
        containsHiddenAddress: false, createdAt: Date.now(),
      },
      live: { status: 'live', currentIndex: 0, phase: 'moving', viewStartAt: null, lastActivityAt: Date.now() },
    };
    const { container } = renderPage();
    expect(container.querySelector('.housing-tour-dest-report')).toBeNull();
  });

  it('viewing: 跨ぎ案内を参加者にも出す(2026-07-17 非ブロッキング化・ボタン/待機文言は無い)', () => {
    const prev = { ...snap, id: 'join-snap-0', server: 'Atomos' };
    mockState.current = {
      kind: 'viewing',
      meta: {
        tourToken: 'tok-123', hostUid: 'host-1', snapshot: [prev, snap],
        containsHiddenAddress: false, createdAt: Date.now(),
      },
      // currentIndex=1: 前(Atomos)→現(Aegis)は同DC別ワールド = world跨ぎ。幹事の ack 待ちは撤去済みで即表示。
      live: { status: 'live', currentIndex: 1, phase: 'moving', viewStartAt: null, lastActivityAt: Date.now() },
    };
    renderPage();
    expect(screen.getByTestId('tour-map-cross')).toBeInTheDocument();
    // ボタン/待機文言は撤去済み(参加者も幹事も同じ非ブロッキング表示)。
    expect(screen.queryByRole('button', { name: /移動しました/ })).not.toBeInTheDocument();
  });

  it('viewing: 見学中(phase=viewing)は跨ぎ overlay を出さない', () => {
    const prev = { ...snap, id: 'join-snap-0', server: 'Atomos' };
    mockState.current = {
      kind: 'viewing',
      meta: {
        tourToken: 'tok-123', hostUid: 'host-1', snapshot: [prev, snap],
        containsHiddenAddress: false, createdAt: Date.now(),
      },
      live: { status: 'live', currentIndex: 1, phase: 'viewing', viewStartAt: Date.now(), lastActivityAt: Date.now() },
    };
    renderPage();
    expect(screen.queryByTestId('tour-map-cross')).not.toBeInTheDocument();
  });

  it('viewing: 参加者に「ツアーから出る」退出リンクが出る(#1)', () => {
    mockState.current = {
      kind: 'viewing',
      meta: {
        tourToken: 'tok-123', hostUid: 'host-1', snapshot: [snap],
        containsHiddenAddress: false, createdAt: Date.now(),
      },
      live: { status: 'live', currentIndex: 0, phase: 'moving', viewStartAt: null, lastActivityAt: Date.now() },
    };
    renderPage();
    expect(screen.getByRole('button', { name: 'ツアーから出る' })).toBeInTheDocument();
  });

  it('ended: 主催者と同じ完了オーバーレイ(素敵な時間でしたね+戻るボタン)を参加者にも出す(#B)', () => {
    mockState.current = {
      kind: 'ended',
      meta: {
        tourToken: 'tok-123', hostUid: 'host-1', snapshot: [snap],
        containsHiddenAddress: false, createdAt: Date.now(),
      },
      live: { status: 'ended', currentIndex: 0, phase: 'moving', viewStartAt: null, lastActivityAt: Date.now() },
    };
    renderPage();
    expect(screen.getByTestId('join-tour-complete')).toBeInTheDocument();
    expect(screen.getByText('素敵な時間でしたね！')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '探すに戻る' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'お気に入りに戻る' })).toBeInTheDocument();
  });

  it('notfound: 見つからないメッセージ(完了カードは出さない)', () => {
    mockState.current = { kind: 'notfound', meta: null, live: null };
    renderPage();
    expect(screen.getByText('このツアーは見つかりません')).toBeInTheDocument();
    expect(screen.queryByTestId('join-tour-complete')).not.toBeInTheDocument();
  });

  // Task5: スマホ横持ちUI。参加者は幹事に追従するだけ(自分では進行できない)なので
  // 操作ボタン(前へ/見学/次へ)は一切出さない。
  // 実機2回目FB#4: 行き方の表示先を下部バー(TourMobileBar)から地図下部の帯(footerDirections)へ
  // 移設したのに伴い、参加者向けバー自体を廃止した(空の操作系だけのバーが残らないようにするため)。
  describe('モバイル(useIsMobile=true)', () => {
    beforeEach(() => {
      vi.mocked(useIsMobile).mockReturnValue(true);
    });
    afterEach(() => {
      vi.mocked(useIsMobile).mockReturnValue(false);
    });

    it('viewing: TourMobileBarは廃止され出ない。行き方は地図下部の帯に全文表示される', () => {
      mockState.current = {
        kind: 'viewing',
        meta: {
          tourToken: 'tok-123', hostUid: 'host-1', snapshot: [snap],
          containsHiddenAddress: false, createdAt: Date.now(),
        },
        live: { status: 'live', currentIndex: 0, phase: 'moving', viewStartAt: null, lastActivityAt: Date.now() },
      };
      renderPage();
      // バー自体が無い(前へ/見学/次へ等の操作ボタンが無いことは非モバイルの既存テストで別途保証済み)。
      expect(screen.queryByTestId('tour-mobile-bar')).not.toBeInTheDocument();
      // 行き方は地図下部の帯(footerDirections)に全文表示される。
      const footerDirections = screen.getByTestId('tour-map-footer-directions');
      expect(footerDirections).toBeInTheDocument();
      expect(footerDirections.textContent).not.toBe('');
    });
  });
});
