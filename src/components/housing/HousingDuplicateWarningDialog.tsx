import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DuplicateEntry } from '../../lib/housingApiClient';
import { getTagById } from '../../data/housingTags';

interface Props {
  duplicates: DuplicateEntry[];
  onCorrect: () => void;
  onProceed: () => void;
  onClose: () => void;
}

export const HousingDuplicateWarningDialog: React.FC<Props> = ({ duplicates, onCorrect, onProceed, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'var(--housing-detail-backdrop-bg)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="max-w-md w-full"
        style={{
          background: 'var(--housing-panel-bg)',
          border: '1px solid var(--housing-panel-border)',
          borderRadius: 'var(--housing-panel-radius)',
          color: 'var(--housing-text)',
          padding: 24,
        }}
      >
        <h2 style={{
          fontSize: 'var(--housing-text-lg)',
          fontWeight: 600,
          marginBottom: 12,
        }}>
          {t('housing.duplicate.title')}
        </h2>
        <p style={{
          fontSize: 'var(--housing-text-base)',
          color: 'var(--housing-text-dim)',
          marginBottom: 14,
        }}>
          {t('housing.duplicate.lead', { count: duplicates.length })}
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 14,
            maxHeight: 192,
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
                  borderRadius: 8,
                  padding: 12,
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
          marginBottom: 14,
        }}>
          {t('housing.duplicate.hint')}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCorrect}
            className="housing-action-btn housing-btn-primary"
            style={{ padding: '8px 16px' }}
          >
            {t('housing.duplicate.correct')}
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="housing-action-btn"
            style={{ padding: '8px 16px' }}
          >
            {t('housing.duplicate.proceed')}
          </button>
        </div>
      </div>
    </div>
  );
};
