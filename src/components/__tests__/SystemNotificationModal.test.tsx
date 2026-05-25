// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemNotificationModal } from '../SystemNotificationModal';
import type { SystemNotification } from '../../types/systemNotification';
import { LOPO_X_URL, LOPO_DISCORD_URL } from '../../lib/systemNotifLinks';

// react-i18next: 'ja' 固定
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'ja' },
  }),
}));

const sample: SystemNotification = {
  id: 'n1',
  title: { ja: 'テンプレ更新', en: 'Template updated' },
  body: { ja: '最新版で軽減を引き継いで使えます', en: 'You can carry over mitigations' },
  published: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('SystemNotificationModal', () => {
  it('isOpen=false なら何も描画しない', () => {
    const { container } = render(
      <SystemNotificationModal isOpen={false} notif={sample} onClose={() => {}} />
    );
    expect(container.textContent).toBe('');
  });

  it('title と body を ja 表示し、 X/Discord リンクが正しい href を持つ', () => {
    render(<SystemNotificationModal isOpen={true} notif={sample} onClose={() => {}} />);
    expect(screen.getByText(/テンプレ更新/)).toBeTruthy();
    expect(screen.getByText('最新版で軽減を引き継いで使えます')).toBeTruthy();
    const links = screen.getAllByRole('link');
    const xLink = links.find((l) => l.getAttribute('href') === LOPO_X_URL);
    const discordLink = links.find((l) => l.getAttribute('href') === LOPO_DISCORD_URL);
    expect(xLink).toBeTruthy();
    expect(discordLink).toBeTruthy();
  });

  it('「既読にする」 ボタン押下で onClose が呼ばれる', () => {
    const onClose = vi.fn();
    render(<SystemNotificationModal isOpen={true} notif={sample} onClose={onClose} />);
    const readBtn = screen.getByText('system_notif.modal.mark_read');
    fireEvent.click(readBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
