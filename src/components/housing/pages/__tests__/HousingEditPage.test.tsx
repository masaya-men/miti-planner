// @vitest-environment happy-dom
/**
 * Task 3.3a: HousingEditPage (編集ページ) のテスト。
 * - listingId から getDoc で listing を取得し、 RegisterPage(mode='edit') に渡す配線を検証する。
 * - RegisterPage 自体は重い依存を持つため mock し、 受け取った props のみ検証する
 *   (RegisterPage 内部の mode=edit 挙動は RegisterPage.test.tsx が既に担保済み)。
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// getDoc の戻り値をテストごとに制御する (housing_listings/{id} 読み取り)
const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock('../../../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: null },
}));

// useAuthStore はテストごとに user/loading を差し替える
let mockAuthState: { user: { uid: string } | null; loading: boolean } = {
  user: null,
  loading: false,
};
vi.mock('../../../../store/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user: { uid: string } | null; loading: boolean }) => unknown) =>
    selector(mockAuthState),
}));

// RegisterPage は重い依存 (SNS取得/画像圧縮等) を持つので mock し props だけ検証する
const registerPageMock = vi.fn();
vi.mock('../RegisterPage', () => ({
  RegisterPage: (props: unknown) => {
    registerPageMock(props);
    return <div data-testid="register-page-mock" />;
  },
}));

// Task3.3a 回帰修復: onSaved 配線先の resolveReport を差し替えて呼び出しを検証する。
const resolveMock = vi.fn();
vi.mock('../../report/useResolveReport', () => ({
  useResolveReport: () => ({ resolve: resolveMock, loading: false }),
}));

import { HousingEditPage } from '../HousingEditPage';

function buildListingSnap(id: string, dataOverrides: Record<string, unknown> = {}) {
  return {
    exists: () => true,
    id,
    data: () => ({
      ownerUid: 'owner1',
      dc: 'Mana',
      server: 'Anima',
      area: 'Mist',
      ward: 5,
      buildingType: 'house',
      plot: 12,
      size: 'M',
      addressKey: 'addr-1',
      imageMode: 'none',
      tags: [],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      isHidden: false,
      reportCount: 0,
      deletedAt: null,
      ...dataOverrides,
    }),
  };
}

function renderPage(listingId = 'lid-1') {
  return render(
    <MemoryRouter initialEntries={[`/housing/listing/${listingId}/edit`]}>
      <Routes>
        <Route path="/housing/listing/:listingId/edit" element={<HousingEditPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HousingEditPage', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    registerPageMock.mockReset();
    resolveMock.mockReset();
    mockAuthState = { user: { uid: 'owner1' }, loading: false };
  });

  it('家主本人が開くと listing 取得後に RegisterPage を mode=edit + initialValues で描画する', async () => {
    mockGetDoc.mockResolvedValueOnce(buildListingSnap('lid-1'));

    renderPage('lid-1');

    await waitFor(() => {
      expect(screen.getByTestId('register-page-mock')).toBeInTheDocument();
    });

    expect(registerPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'edit',
        initialValues: expect.objectContaining({ id: 'lid-1', ownerUid: 'owner1' }),
      }),
    );
  });

  // Task3.3a 回帰修復: 保存成功時に RegisterPage の onSaved 経由で resolveReport が呼ばれる
  // (旧 useHousingDetail.handleListingSaved と同じ「編集=通報対処」経路の代替)。
  it('RegisterPage.onSaved(listingId) 発火で resolveReport(listingId) が呼ばれる', async () => {
    mockGetDoc.mockResolvedValueOnce(buildListingSnap('lid-1'));

    renderPage('lid-1');

    await waitFor(() => {
      expect(registerPageMock).toHaveBeenCalled();
    });

    // 描画された RegisterPage に onSaved が渡っていることを確認し、保存成功を模して発火する。
    const props = registerPageMock.mock.calls.at(-1)![0] as {
      onSaved?: (id: string) => void | Promise<unknown>;
    };
    expect(typeof props.onSaved).toBe('function');
    props.onSaved!('lid-1');

    expect(resolveMock).toHaveBeenCalledWith('lid-1');
  });

  it('doc が exists()=false のとき not_found パネルを表示する (RegisterPage は描画しない)', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    renderPage('lid-missing');

    await waitFor(() => {
      expect(screen.getByText('housing.detail.unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('register-page-mock')).not.toBeInTheDocument();
  });

  it('削除済み (deletedAt あり) は家主本人でも not_found', async () => {
    mockGetDoc.mockResolvedValueOnce(
      buildListingSnap('lid-deleted', { deletedAt: 1700000000000 }),
    );

    renderPage('lid-deleted');

    await waitFor(() => {
      expect(screen.getByText('housing.detail.unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('register-page-mock')).not.toBeInTheDocument();
  });

  it('非オーナーが開くと not_found (viewerUid !== ownerUid)', async () => {
    mockAuthState = { user: { uid: 'other-uid' }, loading: false };
    mockGetDoc.mockResolvedValueOnce(buildListingSnap('lid-1'));

    renderPage('lid-1');

    await waitFor(() => {
      expect(screen.getByText('housing.detail.unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('register-page-mock')).not.toBeInTheDocument();
  });

  it('未ログイン (viewerUid=null) で開くと not_found', async () => {
    mockAuthState = { user: null, loading: false };
    mockGetDoc.mockResolvedValueOnce(buildListingSnap('lid-1'));

    renderPage('lid-1');

    await waitFor(() => {
      expect(screen.getByText('housing.detail.unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('register-page-mock')).not.toBeInTheDocument();
  });

  it('isHidden=true (通報非表示) でも家主本人なら編集できる (通報対処導線を塞がない)', async () => {
    mockGetDoc.mockResolvedValueOnce(buildListingSnap('lid-hidden', { isHidden: true }));

    renderPage('lid-hidden');

    await waitFor(() => {
      expect(screen.getByTestId('register-page-mock')).toBeInTheDocument();
    });
  });

  it('auth-ready gate: authLoading=true の間は getDoc を呼ばない', async () => {
    mockAuthState = { user: { uid: 'owner1' }, loading: true };
    mockGetDoc.mockResolvedValueOnce(buildListingSnap('lid-1'));

    renderPage('lid-1');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockGetDoc).not.toHaveBeenCalled();
  });
});
