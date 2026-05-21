// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HousingReportModal } from '../HousingReportModal';

vi.mock('../useHousingReport', () => ({
  useHousingReport: () => ({
    report: vi.fn(async () => ({ ok: true })),
    loading: false,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      // 最小限のローカライズ (テスト用)
      const map: Record<string, string> = {
        'housing.report.modal.title': '報告',
        'housing.report.modal.subtitle': 'どの点が違いますか?',
        'housing.report.reason.wrong_info': '位置や情報が違う',
        'housing.report.reason.sold': '売却済み',
        'housing.report.reason.griefing': '嫌がらせ',
        'housing.report.reason.nsfw': '不適切',
        'housing.report.reason.other': 'その他',
        'housing.report.comment.placeholder': '詳細を教えてください (任意)',
        'housing.report.comment.placeholder_required': '詳細を教えてください (必須)',
        'housing.report.submit': '報告する',
        'housing.report.cancel': 'キャンセル',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('HousingReportModal', () => {
  it('open=false なら何も描画しない', () => {
    const { container } = render(
      <HousingReportModal open={false} listingId="lid1" onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('初期状態で wrong_info が選択されている', () => {
    render(<HousingReportModal open={true} listingId="lid1" onClose={() => {}} />);
    const radio = screen.getByLabelText(/位置や情報が違う/) as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it('other を選択するとコメント欄の placeholder が必須に変わる', () => {
    render(<HousingReportModal open={true} listingId="lid1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/その他/));
    expect(
      screen.getByPlaceholderText(/詳細を教えてください \(必須\)/),
    ).toBeInTheDocument();
  });

  it('other を選択 + コメント未入力なら送信ボタンが disabled', () => {
    render(<HousingReportModal open={true} listingId="lid1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/その他/));
    const submitBtn = screen.getByRole('button', { name: /報告する/ });
    expect(submitBtn).toBeDisabled();
  });
});
