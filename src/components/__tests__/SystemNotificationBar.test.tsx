// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemNotificationBar } from '../SystemNotificationBar';
import * as hookModule from '../../store/useSystemNotifications';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));

const markRead = vi.fn();
const noUnread = () => ({ items: [], unreadCount: 0, latestUnread: null, markRead });
const oneUnread = () => ({
  items: [],
  unreadCount: 1,
  latestUnread: {
    id: 'n1',
    title: { ja: '更新です', en: 'Update' },
    body: { ja: '本文', en: 'body' },
    published: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  markRead,
});

describe('SystemNotificationBar', () => {
  beforeEach(() => {
    markRead.mockReset();
  });

  it('未読 0 のとき null を返し何も描画しない', () => {
    vi.spyOn(hookModule, 'useSystemNotifications').mockReturnValue(noUnread());
    const { container } = render(<SystemNotificationBar isCollapsed={false} />);
    expect(container.textContent).toBe('');
  });

  it('未読 1 件以上のとき ベルとマーキー (タイトル) を描画する', () => {
    vi.spyOn(hookModule, 'useSystemNotifications').mockReturnValue(oneUnread());
    render(<SystemNotificationBar isCollapsed={false} />);
    expect(screen.getByText(/更新です/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /system_notif.bar.aria_bell/i })).toBeTruthy();
  });

  it('collapsed=true のときマーキーは描画されない (ベルのみ)', () => {
    vi.spyOn(hookModule, 'useSystemNotifications').mockReturnValue(oneUnread());
    render(<SystemNotificationBar isCollapsed={true} />);
    expect(screen.queryByText(/更新です/)).toBeNull();
    expect(screen.getByRole('button', { name: /system_notif.bar.aria_bell/i })).toBeTruthy();
  });

  it('クリックでモーダルが開き、 閉じると markRead が呼ばれる', () => {
    vi.spyOn(hookModule, 'useSystemNotifications').mockReturnValue(oneUnread());
    render(<SystemNotificationBar isCollapsed={false} />);
    fireEvent.click(screen.getByRole('button', { name: /system_notif.bar.aria_bell/i }));
    // モーダルの「既読にする」 (= 閉じる) を押下
    fireEvent.click(screen.getByText('system_notif.modal.mark_read'));
    expect(markRead).toHaveBeenCalledWith('n1');
  });
});
