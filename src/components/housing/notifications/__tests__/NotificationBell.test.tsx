// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NotificationBell } from '../NotificationBell';

vi.mock('../useNotifications', () => ({
  useNotifications: () => ({
    items: [],
    loading: false,
    unreadCount: 3,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      if (key === 'housing.notifications.bell_aria') return '通知';
      if (key === 'housing.notifications.unread_badge_aria') return `${opts?.n} 件の未読`;
      return key;
    },
  }),
}));

describe('NotificationBell', () => {
  it('未読 3 件のバッジが表示される', () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('ベルボタンの aria-label が i18n キーから取れる', () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /通知/ })).toBeInTheDocument();
  });
});
