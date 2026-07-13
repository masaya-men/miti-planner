/**
 * Task 9: ハウジンガープロフィール通報モーダル (spec 2026-07-10-housinger-profile-design.md §6.2)
 *
 * - HousingReportModal.tsx:15-52 (物件通報モーダル) を踏襲した別モーダル。 対象は
 *   housingerUid (housing_profiles/{uid}/reports への通報、 listing 通報とは独立)。
 * - reason は Task1 の HOUSINGER_REPORT_REASONS (不適切な名前/不適切なアイコン/なりすまし/その他)
 *   を radio 列挙。 i18n キーは housing.housinger.report.reason.* (listing の housing.report.reason.*
 *   とは別ネームスペース)。
 * - 送信は POST action=report-housinger (useHousingerReport)。 成功/duplicate/error のトースト
 *   文言は listing 通報 (housing.report.success/duplicate/error) をそのまま流用する (brief 指定)。
 * - スタイルは housing.report.* と同じ housing.css クラス (.housing-modal-backdrop /
 *   .housing-report-modal 等) を再利用する (対象が違うだけで見た目は同一のため新規 CSS 不要)。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HOUSINGER_REPORT_REASONS, type HousingerReportReason } from '../../../lib/housing/housingerProfile';
import { useHousingerReport } from './useHousingerReport';
import { showToast } from '../../Toast';

export interface HousingerReportModalProps {
  open: boolean;
  housingerUid: string;
  onClose: () => void;
}

export const HousingerReportModal: React.FC<HousingerReportModalProps> = ({
  open,
  housingerUid,
  onClose,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState<HousingerReportReason>(HOUSINGER_REPORT_REASONS[0]);
  const [comment, setComment] = useState('');
  const { report, loading } = useHousingerReport();

  if (!open) return null;

  const isOther = reason === 'other';
  const commentRequired = isOther;
  const canSubmit = !commentRequired || comment.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || loading) return;
    const res = await report(
      housingerUid,
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
          {t('housing.housinger.report.modal.title')}
        </h2>
        <p className="housing-report-subtitle">
          {t('housing.housinger.report.modal.subtitle')}
        </p>
        <ul className="housing-report-reasons">
          {HOUSINGER_REPORT_REASONS.map((r) => (
            <li key={r}>
              <label>
                <input
                  type="radio"
                  name="housinger-report-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {t(`housing.housinger.report.reason.${r}`)}
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
