// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const markRead = vi.fn();
const state: { latestUnread: unknown } = { latestUnread: null };
vi.mock('../../../store/useSystemNotifications', () => ({
  useSystemNotifications: () => ({ items: [], unreadCount: 0, latestUnread: state.latestUnread, markRead }),
}));
vi.mock('../../SystemNotificationModal', () => ({
  SystemNotificationModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="modal"><button onClick={onClose}>close</button></div> : null,
}));
import { MilspecNotifBeacon } from '../MilspecNotifBeacon';
import { SB_NOTIF, sbY } from '../sidebarGeometry';

const notif = { id: 'n1', title: { ja: 'お知らせ', en: 'Notice' }, body: { ja: '本文' } };

beforeEach(() => { markRead.mockClear(); state.latestUnread = null; });

describe('MilspecNotifBeacon', () => {
  it('未読なしなら何も描画しない', () => {
    const { container } = render(<MilspecNotifBeacon H={679} />);
    expect(container.firstChild).toBeNull();
  });
  it('未読ありならボタンを描き、位置は箱の座標に追従する', () => {
    state.latestUnread = notif;
    const { container } = render(<MilspecNotifBeacon H={1080} />);
    const b = container.querySelector('button.milspec-notif') as HTMLButtonElement;
    expect(b).not.toBeNull();
    expect(b.style.top).toBe(`${sbY(SB_NOTIF.y, 1080)}px`);
    expect(b.title).toBe('お知らせ');
  });
  it('押すとモーダル、閉じると markRead', () => {
    state.latestUnread = notif;
    const { container, getByTestId, queryByTestId, getByText } = render(<MilspecNotifBeacon H={679} />);
    fireEvent.click(container.querySelector('button.milspec-notif')!);
    expect(getByTestId('modal')).not.toBeNull();
    fireEvent.click(getByText('close'));
    expect(markRead).toHaveBeenCalledWith('n1');
    expect(queryByTestId('modal')).toBeNull();
  });
});
