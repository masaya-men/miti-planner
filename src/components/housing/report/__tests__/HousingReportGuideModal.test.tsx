// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HousingReportGuideModal } from '../HousingReportGuideModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'housing.guide.title': 'あなたの物件に報告がありました',
        'housing.guide.reason_label': '理由',
        'housing.guide.body.wrong_info': '内容を確認してください',
        'housing.guide.body.sold': '売却済みなら削除してください',
        'housing.guide.body.griefing': 'Discord で異議申し立て可能',
        'housing.guide.body.nsfw': '運営が確認します',
        'housing.guide.body.other': '報告者からのコメント',
        'housing.guide.cta.edit': '編集する',
        'housing.guide.cta.delete': '物件を削除する',
        'housing.guide.cta.dispute': 'Discord で異議申し立て',
        'housing.guide.later': 'あとで',
        'housing.report.reason.wrong_info': '位置や情報が違う',
        'housing.report.reason.sold': '売却済み',
        'housing.report.reason.griefing': '嫌がらせ',
        'housing.report.reason.nsfw': '不適切',
        'housing.report.reason.other': 'その他',
      };
      return map[key] ?? key;
    },
  }),
}));

const noop = () => {};

describe('HousingReportGuideModal', () => {
  it('open=false なら何も描画しない', () => {
    const { container } = render(
      <HousingReportGuideModal
        open={false}
        reason="wrong_info"
        onEdit={noop}
        onDelete={noop}
        onDispute={noop}
        onLater={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('reason=wrong_info で「編集する」 CTA が表示される', () => {
    render(
      <HousingReportGuideModal
        open={true}
        reason="wrong_info"
        onEdit={noop}
        onDelete={noop}
        onDispute={noop}
        onLater={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /編集する/ })).toBeInTheDocument();
  });

  it('reason=sold で「物件を削除する」 CTA が表示される', () => {
    render(
      <HousingReportGuideModal
        open={true}
        reason="sold"
        onEdit={noop}
        onDelete={noop}
        onDispute={noop}
        onLater={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /物件を削除する/ })).toBeInTheDocument();
  });

  it('reason=griefing で「Discord で異議申し立て」 CTA が表示される', () => {
    render(
      <HousingReportGuideModal
        open={true}
        reason="griefing"
        onEdit={noop}
        onDelete={noop}
        onDispute={noop}
        onLater={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /Discord/ })).toBeInTheDocument();
  });

  it('reason=other で comment が表示される', () => {
    render(
      <HousingReportGuideModal
        open={true}
        reason="other"
        comment="窓の位置が間違ってます"
        onEdit={noop}
        onDelete={noop}
        onDispute={noop}
        onLater={noop}
      />,
    );
    expect(screen.getByText(/窓の位置が間違ってます/)).toBeInTheDocument();
  });
});
