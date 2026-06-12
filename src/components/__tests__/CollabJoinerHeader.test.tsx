// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollabJoinerHeader } from '../CollabJoinerHeader';

// --- モジュールモック ---
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));
vi.mock('../LanguageSwitcher', () => ({ LanguageSwitcher: () => <div data-testid="lang" /> }));
vi.mock('../collab/PresenceControls', () => ({ PresenceControls: () => <div data-testid="presence" /> }));
vi.mock('../../data/contentRegistry', () => ({
  getContentById: vi.fn(() => null),
}));

// テーマストア: dark デフォルト
vi.mock('../../store/useThemeStore', () => {
  const store = { theme: 'dark', contentLanguage: 'ja', setTheme: vi.fn() };
  return {
    useThemeStore: (sel: (s: typeof store) => unknown) => sel(store),
  };
});

// 認証ストア: 未ログイン
const authStore = {
  user: null as null | { uid: string },
  profileDisplayName: null as string | null,
  profileAvatarUrl: null as string | null,
};
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (sel: (s: typeof authStore) => unknown) => sel(authStore),
}));

// コラボセッション: contentId なし
const joinerStore = { contentId: null as string | null };
vi.mock('../../store/useCollabJoinerSession', () => ({
  useCollabJoinerSession: (sel: (s: typeof joinerStore) => unknown) => sel(joinerStore),
}));

describe('CollabJoinerHeader', () => {
  beforeEach(() => {
    authStore.user = null;
    authStore.profileDisplayName = null;
    authStore.profileAvatarUrl = null;
    joinerStore.contentId = null;
  });

  it('LoPo ブランドと言語切替・テーマ切替を表示する(plan store 非依存)', () => {
    render(<CollabJoinerHeader onOpenLogin={vi.fn()} />);
    expect(screen.getByText('LoPo')).toBeInTheDocument();
    expect(screen.getByTestId('lang')).toBeInTheDocument();
    expect(screen.getByLabelText('toggle-theme')).toBeInTheDocument();
  });

  it('未ログイン時はログインボタンを表示し、クリックで onOpenLogin を呼ぶ', () => {
    const onOpenLogin = vi.fn();
    render(<CollabJoinerHeader onOpenLogin={onOpenLogin} />);
    const loginBtn = screen.getByRole('button', { name: /login/i });
    fireEvent.click(loginBtn);
    expect(onOpenLogin).toHaveBeenCalledTimes(1);
  });

  it('ログイン済み時はアカウントボタンを表示し、クリックで onOpenLogin を呼ぶ', () => {
    authStore.user = { uid: 'test-uid' };
    authStore.profileDisplayName = 'TestUser';
    const onOpenLogin = vi.fn();
    render(<CollabJoinerHeader onOpenLogin={onOpenLogin} />);
    const accountBtn = screen.getByRole('button', { name: /account/i });
    fireEvent.click(accountBtn);
    expect(onOpenLogin).toHaveBeenCalledTimes(1);
  });

  it('contentId が null のときコンテンツ名は表示しない', () => {
    render(<CollabJoinerHeader onOpenLogin={vi.fn()} />);
    // "/" セパレータが存在しないこと
    expect(screen.queryByText('/')).not.toBeInTheDocument();
  });
});
