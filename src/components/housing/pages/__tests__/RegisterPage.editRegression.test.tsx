// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { useAuthStore } from '../../../../store/useAuthStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
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

import { RegisterPage } from '../RegisterPage';
// create パス (performRegister) の API を spy するため実モジュールを名前空間 import する
// (module 全体 mock は他 export を壊すため spyOn で個別に差し替える)。
import * as housingApiClient from '../../../../lib/housingApiClient';
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

  // 2026-07-20 実ユーザー報告の回帰テスト:「最初に登録した物件を編集すると、別の物件の
  // データになってしまい編集できない」。根因は2つ: ①オートセーブ (新規登録の下書き復旧)
  // が mode を問わず動作しており、以前どこかで保存された無関係な下書きが編集フォームへ
  // 無条件で上書き適用されていた ②HousingEditPage が RegisterPage を key 無しで描画しており
  // (App.tsx の Route も同様)、別 listingId の編集へ遷移してもコンポーネントが再マウントされず、
  // 一度きりの useState 初期化 (initialValues 由来) が古い物件の値のまま残っていた。
  describe('編集ページの物件取り違えバグ回帰 (2026-07-20)', () => {
    it('mode=edit は localStorage に残った別物件/新規登録の下書きを復元しない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      // 「以前どこかで保存された無関係な下書き」を模す (別物件の編集中 or 新規登録の入力中)。
      window.localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({ title: '別の物件のタイトル', dc: 'Chaos', tags: ['event_seasonal'] }),
      );

      const { container } = renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });

      // 表示されるのはあくまで initialValues (サーバーの現在値) であり、下書きの内容ではない。
      expect((screen.getByTestId('housing-register-title-input') as HTMLInputElement).value).toBe(
        'テスト物件',
      );
      expect((container.querySelector('#housing-register-dc') as HTMLSelectElement).value).toBe(
        'Meteor',
      );
    });

    it('mode=edit: 別物件の下書きが残っていても保存内容は initialValues 由来のまま (取り違え防止)', async () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      updateMock.mockResolvedValueOnce({ ok: true });
      window.localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({ title: '別の物件のタイトル', dc: 'Chaos' }),
      );

      renderPage({ mode: 'edit', initialValues: EDITABLE_LISTING });
      fireEvent.click(screen.getByTestId('housing-register-confirm-submit'));

      await waitFor(() => expect(updateMock).toHaveBeenCalled());
      expect(updateMock).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({ title: 'テスト物件', dc: 'Meteor' }),
      );
    });

    it('key={listingId} で再マウントすると、前に編集していた別物件のフォーム内容が残らない', () => {
      useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
      const listingA = {
        ...EDITABLE_LISTING,
        id: 'lidA',
        title: '物件A',
        dc: 'Meteor',
      } as HousingListing;
      const listingB = {
        ...EDITABLE_LISTING,
        id: 'lidB',
        title: '物件B',
        dc: 'Chaos',
        server: 'Cerberus',
      } as HousingListing;

      const { rerender, container } = render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage key={listingA.id} mode="edit" initialValues={listingA} />
          </MemoryRouter>
        </I18nextProvider>,
      );
      expect((screen.getByTestId('housing-register-title-input') as HTMLInputElement).value).toBe(
        '物件A',
      );

      // HousingEditPage が実際に行う遷移を模す: 別 listingId への navigate で
      // initialValues が変わり、key (= listingId) も追従して変わる。
      rerender(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RegisterPage key={listingB.id} mode="edit" initialValues={listingB} />
          </MemoryRouter>
        </I18nextProvider>,
      );

      // key が変わったことで RegisterPage は完全に再マウントされ、物件Bの内容だけが表示される。
      expect((screen.getByTestId('housing-register-title-input') as HTMLInputElement).value).toBe(
        '物件B',
      );
      expect((container.querySelector('#housing-register-dc') as HTMLSelectElement).value).toBe(
        'Chaos',
      );
    });
  });

  // Task3.3a 回帰修復: create パス (performRegister) は onSaved を呼ばない (create 挙動不変)。
  // オートセーブ復元で create フォームを valid 状態にし、実 register を spy して検証する。
  it('mode=create の登録成功では onSaved は呼ばれない', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    // 復元でフォームを埋めて canSubmit=true にする (EDITABLE_LISTING と同じ有効な住所)。
    window.localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({
        title: '新規物件',
        dc: 'Meteor',
        server: 'Ramuh',
        area: 'LavenderBeds',
        ward: 29,
        buildingType: 'house',
        plot: 3,
        size: 'L',
        visibility: 'public',
      }),
    );
    const canRegisterSpy = vi
      .spyOn(housingApiClient, 'canRegister')
      .mockResolvedValue({ remaining: 5 } as any);
    const checkDuplicateSpy = vi
      .spyOn(housingApiClient, 'checkDuplicate')
      .mockResolvedValue({ duplicates: [], privateMatchCount: 0 } as any);
    const registerSpy = vi
      .spyOn(housingApiClient, 'registerListing')
      .mockResolvedValue({ id: 'new1' } as any);
    const onSaved = vi.fn();

    // mode 省略 = create (既定)。
    const { container } = renderPage({ onSaved });

    // 画像必須 (mode=create): 復元では画像は戻らないので 1 枚追加してから確認・送信する。
    await attachImage(container);

    // 住所確認ゲート (C案・2026-07-10): オートセーブ復元の住所は未確認扱いのため、
    // 送信可能になる前に確認ボタンを押す必要がある。
    const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
    fireEvent.click(addressGateBtn);

    const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    fireEvent.click(submitBtn);

    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/housing/listing/new1'));
    // create パスは onSaved を配線しない
    expect(onSaved).not.toHaveBeenCalled();

    canRegisterSpy.mockRestore();
    checkDuplicateSpy.mockRestore();
    registerSpy.mockRestore();
    window.localStorage.removeItem(AUTOSAVE_KEY);
  });

  // ② 確認&公開ボタン上の住所をフル住所化 (2026-07-13 round2 A-3)。
  it('mode=create: 住所が揃うとリージョン/DC/ワールドを含むフル住所が確認セクションに出る (A-3)', () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    window.localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({
        title: '新規物件',
        dc: 'Meteor',
        server: 'Ramuh',
        area: 'LavenderBeds',
        ward: 29,
        buildingType: 'house',
        plot: 3,
        size: 'L',
        visibility: 'public',
      }),
    );

    const { container } = renderPage();

    // Meteor は JP リージョン (dcServerMap.ts)。A-3 以前は住所行が街区住所のみ
    // ("ラベンダーベッド 29-3") だったが、formatFullHousingAddress 化で
    // リージョン/DC/ワールドを含むフル住所になる。2026-07-15 の UI 調整で住所は確認セクションの
    // 主役ブロックに 1 回だけ大きく表示するようになった (旧: ゲート + 要約 dl の二重表示)。
    const gateAddress = container.querySelector('.housing-register-confirm-address-value');
    expect(gateAddress?.textContent).toBe('日本 / Meteor / Ramuh / ラベンダーベッド 29-3');

    window.localStorage.removeItem(AUTOSAVE_KEY);
  });

  // c: 登録後に探すへ即反映 (Firestore 読み取り0) (2026-07-13 round2 A-5)。
  it('mode=create: 登録成功時、ローカル view-model で upsert され、fetchAndUpsert/loadMine は呼ばれない (A-5)', async () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    window.localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({
        title: '新規物件',
        dc: 'Meteor',
        server: 'Ramuh',
        area: 'LavenderBeds',
        ward: 29,
        buildingType: 'house',
        plot: 3,
        size: 'L',
        visibility: 'public',
      }),
    );
    const canRegisterSpy = vi
      .spyOn(housingApiClient, 'canRegister')
      .mockResolvedValue({ remaining: 5 } as any);
    const checkDuplicateSpy = vi
      .spyOn(housingApiClient, 'checkDuplicate')
      .mockResolvedValue({ duplicates: [], privateMatchCount: 0 } as any);
    const registerSpy = vi
      .spyOn(housingApiClient, 'registerListing')
      .mockResolvedValue({ id: 'new1' } as any);
    const upsertSpy = vi.spyOn(useHousingListingsStore.getState(), 'upsert');
    const fetchAndUpsertSpy = vi.spyOn(useHousingListingsStore.getState(), 'fetchAndUpsert');
    const loadMineSpy = vi.spyOn(useHousingListingsStore.getState(), 'loadMine');

    const { container } = renderPage();

    // 画像必須 (mode=create): 復元では画像は戻らないので 1 枚追加してから確認・送信する。
    await attachImage(container);

    const addressGateBtn = await screen.findByTestId('housing-register-confirm-address-btn');
    fireEvent.click(addressGateBtn);

    const submitBtn = await screen.findByTestId('housing-register-confirm-submit');
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    fireEvent.click(submitBtn);

    await waitFor(() => expect(registerSpy).toHaveBeenCalled());
    await waitFor(() => expect(upsertSpy).toHaveBeenCalledTimes(1));

    // ローカル view-model の主要フィールドを確認 (Firestore 読み取り無しで組み立てられたもの)。
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new1',
        ownerUid: 'me',
        dc: 'Meteor',
        server: 'Ramuh',
        region: 'JP',
        area: 'LavenderBeds',
        ward: 29,
        buildingType: 'house',
        plot: 3,
        visibility: 'public',
        title: '新規物件',
      }),
    );

    // 追加の Firestore 読み取り (getDoc 1件 + getMyListings 最大200件) が発生しないことを固定する。
    expect(fetchAndUpsertSpy).not.toHaveBeenCalled();
    expect(loadMineSpy).not.toHaveBeenCalled();

    canRegisterSpy.mockRestore();
    checkDuplicateSpy.mockRestore();
    registerSpy.mockRestore();
    upsertSpy.mockRestore();
    fetchAndUpsertSpy.mockRestore();
    loadMineSpy.mockRestore();
    window.localStorage.removeItem(AUTOSAVE_KEY);
  });

});
