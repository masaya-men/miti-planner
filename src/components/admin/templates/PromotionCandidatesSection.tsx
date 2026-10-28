/**
 * 管理画面テンプレート — 昇格候補セクション
 */
import { useTranslation } from 'react-i18next';
import type { PromotionCandidate } from './adminTemplateTypes';

interface PromotionCandidatesSectionProps {
  candidates: PromotionCandidate[];
  onPromotion: (candidate: PromotionCandidate, action: 'approve' | 'reject') => void;
}

export function PromotionCandidatesSection({ candidates, onPromotion }: PromotionCandidatesSectionProps) {
  const { t } = useTranslation();

  return (
      <div className="mt-8">
        <h2 className="text-app-2xl font-bold mb-3">{t('admin.promotion_candidates')}</h2>
        {candidates.length === 0 ? (
          <p className="text-app-lg text-app-text-muted">{t('admin.promotion_empty')}</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <div
                key={c.shareId}
                className="flex items-center gap-3 p-3 border border-app-text/10 rounded text-app-lg"
              >
                <span className="font-mono">{c.contentId}</span>
                <span className="flex-1 truncate">{c.title}</span>
                <span className="text-app-text-muted">
                  {t('admin.promotion_copy_count')}: {c.copyCount}
                </span>
                <button
                  onClick={() => onPromotion(c, 'approve')}
                  className="px-2 py-1 border border-app-text/30 rounded hover:bg-app-text/10 transition-colors"
                >
                  {t('admin.promotion_approve')}
                </button>
                <button
                  onClick={() => onPromotion(c, 'reject')}
                  className="px-2 py-1 border border-app-text/30 rounded hover:bg-app-text/10 transition-colors"
                >
                  {t('admin.promotion_reject')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}
