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

import { JoinTourPage } from '../JoinTourPage';

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

  it('viewing: 跨ぎ overlay は出ない(showCrossing=false・幹事が phase を駆動する前提)', () => {
    const prev = { ...snap, id: 'join-snap-0', server: 'Atomos' };
    mockState.current = {
      kind: 'viewing',
      meta: {
        tourToken: 'tok-123', hostUid: 'host-1', snapshot: [prev, snap],
        containsHiddenAddress: false, createdAt: Date.now(),
      },
      // currentIndex=1: 前(Atomos)→現(Aegis)は同DC別ワールド = world跨ぎ。showCrossing=false なので出ない。
      live: { status: 'live', currentIndex: 1, phase: 'moving', viewStartAt: null, lastActivityAt: Date.now() },
    };
    renderPage();
    expect(screen.queryByTestId('tour-map-cross')).not.toBeInTheDocument();
  });
});
