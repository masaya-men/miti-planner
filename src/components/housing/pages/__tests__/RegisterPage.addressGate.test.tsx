// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { useAuthStore } from '../../../../store/useAuthStore';
import type { HousingListing } from '../../../../types/housing';

// mode=edit の保存 API (Task3.2)。 現物のシグネチャ (update: (id, updates) => Promise<{ok,error?}>)
// に合わせる。 呼び出し検証のため vi.fn() を差し込む。
const updateMock = vi.fn();
vi.mock('../../edit/useHousingUpdate', () => ({
  useHousingUpdate: () => ({ update: updateMock, loading: false }),
}));

// 保存後 navigate('/housing/listing/:id') を検証するため useNavigate だけ差し替える
// (MemoryRouter 等の他 export は実物のまま・TourNavPage.test.tsx と同じパターン)。
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

// fetchAndUpsert/loadMine (useHousingListingsStore) が内部で叩く実サービス層。
// 未モックだと実 Firestore へ到達しようとするため、 store テストと同じ方針でモックする
// (fetchAndUpsert/loadMine 自体は失敗を握りつぶす実装だが、 決定的・高速なテストにするため)。
vi.mock('../../../../lib/housingListingsService', () => ({
  getListingById: vi.fn().mockResolvedValue(null),
  getMyListings: vi.fn().mockResolvedValue([]),
}));

// RegisterHousingerCta (Task9) は自分のプロフィールを getDoc で直読みする。 このテストファイルは
// firebase/firestore を実物のまま (useAuthStore が real lib/firebase を経由するため) 使っており、
// モックしないと本番 Firestore への実ネットワーク呼び出しが発生してしまう。
// CTA 自体のロジックは RegisterHousingerCta.test.tsx で個別に検証済みのため、ここではスタブする。
vi.mock('../../register/RegisterHousingerCta', () => ({
  RegisterHousingerCta: () => null,
}));

// 画像アップロード経路 (localImages) をテストから使うため、圧縮を同期スタブ化する。
// 画像必須 (mode=create) の submit 可否を検証するテストが、実 canvas 圧縮なしで
// File を 1 枚追加できるようにする。
vi.mock('../../../../lib/housing/imageCompression', () => ({
  compressHousingImage: vi.fn(async (file: File) => ({
    base64: 'ZmFrZQ==',
    mimeType: 'image/webp',
    file,
    originalBytes: 1000,
    compressedBytes: 800,
  })),
}));

// 編集ページ commitEditSnsFetch の回帰テスト用に useTweetFetch/useOgpFetch をモックする
// (RegisterSectionMedia.test.tsx / HousingEditSourcePanel.test.tsx と同じ方針)。
// このモックはファイル全体に適用されるが、他テストは URL 入力欄を一切操作しないため無影響。
const mockFetchTweet = vi.fn();
const mockCancelTweet = vi.fn();
const mockResetTweet = vi.fn();
let tweetState: any = {
  status: 'idle',
  data: null,
  errorCode: null,
  fetchTweet: mockFetchTweet,
  cancel: mockCancelTweet,
  reset: mockResetTweet,
};
vi.mock('../../../../lib/housing/useTweetFetch', () => ({
  useTweetFetch: () => tweetState,
}));

const mockFetchOgp = vi.fn();
const mockCancelOgp = vi.fn();
const mockResetOgp = vi.fn();
let ogpState: any = {
  status: 'idle',
  data: null,
  errorCode: null,
  fetchOgp: mockFetchOgp,
  cancel: mockCancelOgp,
  reset: mockResetOgp,
};
vi.mock('../../../../lib/housing/useOgpFetch', () => ({
  useOgpFetch: () => ogpState,
}));

const mockFetchYoutubeMeta = vi.fn();
const mockCancelYoutube = vi.fn();
const mockResetYoutube = vi.fn();
let youtubeState: any = {
  status: 'idle',
  data: null,
  fetchYoutubeMeta: mockFetchYoutubeMeta,
  cancel: mockCancelYoutube,
  reset: mockResetYoutube,
};
vi.mock('../../../../lib/housing/useYoutubeFetch', () => ({
  useYoutubeFetch: () => youtubeState,
}));

