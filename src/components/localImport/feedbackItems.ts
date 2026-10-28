import type { TFunction } from 'i18next';
import type { ParsedPlanLimit } from '../../utils/planLimitError';

export interface ErrorSummary {
    maxTotal: ParsedPlanLimit | null;
    maxPerContent: ParsedPlanLimit | null;
    hasOtherFailure: boolean;
}

/** done 時のフィードバック箱の項目を error 集計から組み立てる */
export const buildFeedbackItems = (
    summaryKind: 'success' | 'partial' | 'failed' | null,
    errorSummary: ErrorSummary,
    retryLabel: string,
    t: TFunction,
): string[] => {
    if (!summaryKind || summaryKind === 'success') return [];
    const items: string[] = [];
    // PLAN_LIMIT 系 (該当があれば必ず筆頭で出す)
    if (errorSummary.maxTotal) {
        items.push(t('local_import.feedback_max_total', {
            max: errorSummary.maxTotal.max,
            retry: retryLabel,
        }));
    }
    if (errorSummary.maxPerContent) {
        items.push(t('local_import.feedback_max_per_content', {
            max: errorSummary.maxPerContent.max,
            retry: retryLabel,
        }));
    }
    // PLAN_LIMIT 以外の失敗があれば network → relogin (全失敗時のみ) → wait の汎用
    if (errorSummary.hasOtherFailure) {
        items.push(t('local_import.feedback_network', { retry: retryLabel }));
        if (summaryKind === 'failed') {
            items.push(t('local_import.feedback_relogin', { retry: retryLabel }));
        }
    }
    // 必ず最後に「時間を置く」
    items.push(t('local_import.feedback_wait', { retry: retryLabel }));
    return items;
};
