/**
 * Phase 3: 物件通報モーダル
 *
 * - reason 選択 (radio) + 任意コメント (other は必須)
 * - 送信成功で toast + onClose、 重複・失敗は toast でフィードバック
 * - i18n キー: housing.report.*
 * - スタイルは housing.css の token 経由
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REPORT_REASONS, type ReportReason } from '../../../types/housing';
import { useHousingReport } from './useHousingReport';
import { showToast } from '../../Toast';

export interface HousingReportModalProps {
  open: boolean;
  listingId: string;
  onClose: () => void;
}

export const HousingReportModal: React.FC<HousingReportModalProps> = ({
  open,
  listingId,
  onClose,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason>('wrong_info');
  const [comment, setComment] = useState('');
  const { report, loading } = useHousingReport();

  if (!open) return null;

  const isOther = reason === 'other';
  const commentRequired = isOther;
  const canSubmit = !commentRequired || comment.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || loading) return;
    const res = await report(
      listingId,
      reason,
      isOther ? comment.trim() : undefined,
    );
    if (res.ok) {
      showToast(t('housing.report.success'), 'success');
      onClose();
    } else if (res.error === 'duplicate_report') {
      showToast(t('housing.report.duplicate'), 'info');
    } else {
      showToast(t('housing.report.error'), 'error');
    }
  };

  return (
    <div className="housing-modal-backdrop" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        className="housing-report-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="housing-report-title">
          {t('housing.report.modal.title')}
        </h2>
        <p className="housing-report-subtitle">
          {t('housing.report.modal.subtitle')}
        </p>
        <ul className="housing-report-reasons">
          {REPORT_REASONS.map((r) => (
            <li key={r}>
              <label>
                <input
                  type="radio"
                  name="housing-report-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {t(`housing.report.reason.${r}`)}
              </label>
            </li>
          ))}
        </ul>
        <textarea
          className="housing-report-comment"
          placeholder={
            commentRequired
              ? t('housing.report.comment.placeholder_required')
              : t('housing.report.comment.placeholder')
          }
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          maxLength={500}
          rows={3}
        />
        <div className="housing-report-actions">
          <button type="button" onClick={onClose} disabled={loading}>
            {t('housing.report.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || loading}
            className="housing-btn-primary"
          >
            {t('housing.report.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};
