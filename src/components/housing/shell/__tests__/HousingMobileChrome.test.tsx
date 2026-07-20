// @vitest-environment happy-dom
/**
 * Task1 (モバイルシェル基盤) の要: HousingRegisterFab の未ログイン/ログイン済み分岐と、
 * HousingBottomNav の項目数/バッジ表示を検証する。フィルタ/設定シートは中身が
 * FilterPanel 等の重い既存パネルを丸ごと抱えるため、ここでは対象にしない
 * (npm run build の型検証 + 実機チェックリストに委ねる)。
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HousingBottomNav } from '../HousingBottomNav';
import { HousingRegisterFab } from '../HousingRegisterFab';
import { MobileTourTrayBar } from '../MobileTourTrayBar';
import { useTourTrayStore } from '../../../../store/useTourTrayStore';

// react-router-dom: useNavigate だけ差し替え、他 (MemoryRouter 等) は実物のまま使う
// (AppHeader.test.tsx / HousingActionBar.test.tsx と同じパターン)。
const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

let mockUser: { uid: string } | null = null;
let mockProfileAvatarUrl: string | null = null;
vi.mock('../../../../store/useAuthStore', () => ({
  useAuthStore: Object.assign(
    (sel: (s: { user: { uid: string } | null; profileAvatarUrl: string | null }) => unknown) =>
      sel({ user: mockUser, profileAvatarUrl: mockProfileAvatarUrl }),
    { setState: vi.fn(), getState: vi.fn() },
  ),
}));

const openLogin = vi.fn();
const openAccount = vi.fn();
vi.mock('../../../../store/useHousingModalStore', () => ({
  useHousingModalStore: Object.assign(
    (sel: (s: { openLogin: typeof openLogin; openAccount: typeof openAccount }) => unknown) =>
      sel({ openLogin, openAccount }),
    { setState: vi.fn(), getState: vi.fn() },
  ),
}));

let mockUnreadCount = 0;
vi.mock('../../notifications/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: mockUnreadCount }),
}));

// MobileTourTrayBar の依存: listings/ephemeral は空でよい (トレイ解決は空プールでも落ちない)。
// MannerNoticeDialog は重い workspace 部品なのでスタブ化 (開始ゲートの開閉自体は本体で検証済み)。
vi.mock('../../../../store/useHousingListingsStore', () => ({
  useHousingListingsStore: Object.assign(
    (sel: (s: { listings: unknown[]; myListings: unknown[] }) => unknown) =>
      sel({ listings: [], myListings: [] }),
    { setState: vi.fn(), getState: () => ({ listings: [], myListings: [] }) },
  ),
}));
vi.mock('../../../../store/useEphemeralListingsStore', () => ({
  useEphemeralListingsStore: Object.assign(
    (sel: (s: { ephemeralListings: unknown[] }) => unknown) => sel({ ephemeralListings: [] }),
    { setState: vi.fn(), getState: () => ({ ephemeralListings: [] }) },
  ),
}));
vi.mock('../../workspace/MannerNoticeDialog', () => ({
  MannerNoticeDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="manner-dialog-stub" /> : null,
}));

function resetMocks() {
  navigate.mockClear();
  openLogin.mockClear();
  openAccount.mockClear();
  mockUser = null;
  mockProfileAvatarUrl = null;
  mockUnreadCount = 0;
}

describe('HousingRegisterFab', () => {
  beforeEach(resetMocks);

  it('未ログインならログイン誘導(fromRegister)し、navigate は呼ばない', () => {
    render(
      <MemoryRouter>
        <HousingRegisterFab />
      </MemoryRouter>,
    );
    screen.getByRole('button').click();
    expect(openLogin).toHaveBeenCalledWith({ fromRegister: true });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ログイン済みなら登録ページへ navigate し、openLogin は呼ばない', () => {
    mockUser = { uid: 'test-uid' };
    render(
      <MemoryRouter>
        <HousingRegisterFab />
      </MemoryRouter>,
    );
    screen.getByRole('button').click();
    expect(navigate).toHaveBeenCalledWith('/housing/register');
    expect(openLogin).not.toHaveBeenCalled();
  });
});

describe('HousingBottomNav', () => {
  beforeEach(resetMocks);

  function renderNav() {
    return render(
      <MemoryRouter initialEntries={['/housing']}>
        <HousingBottomNav onOpenSettings={vi.fn()} />
      </MemoryRouter>,
    );
  }

  it('5項目 (トップ/お気に入り/ツアー/設定/ログイン) を描画する', () => {
    renderNav();
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('未ログイン時、ログイン項目クリックで openLogin が呼ばれる (openAccount は呼ばれない)', () => {
    renderNav();
    // items 順: home, favorites, tour, settings, login
    screen.getAllByRole('button')[4].click();
    expect(openLogin).toHaveBeenCalled();
    expect(openAccount).not.toHaveBeenCalled();
  });

  it('「トップ」タップで /housing へ navigate する (実機FB第2弾#2: 左端はフィルターでなくトップ)', () => {
    render(
      <MemoryRouter initialEntries={['/housing/favorites']}>
        <HousingBottomNav onOpenSettings={vi.fn()} />
      </MemoryRouter>,
    );
    screen.getAllByRole('button')[0].click();
    expect(navigate).toHaveBeenCalledWith('/housing');
  });

  it('お気に入りページで「お気に入り」を再タップすると探す(/housing)へ戻る (実機FB#2)', () => {
    render(
      <MemoryRouter initialEntries={['/housing/favorites']}>
        <HousingBottomNav onOpenSettings={vi.fn()} />
      </MemoryRouter>,
    );
    screen.getAllByRole('button')[1].click();
    expect(navigate).toHaveBeenCalledWith('/housing');
  });

  it('探すページで「ツアー」をタップするとツアーページへ行く (トグルの順方向)', () => {
    renderNav();
    screen.getAllByRole('button')[2].click();
    expect(navigate).toHaveBeenCalledWith('/housing/tour');
  });

  it('ログイン中 & 未読通知ありならログイン項目にバッジを描画する', () => {
    mockUser = { uid: 'test-uid' };
    mockUnreadCount = 2;
    const { container } = renderNav();
    expect(container.querySelector('.housing-bottomnav-badge')).toBeInTheDocument();
  });

  it('未ログインなら未読があってもバッジを描画しない', () => {
    mockUnreadCount = 3;
    const { container } = renderNav();
    expect(container.querySelector('.housing-bottomnav-badge')).not.toBeInTheDocument();
  });

  // 実機FB⑧: ログイン項目のアイコンが常に汎用 User アイコンのままで、ログイン中でも
  // 「未ログイン」に見えるバグの回帰テスト。
  it('未ログイン時は汎用アイコンのみでアバターは描画しない', () => {
    const { container } = renderNav();
    expect(container.querySelector('.housing-bottomnav-avatar')).not.toBeInTheDocument();
  });

  it('ログイン中かつ avatarUrl 未設定なら頭文字絵文字アバターを描画する', () => {
    mockUser = { uid: 'test-uid' };
    const { container } = renderNav();
    const avatar = container.querySelector('.housing-bottomnav-avatar');
    expect(avatar).toBeInTheDocument();
    expect(avatar?.tagName).toBe('SPAN');
  });

  it('ログイン中かつ avatarUrl 設定済みなら顔写真アバターを描画する', () => {
    mockUser = { uid: 'test-uid' };
    mockProfileAvatarUrl = 'https://example.com/avatar.png';
    const { container } = renderNav();
    const avatar = container.querySelector('.housing-bottomnav-avatar');
    expect(avatar?.tagName).toBe('IMG');
    expect(avatar?.getAttribute('src')).toBe('https://example.com/avatar.png');
  });
});

describe('MobileTourTrayBar (実機FB#10)', () => {
  beforeEach(() => {
    resetMocks();
    useTourTrayStore.getState().clear();
  });

  function renderBar() {
    return render(
      <MemoryRouter initialEntries={['/housing']}>
        <MobileTourTrayBar />
      </MemoryRouter>,
    );
  }

  it('トレイが空なら何も描画しない', () => {
    renderBar();
    expect(screen.queryByTestId('mobile-tour-tray-bar')).not.toBeInTheDocument();
  });

  it('トレイに積むと件数バーが出て、開始タップでマナー確認が開く', () => {
    useTourTrayStore.getState().setTrayIds(['a', 'b']);
    renderBar();
    const bar = screen.getByTestId('mobile-tour-tray-bar');
    expect(bar.querySelector('.housing-tour-traybar-count')?.textContent).toBe('2');
    // fireEvent = act ラップ済み (生 .click() では state 更新後の再描画が起きない)。
    fireEvent.click(screen.getByText('housing.mobile.tray_start'));
    expect(screen.getByTestId('manner-dialog-stub')).toBeInTheDocument();
  });

  it('クリアでトレイが空になりバーが消える', () => {
    useTourTrayStore.getState().setTrayIds(['a']);
    renderBar();
    fireEvent.click(screen.getByLabelText('housing.mobile.tray_clear'));
    expect(useTourTrayStore.getState().trayIds).toHaveLength(0);
    expect(screen.queryByTestId('mobile-tour-tray-bar')).not.toBeInTheDocument();
  });
});