import { AUTOSAVE_KEY } from '../../../../lib/housing/registerAutosave';
import { EDITABLE_LISTING, renderPage, attachImage, initTestI18n } from './registerPageTestSetup';

beforeAll(initTestI18n);

describe('RegisterPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, loading: false });
    updateMock.mockReset();
    navigateMock.mockReset();
    // commitEditSnsFetch 回帰テスト用の tweet/ogp fetch モックを idle に戻す (テスト間独立性)。
    mockFetchTweet.mockClear();
    mockCancelTweet.mockClear();
    mockResetTweet.mockClear();
    mockFetchOgp.mockClear();
    mockCancelOgp.mockClear();
    mockResetOgp.mockClear();
    tweetState = {
      status: 'idle',
      data: null,
      errorCode: null,
      fetchTweet: mockFetchTweet,
      cancel: mockCancelTweet,
      reset: mockResetTweet,
    };
    ogpState = {
      status: 'idle',
      data: null,
      errorCode: null,
      fetchOgp: mockFetchOgp,
      cancel: mockCancelOgp,
      reset: mockResetOgp,
    };
    mockFetchYoutubeMeta.mockClear();
    mockCancelYoutube.mockClear();
    mockResetYoutube.mockClear();
    youtubeState = {
      status: 'idle',
      data: null,
      fetchYoutubeMeta: mockFetchYoutubeMeta,
      cancel: mockCancelYoutube,
      reset: mockResetYoutube,
    };
    // オートセーブ復元テストが assertion 失敗で早期リターンすると、末尾の
    // removeItem に届かず後続テストへ localStorage が漏れる (実際に踏んだ事故)。
    // beforeEach で毎回クリアし、テスト間の独立性を保証する。
    window.localStorage.removeItem(AUTOSAVE_KEY);
  });

  // FCハウスの個室トグル (2026-07-15): 部屋区分の 2 択チップを廃し、「FCハウスの個室ですか?」の
  // オンオフ 1 つに。default=オフ=家全体。オンで部屋番号欄が出る (roomKind=private_chamber)。
  describe('FCハウスの個室トグル', () => {
    const clickHouse = (container: HTMLElement) =>
      fireEvent.click(
        within(container.querySelectorAll('[role="radiogroup"]')[0] as HTMLElement).getByRole(
          'radio',
          { name: '個人宅・FCハウス' },
        ),
      );

    it('個人宅を選んだ直後は個室オフ = 部屋番号欄が出ない (default=家全体)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();
      clickHouse(container);
      expect(container.querySelector('#housing-register-room-number')).toBeNull();
    });

    it('個室トグルをオンにすると部屋番号欄が出る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();
      clickHouse(container);
      fireEvent.click(screen.getByTestId('housing-register-room-chamber-toggle'));
      expect(container.querySelector('#housing-register-room-number')).not.toBeNull();
    });

    it('個室オン→オフに戻すと部屋番号欄が消える', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();
      clickHouse(container);
      const toggle = screen.getByTestId('housing-register-room-chamber-toggle');
      fireEvent.click(toggle);
      expect(container.querySelector('#housing-register-room-number')).not.toBeNull();
      fireEvent.click(toggle);
      expect(container.querySelector('#housing-register-room-number')).toBeNull();
    });
  });

  // Task1: 住所確認ゲート (C案・2026-07-10)。フォーム値から組み立てた住所文を確認セクションに
  // 提示し、「この住所で間違いありません」を押すまで送信できない。
  describe('住所確認ゲート (C案・2026-07-10)', () => {
    // buildingType の「家」チップと roomKind (家全体) チップが同じラベルを共有しているため
    // (Task3 で解消予定)、role=radiogroup の先頭 (buildingType) を明示的に絞って操作する。
    const clickHouseChip = (container: HTMLElement) => {
      const radiogroups = container.querySelectorAll('[role="radiogroup"]');
      fireEvent.click(within(radiogroups[0] as HTMLElement).getByRole('radio', { name: '個人宅・FCハウス' }));
    };

    const fillValidAddress = async (container: HTMLElement) => {
      clickHouseChip(container);
      fireEvent.change(container.querySelector('#housing-register-dc')!, { target: { value: 'Meteor' } });
      fireEvent.change(container.querySelector('#housing-register-server')!, { target: { value: 'Ramuh' } });
      fireEvent.change(container.querySelector('#housing-register-area')!, {
        target: { value: 'LavenderBeds' },
      });
      fireEvent.change(container.querySelector('#housing-register-ward')!, { target: { value: '29' } });
      fireEvent.change(container.querySelector('#housing-register-plot')!, { target: { value: '3' } });
      // 画像必須 (mode=create): 送信可否は「住所確認 + 画像」で決まるので 1 枚用意しておく。
      await attachImage(container);
    };

    it('mode=create: 住所が妥当でも確認ボタンを押すまで送信不可・不足アクションに出る', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();
      await fillValidAddress(container);

      const submitBtn = screen.getByTestId('housing-register-confirm-submit');
      expect(submitBtn).toBeDisabled();
      expect(screen.getByTestId('housing-register-confirm-missing-address')).toHaveTextContent(
        '住所を確認してください',
      );

      fireEvent.click(screen.getByTestId('housing-register-confirm-address-btn'));

      expect(submitBtn).not.toBeDisabled();
      expect(screen.queryByTestId('housing-register-confirm-missing-address')).not.toBeInTheDocument();
    });

    it('確認後に住所フィールド (どれでも) を変更すると確認が解除される', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage();
      await fillValidAddress(container);
      fireEvent.click(screen.getByTestId('housing-register-confirm-address-btn'));

      const submitBtn = screen.getByTestId('housing-register-confirm-submit');
      expect(submitBtn).not.toBeDisabled();

      fireEvent.change(container.querySelector('#housing-register-ward')!, { target: { value: '5' } });

      expect(submitBtn).toBeDisabled();
      expect(screen.getByTestId('housing-register-confirm-address-btn')).not.toBeDisabled();
    });

    it('mode=edit: 住所に触れなければ初期状態から確認済み扱い (送信可)', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      expect(screen.getByTestId('housing-register-confirm-submit')).not.toBeDisabled();
      const gateBtn = screen.getByTestId('housing-register-confirm-address-btn');
      expect(gateBtn).toBeDisabled();
      expect(gateBtn).toHaveAttribute('data-confirmed', 'true');
    });

    it('mode=edit: 住所を変更すると再確認が必要になり、再確認すれば送信可に戻る', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      const submitBtn = screen.getByTestId('housing-register-confirm-submit');
      expect(submitBtn).not.toBeDisabled();

      fireEvent.change(container.querySelector('#housing-register-ward')!, { target: { value: '5' } });
      expect(submitBtn).toBeDisabled();

      fireEvent.click(screen.getByTestId('housing-register-confirm-address-btn'));
      expect(submitBtn).not.toBeDisabled();
    });

    it('size の自動導出 (区画由来の食い違い訂正) だけでは確認は解除されない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // LavenderBeds plot 29 の実サイズは S。listing には誤った 'L' が入っている
      // (「size は区画から自動導出され手入力できない」テストと同じフィクスチャ)。
      // 導出 effect が size を書き換えるが、住所変更とはみなさず確認は解除されない。
      const wrong = { ...EDITABLE_LISTING, plot: 29, size: 'L' } as unknown as HousingListing;
      renderPage({ mode: 'edit', initialValues: wrong });

      expect(screen.getByTestId('housing-register-confirm-submit')).not.toBeDisabled();
      expect(screen.getByTestId('housing-register-confirm-address-btn')).toHaveAttribute(
        'data-confirmed',
        'true',
      );
    });
  });

});
