// @vitest-environment happy-dom
/**
 * Task1 (モバイルシェル基盤) の要: HousingRegisterFab の未ログイン/ログイン済み分岐と、
 * HousingBottomNav の項目数/バッジ表示を検証する。フィルタ/設定シートは中身が
 * FilterPanel 等の重い既存パネルを丸ごと抱えるため、ここでは対象にしない
 * (npm run build の型検証 + 実機チェックリストに委ねる)。
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HousingBottomNav } from '../HousingBottomNav';
import { HousingRegisterFab } from '../HousingRegisterFab';

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
vi.mock('../../../../store/useAuthStore', () => ({
  useAuthStore: Object.assign(
    (sel: (s: { user: { uid: string } | null; profileAvatarUrl: string | null }) => unknown) =>
      sel({ user: mockUser, profileAvatarUrl: null }),
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

function resetMocks() {
  navigate.mockClear();
  openLogin.mockClear();
  openAccount.mockClear();
  mockUser = null;
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
        <HousingBottomNav onOpenFilter={vi.fn()} onOpenSettings={vi.fn()} />
      </MemoryRouter>,
    );
  }

  it('5項目 (フィルター/お気に入り/ツアー/設定/ログイン) を描画する', () => {
    renderNav();
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('未ログイン時、ログイン項目クリックで openLogin が呼ばれる (openAccount は呼ばれない)', () => {
    renderNav();
    // items 順: filter, favorites, tour, settings, login
    screen.getAllByRole('button')[4].click();
    expect(openLogin).toHaveBeenCalled();
    expect(openAccount).not.toHaveBeenCalled();
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
});
