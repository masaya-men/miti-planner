// @vitest-environment happy-dom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HousingerReportModal } from '../HousingerReportModal';

const mockReport = vi.fn(
  async (
    _housingerUid: string,
    _reason: string,
    _comment?: string,
  ): Promise<{ ok: boolean; error?: string }> => ({ ok: true }),
);
vi.mock('../useHousingerReport', () => ({
  useHousingerReport: () => ({
    report: mockReport,
    loading: false,
  }),
}));

const mockShowToast = vi.fn();
vi.mock('../../../Toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      // 最小限のローカライズ (テスト用)
      const map: Record<string, string> = {
        'housing.housinger.report.modal.title': 'このハウジンガーについて報告',
        'housing.housinger.report.modal.subtitle': 'どの点が問題ですか?',
        'housing.housinger.report.reason.inappropriate_name': '不適切な名前',
        'housing.housinger.report.reason.inappropriate_avatar': '不適切なアイコン',
        'housing.housinger.report.reason.impersonation': 'なりすまし',
        'housing.housinger.report.reason.other': 'その他',
        'housing.report.comment.placeholder': '詳細を教えてください (任意)',
        'housing.report.comment.placeholder_required': '詳細を教えてください (必須)',
        'housing.report.submit': '報告する',
        'housing.report.cancel': 'キャンセル',
        'housing.report.success': '報告を受け付けました。 ご協力ありがとうございます',
        'housing.report.duplicate': 'すでに同じ理由で報告済みです',
        'housing.report.error': '報告の送信に失敗しました。 時間をおいて再度お試しください',
      };
      return map[key] ?? key;
    },
  }),
}));

beforeEach(() => {
  mockReport.mockReset();
  mockReport.mockResolvedValue({ ok: true });
  mockShowToast.mockReset();
});

describe('HousingerReportModal', () => {
  it('open=false なら何も描画しない', () => {
    const { container } = render(
      <HousingerReportModal open={false} housingerUid="uid1" onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('初期状態で inappropriate_name (先頭の理由) が選択されている', () => {
    render(<HousingerReportModal open={true} housingerUid="uid1" onClose={() => {}} />);
    const radio = screen.getByLabelText('不適切な名前') as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it('other を選択するとコメント欄の placeholder が必須に変わり、送信ボタンが disabled になる', () => {
    render(<HousingerReportModal open={true} housingerUid="uid1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('その他'));
    expect(
      screen.getByPlaceholderText('詳細を教えてください (必須)'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '報告する' })).toBeDisabled();
  });

  it('送信すると report(housingerUid, reason, comment?) を呼び、成功トースト後に onClose する', async () => {
    const onClose = vi.fn();
    render(<HousingerReportModal open={true} housingerUid="uid-target" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '報告する' }));

    await waitFor(() => {
      expect(mockReport).toHaveBeenCalledWith('uid-target', 'inappropriate_name', undefined);
    });
    expect(mockShowToast).toHaveBeenCalledWith(
      '報告を受け付けました。 ご協力ありがとうございます',
      'success',
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('duplicate_report のときは info トーストを出し、onClose しない', async () => {
    mockReport.mockResolvedValueOnce({ ok: false, error: 'duplicate_report' });
    const onClose = vi.fn();
    render(<HousingerReportModal open={true} housingerUid="uid1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '報告する' }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('すでに同じ理由で報告済みです', 'info');
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
