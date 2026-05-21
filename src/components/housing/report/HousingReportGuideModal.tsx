/**
 * Phase 3: 通報通知を受けた家主向けガイドモーダル
 *
 * - 通報の reason に応じて CTA を変える:
 *   - wrong_info → 編集を促す
 *   - sold       → 削除を促す (danger 配色)
 *   - griefing / nsfw → Discord で異議申し立て
 *   - other      → 3 つ並列 (edit / delete / dispute)
 * - 「あとで」 で閉じる (= read だけ立てて何もしない)
 * - スタイルは housing.css の token 経由
 */
import { useTranslation } from 'react-i18next';
import type { ReportReason } from '../../../types/housing';

export interface HousingReportGuideModalProps {
  open: boolean;
  reason: ReportReason;
  comment?: string;
  onEdit: () => void;
  onDelete: () => void;
  onDispute: () => void;
  onLater: () => void;
}

export const HousingReportGuideModal: React.FC<HousingReportGuideModalProps> = ({
  open,
  reason,
  comment,
  onEdit,
  onDelete,
  onDispute,
  onLater,
}) => {
  const { t } = useTranslation();
  if (!open) return null;

  const body = t(`housing.guide.body.${reason}`);
  const reasonLabel = t(`housing.report.reason.${reason}`);

  // reason 別 primary CTA (other は 3 並列なので primary は null のまま)
  let primaryCta: { label: string; onClick: () => void; tone?: 'danger' } | null = null;
  if (reason === 'wrong_info') {
    primaryCta = { label: t('housing.guide.cta.edit'), onClick: onEdit };
  } else if (reason === 'sold') {
    primaryCta = {
      label: t('housing.guide.cta.delete'),
      onClick: onDelete,
      tone: 'danger',
    };
  } else if (reason === 'griefing' || reason === 'nsfw') {
    primaryCta = { label: t('housing.guide.cta.dispute'), onClick: onDispute };
  }

  return (
    <div className="housing-modal-backdrop" onClick={onLater} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        className="housing-guide-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="housing-guide-title">{t('housing.guide.title')}</h2>
        <p className="housing-guide-reason">
          {t('housing.guide.reason_label')}: <strong>{reasonLabel}</strong>
        </p>
        <p className="housing-guide-body">{body}</p>
        {reason === 'other' && comment && (
          <blockquote className="housing-guide-comment">{comment}</blockquote>
        )}

        <div className="housing-guide-actions">
          <button type="button" onClick={onLater}>
            {t('housing.guide.later')}
          </button>
          {reason === 'other' ? (
            <>
              <button type="button" onClick={onEdit}>
                {t('housing.guide.cta.edit')}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="housing-btn-danger"
              >
                {t('housing.guide.cta.delete')}
              </button>
              <button type="button" onClick={onDispute}>
                {t('housing.guide.cta.dispute')}
              </button>
            </>
          ) : primaryCta ? (
            <button
              type="button"
              onClick={primaryCta.onClick}
              className={
                primaryCta.tone === 'danger'
                  ? 'housing-btn-danger'
                  : 'housing-btn-primary'
              }
            >
              {primaryCta.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
