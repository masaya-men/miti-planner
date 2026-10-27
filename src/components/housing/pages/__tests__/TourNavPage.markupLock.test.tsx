// @vitest-environment happy-dom
/**
 * 一時検査(整頓④ TourNavPage 分割の前後比較用・分割完了後に削除する)。
 * 子部品を「受け取った値を data-props に書き出す代役」に差し替え、TourNavPage が自分で書く HTML・
 * 子へ渡す値・外への呼び出し(API/遷移/トースト/保存)を状態ごとに記録する。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MockListing } from '../../../../data/housing/mockListings';
import { useHousingTourStore } from '../../../../store/useHousingTourStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import { useEphemeralListingsStore } from '../../../../store/useEphemeralListingsStore';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';
import { useHousingModalStore } from '../../../../store/useHousingModalStore';

const h = vi.hoisted(() => {
  const log: unknown[] = [];
  // t は毎回同じ関数(変わると effect が張り直されて偽の結果になる)
  const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k);
  const tr = { t, i18n: { language: 'ja' } };
  const safe = (v: unknown) => {
    return JSON.stringify(v, (_k, x) => {
      if (typeof x === 'function') return 'fn';
      if (x && typeof x === 'object') {
        if ('$$typeof' in x) return '<element>';
      }
      return x === undefined ? '<undefined>' : x;
    });
  };
  const makeStub =
    (React: typeof import('react'), name: string) =>
    (props: Record<string, unknown>) => {
      const { children, ...rest } = props;
      const fns = Object.keys(rest).filter((k) => typeof rest[k] === 'function');
      return React.createElement(
        'div',
        { 'data-stub': name, 'data-props': safe(rest) },
        ...fns.map((k) =>
          React.createElement('button', {
            key: k,
            'data-call': `${name}.${k}`,
            onClick: () => (rest[k] as (...a: unknown[]) => void)(k === 'onSelect' || k === 'onAdd' ? 'lock-2' : undefined),
          }),
        ),
        children as React.ReactNode,
      );
    };
  return { log, tr, safe, makeStub };
});

vi.mock('react-i18next', () => ({ useTranslation: () => h.tr }));
const navigate = vi.fn((...a: unknown[]) => h.log.push(['navigate', ...a]));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});
vi.mock('../../../../hooks/useIsMobile', () => ({ useIsMobile: vi.fn().mockReturnValue(false) }));
vi.mock('../../../../lib/housing/useWardMapAsset', () => ({ useWardMapAsset: () => ({ status: 'loading' }) }));
vi.mock('../../../Toast', () => ({ showToast: (...a: unknown[]) => h.log.push(['toast', ...a]) }));
vi.mock('../../../../lib/housingApiClient', () => ({
  createSharedTour: async (...a: unknown[]) => {
    h.log.push(['createSharedTour', ...a]);
    return { tourToken: 'tok-1' };
  },
}));
vi.mock('../../../../lib/sharedTour/hostSync', () => ({
  pushHostState: async (...a: unknown[]) => void h.log.push(['pushHostState', ...a]),
  endHostTour: async (...a: unknown[]) => void h.log.push(['endHostTour', ...a]),
}));

vi.mock('../../tour/TourProgressPanel', async () => ({ TourProgressPanel: h.makeStub(await import('react'), 'TourProgressPanel') }));
vi.mock('../../tour/TourNavMap', async () => ({ TourNavMap: h.makeStub(await import('react'), 'TourNavMap') }));
vi.mock('../../tour/TourShowcasePanel', async () => ({ TourShowcasePanel: h.makeStub(await import('react'), 'TourShowcasePanel') }));
vi.mock('../../tour/TourEmptyState', async () => ({ TourEmptyState: h.makeStub(await import('react'), 'TourEmptyState') }));
vi.mock('../../tour/TourInvitePanel', async () => ({ TourInvitePanel: h.makeStub(await import('react'), 'TourInvitePanel') }));
vi.mock('../../tour/TourTrayDetailPanel', async () => ({ TourTrayDetailPanel: h.makeStub(await import('react'), 'TourTrayDetailPanel') }));
vi.mock('../../tour/TourVisitedList', async () => ({ TourVisitedList: h.makeStub(await import('react'), 'TourVisitedList') }));
vi.mock('../../browse/TourTrayBoard', async () => ({ TourTrayBoard: h.makeStub(await import('react'), 'TourTrayBoard') }));
vi.mock('../../browse/TourTrayList', async () => ({ TourTrayList: h.makeStub(await import('react'), 'TourTrayList') }));
vi.mock('../../browse/EphemeralAddPanel', async () => ({ EphemeralAddPanel: h.makeStub(await import('react'), 'EphemeralAddPanel') }));
vi.mock('../../workspace/MannerNoticeDialog', async () => ({ MannerNoticeDialog: h.makeStub(await import('react'), 'MannerNoticeDialog') }));
vi.mock('../../HousingLoginPrompt', async () => ({ HousingLoginPrompt: h.makeStub(await import('react'), 'HousingLoginPrompt') }));
vi.mock('../../tour/TourMobileBar', async () => ({ TourMobileBar: h.makeStub(await import('react'), 'TourMobileBar') }));
vi.mock('../../tour/TourAddressExposureDialog', async () => ({ TourAddressExposureDialog: h.makeStub(await import('react'), 'TourAddressExposureDialog') }));
vi.mock('../../report/HousingReportModal', async () => ({ HousingReportModal: h.makeStub(await import('react'), 'HousingReportModal') }));

import { TourNavPage } from '../TourNavPage';
import { useIsMobile } from '../../../../hooks/useIsMobile';

const NOW = Date.UTC(2026, 9, 27, 3, 0, 0);

function mk(id: string, plot: number, extra: Partial<MockListing> = {}): MockListing {
  return {
    id, ownerUid: 'owner-1', dc: 'Elemental', server: 'Aegis', region: 'JP', area: 'Mist', ward: 12,
    buildingType: 'house', plot, size: 'M', imageMode: 'thumbnail', tags: [], description: '', title: id,
    createdAt: NOW, lastConfirmedAt: NOW, addressKey: `Elemental|${extra.server ?? 'Aegis'}|Mist|W12|H${plot}`,
    ...extra,
  };
}
const l1 = mk('lock-1', 1);
const l2 = mk('lock-2', 6);
const l3 = mk('lock-3', 30);
const lx = mk('lock-x', 6, { server: 'Atomos' });

let clip: string[] = [];
let container: HTMLElement;

function snap(label: string) {
  const state = {
    tour: (({ listingIds, currentIndex, phase, viewStartAt, running }) => ({ listingIds, currentIndex, phase, viewStartAt, running }))(
      useHousingTourStore.getState(),
    ),
    tray: useTourTrayStore.getState().trayIds,
    view: h.safe(useHousingViewStore.getState()),
    modal: h.safe(useHousingModalStore.getState()),
    token: localStorage.getItem('lopo_shared_tour_token'),
    clip,
    log: h.log.splice(0),
  };
  expect(container.innerHTML).toMatchSnapshot(`${label} html`);
  expect(h.safe(state)).toMatchSnapshot(`${label} calls`);
}
const press = async (call: string, nth = 0) => {
  const el = container.querySelectorAll(`[data-call="${call}"]`)[nth] as HTMLElement | undefined;
  if (!el) throw new Error(`押せない: ${call}`);
  await act(async () => {
    fireEvent.click(el);
  });
};
const pressSel = async (sel: string) => {
  const el = container.querySelector(sel) as HTMLElement | null;
  if (!el) throw new Error(`押せない: ${sel}`);
  await act(async () => {
    fireEvent.click(el);
  });
};
const finish = async (call: string) => {
  for (let i = 0; i < 6 && !container.querySelector('[data-testid="tour-complete-overlay"]'); i++) await press(call);
  if (!container.querySelector('[data-testid="tour-complete-overlay"]')) throw new Error('完了しない');
};
const mount = (mobile = false) => {
  vi.mocked(useIsMobile).mockReturnValue(mobile);
  container = render(
    <MemoryRouter>
      <TourNavPage />
    </MemoryRouter>,
  ).container;
};
const running = (ids: string[], currentIndex = 0, extra: object = {}) =>
  useHousingTourStore.setState({ listingIds: ids, running: true, currentIndex, phase: 'moving', viewStartAt: null, ...extra });
const login = () => useAuthStore.setState({ user: { uid: 'me' } as never });

describe('TourNavPage 分割前後の一致(一時)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setInterval', 'clearInterval'] });
    h.log.length = 0;
    clip = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (s: string) => void clip.push(s) },
    });
    localStorage.clear();
    useHousingTourStore.setState({ listingIds: [], running: false, currentIndex: 0, phase: 'moving', viewStartAt: null });
    useHousingListingsStore.setState({ status: 'ready', listings: [l1, l2, l3, lx], myListings: [] });
    useHousingViewStore.getState().reset();
    useEphemeralListingsStore.getState().clear();
    useAuthStore.setState({ user: null });
    useTourTrayStore.getState().clear();
    useHousingModalStore.setState(useHousingModalStore.getInitialState());
  });
  afterEach(() => vi.useRealTimers());

  it('空(PC): 住所から追加を開く→1 件積むと計画に切り替わる', async () => {
    mount();
    snap('空 PC');
    await press('TourEmptyState.onOpenAdd');
    snap('空 PC 追加を開く');
    await press('EphemeralAddPanel.onAdd');
    snap('1 件積んだ');
  });

  it('空(スマホ)と空状態の遷移ボタン', async () => {
    mount(true);
    snap('空 スマホ');
    await press('TourEmptyState.onGoFavorites');
    await press('TourEmptyState.onGoBrowse');
    snap('空 遷移');
  });

  it('計画 PC: 選択→開始→マナー→開始', async () => {
    useTourTrayStore.getState().setTrayIds(() => [l1.id, l2.id, l3.id]);
    mount();
    snap('計画 PC');
    await press('TourTrayBoard.onSelect');
    snap('計画 PC 選択');
    await press('TourTrayDetailPanel.onStartClick');
    snap('計画 PC マナー');
    await press('MannerNoticeDialog.onCancel');
    snap('計画 PC マナー取消');
    await press('TourTrayDetailPanel.onStartClick');
    await press('MannerNoticeDialog.onStart');
    snap('計画 PC 開始');
  });

  it('計画 PC: 地域跨ぎは開始できない', async () => {
    useTourTrayStore.getState().setTrayIds(() => [l1.id, mk('na', 2).id]);
    useHousingListingsStore.setState({ listings: [l1, mk('na', 2, { region: 'NA', dc: 'Aether' })] });
    mount();
    await press('TourTrayDetailPanel.onStartClick');
    await press('MannerNoticeDialog.onStart');
    snap('計画 跨ぎ');
  });

  it('計画 スマホ: 追加トグル・開始', async () => {
    useTourTrayStore.getState().setTrayIds(() => [l1.id, l2.id]);
    mount(true);
    snap('計画 スマホ');
    await pressSel('.housing-ephemeral-toggle');
    snap('計画 スマホ 追加開');
    await pressSel('.housing-tour-tray-start');
    await press('MannerNoticeDialog.onStart');
    snap('計画 スマホ 開始');
  });

  it('実行中 PC 未ログイン/ログイン済・次へ・前へ・見学・報告・終了', async () => {
    running([l1.id, l2.id, l3.id]);
    mount();
    snap('実行 PC 未ログイン');
    await act(async () => login());
    snap('実行 PC ログイン');
    await press('TourProgressPanel.onViewStart');
    snap('実行 見学');
    await press('TourProgressPanel.onNext');
    snap('実行 次へ');
    await press('TourProgressPanel.onPrev');
    snap('実行 前へ');
    await press('TourShowcasePanel.onOpenReport');
    snap('実行 報告');
    await press('HousingReportModal.onClose');
    await press('TourProgressPanel.onFinish');
    snap('実行 終了');
  });

  it('跨ぎステップ: 1 回目 ack・2 回目前進', async () => {
    running([l1.id, lx.id, l3.id], 1);
    mount();
    snap('跨ぎ');
    await press('TourProgressPanel.onNext');
    snap('跨ぎ ack');
    await press('TourProgressPanel.onNext');
    snap('跨ぎ 前進');
  });

  it('スマホ 実行中: 見学中の経過・招待(自動コピー)', async () => {
    running([l1.id, l2.id], 0, { phase: 'viewing', viewStartAt: NOW - 65_000 });
    mount(true);
    snap('スマホ 見学');
    await press('TourMobileBar.onInvite');
    snap('スマホ 未ログイン招待');
    await act(async () => login());
    await press('TourMobileBar.onInvite');
    snap('スマホ 招待発行コピー');
    await press('TourMobileBar.onInvite');
    snap('スマホ 2 回目コピー');
    await press('TourMobileBar.onNext');
    snap('スマホ 次へ同期');
    await finish('TourMobileBar.onNext');
    snap('スマホ 完了');
    await pressSel('.housing-tour-complete-btn');
    snap('スマホ 完了→お気に入り?');
  });

  it('招待 PC: 名前→発行→コピー→完了→探すへ', async () => {
    login();
    running([l1.id, l2.id]);
    mount();
    await press('TourInvitePanel.onTourNameChange');
    await press('TourInvitePanel.onInvite');
    snap('PC 招待発行');
    await press('TourInvitePanel.onCopy');
    await finish('TourProgressPanel.onNext');
    snap('PC 完了');
    await pressSel('.housing-tour-complete-btn--primary');
    snap('PC 完了→探す');
  });

  it('招待 PC: 一時追加を含むと警告→このまま/取消', async () => {
    login();
    const eph = mk('eph-1', 30, { visibility: 'unlisted' });
    useEphemeralListingsStore.setState({ ephemeralListings: [eph] });
    running([l1.id, eph.id]);
    mount();
    await press('TourInvitePanel.onInvite');
    snap('警告');
    await press('TourAddressExposureDialog.onCancel');
    snap('警告 取消');
    await press('TourInvitePanel.onInvite');
    await press('TourAddressExposureDialog.onConfirm');
    snap('警告 このまま');
  });

  it('並び替え PC: 見学済みあり→選択→戻る', async () => {
    running([l1.id, l2.id, l3.id], 1);
    mount();
    await press('TourProgressPanel.onReorder');
    snap('並び替え PC');
    await press('TourTrayBoard.onSelect');
    snap('並び替え PC 選択');
    await press('TourTrayDetailPanel.onStartClick');
    snap('並び替え PC 戻る');
  });

  it('並び替え スマホ', async () => {
    running([l1.id, l2.id, l3.id], 1);
    mount(true);
    await press('TourMobileBar.onReorder');
    snap('並び替え スマホ');
    await pressSel('.housing-tour-tray-start');
    snap('並び替え スマホ 戻る');
  });

  it('完了 PC → お気に入りへ(共有なし)', async () => {
    running([l1.id]);
    mount();
    await finish('TourProgressPanel.onNext');
    snap('完了 PC 共有なし');
    container.querySelectorAll<HTMLElement>('.housing-tour-complete-btn')[1].click();
    await act(async () => undefined);
    snap('完了 → お気に入り');
  });
});
