import { hpx } from '../../lib/housing/housingScale';
import { useTranslation } from 'react-i18next';
import type { DuplicateEntry } from '../../lib/housingApiClient';
import { getTagById } from '../../data/housingTags';
import { HousingDialogShell } from './HousingDialogShell';

interface Props {
  duplicates: DuplicateEntry[];
  onCorrect: () => void;
  onProceed: () => void;
  onClose: () => void;
}

export const HousingDuplicateWarningDialog: React.FC<Props> = ({ duplicates, onCorrect, onProceed, onClose }) => {
  const { t } = useTranslation();

  return (
    <HousingDialogShell
      onClose={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: 'var(--housing-detail-backdrop-bg)', padding: hpx(16) }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('housing.duplicate.title')}
        className="w-full"
        style={{
          maxWidth: hpx(448),
          background: 'var(--housing-panel-bg)',
          border: '1px solid var(--housing-panel-border)',
          borderRadius: 'var(--housing-panel-radius)',
          color: 'var(--housing-text)',
          padding: hpx(24),
        }}
      >
        <h2 style={{
          fontSize: 'var(--housing-text-lg)',
          fontWeight: 600,
          marginBottom: hpx(12),
        }}>
          {t('housing.duplicate.title')}
        </h2>
        <p style={{
          fontSize: 'var(--housing-text-base)',
          color: 'var(--housing-text-dim)',
          marginBottom: hpx(14),
        }}>
          {t('housing.duplicate.lead', { count: duplicates.length })}
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: hpx(8),
            marginBottom: hpx(14),
            maxHeight: hpx(192),
            overflowY: 'auto',
          }}
        >
          {duplicates.map((d) => {
            // 個人タグ (personal_<hex>) は i18n キーが無く t() で生キーが露出するため、
            // 静的タグ (getTagById で引ける公式/季節/テーマ) だけに絞って表示する
            // (詳細は RegisterDuplicatePanel と同じ判断)。
            const staticTags = d.tags.filter((tag) => getTagById(tag));
            return (
              <div
                key={d.id}
                style={{
                  background: 'var(--housing-chip-bg)',
                  border: '1px solid var(--housing-panel-border)',
                  borderRadius: hpx(8),
                  padding: hpx(12),
                }}
              >
                <p style={{ fontSize: 'var(--housing-text-sm)' }}>
                  {t('housing.duplicate.created_at', {
                    date: new Date(d.createdAt).toLocaleDateString(),
                  })}
                </p>
                {staticTags.length > 0 && (
                  <p style={{
                    fontSize: 'var(--housing-text-sm)',
                    color: 'var(--housing-text-dim)',
                  }}>
                    {staticTags.slice(0, 3).map((tag) => t(`housing.tag.${tag}`)).join(' / ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p style={{
          fontSize: 'var(--housing-text-sm)',
          color: 'var(--housing-text-dim)',
          marginBottom: hpx(14),
        }}>
          {t('housing.duplicate.hint')}
        </p>
        <div style={{ display: 'flex', gap: hpx(8), justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCorrect}
            className="housing-action-btn housing-btn-primary"
            style={{ padding: `${hpx(8)} ${hpx(16)}` }}
          >
            {t('housing.duplicate.correct')}
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="housing-action-btn"
            style={{ padding: `${hpx(8)} ${hpx(16)}` }}
          >
            {t('housing.duplicate.proceed')}
          </button>
        </div>
      </div>
    </HousingDialogShell>
  );
};
