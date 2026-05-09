// 共有取り込みで「コンテンツあたり / 全体上限」 に達したときに重ねて開く
// ボトムシート。ユーザーが既存プランを 1 件以上削除して上限を解消すると、
// limitContext.resolve('resolved') を呼んで共有取り込みフローを再開する。
//
// 既存の ShareImportSheet (z-index 99991) の上に重ねるため z-index 99993 を使用。
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { usePlanStore } from '../store/usePlanStore';
import { useAuthStore } from '../store/useAuthStore';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import { SharePlanCard } from './SharePlanCard';
import { executePlanDeletions } from '../lib/executePlanDeletions';
import { PLAN_LIMITS } from '../types/firebase';
import { getContentById } from '../data/contentRegistry';
import type { DeleteProgressEvent } from '../lib/shareImportTypes';
import type { SavedPlan } from '../types';

// 削除進捗 (3 ステージ) の i18n キー解決。
// 仕様: ja.json の `limit_resolution.delete_progress_*` / `delete_capacity_freed` / `delete_failed`
function deleteStageI18n(
    stage: DeleteProgressEvent['stage'],
    status: DeleteProgressEvent['status'],
): string {
    if (status === 'failed') return 'limit_resolution.delete_failed';
    if (stage === 'local_delete') {
        return status === 'success'
            ? 'limit_resolution.delete_progress_local_ok'
            : 'limit_resolution.delete_progress_local';
    }
    if (stage === 'server_delete') {
        return status === 'success'
            ? 'limit_resolution.delete_progress_server_ok'
            : 'limit_resolution.delete_progress_server';
    }
    // capacity_freed
    return 'limit_resolution.delete_capacity_freed';
}

function deleteStageIcon(status: DeleteProgressEvent['status']): string {
    switch (status) {
        case 'success':
            return '✓';
        case 'failed':
            return '⚠';
        case 'in_progress':
            return '⚪';
        case 'skipped':
            return '–';
        case 'cancelled':
            return '×';
        default:
            return '○';
    }
}

function deleteStageIconClass(status: DeleteProgressEvent['status']): string {
    switch (status) {
        case 'success':
            return 'text-app-blue';
        case 'failed':
            return 'text-app-red';
        case 'in_progress':
            return 'text-app-blue animate-pulse';
        default:
            return 'text-app-text-muted';
    }
}

const DELETE_STAGES: DeleteProgressEvent['stage'][] = [
    'local_delete',
    'server_delete',
    'capacity_freed',
];

export function LimitResolutionSheet() {
    const { t, i18n } = useTranslation();
    const limitContext = useShareImportFlow(s => s.limitContext);
    const deleteProgressMap = useShareImportFlow(s => s.deleteProgressMap);
    const setDeleteProgress = useShareImportFlow(s => s.setDeleteProgress);
    const setLimitContext = useShareImportFlow(s => s.setLimitContext);
    const plans = usePlanStore(s => s.plans);
    const authUser = useAuthStore(s => s.user);

    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // 同コンテンツの自分のプランを「最終更新が古い順」で並べる。
    // 仕様: 「最後に開いた日 古い順 = 削除候補が見つけやすい」 (writing-plans 参照)
    const targetPlans = useMemo<SavedPlan[]>(() => {
        if (!limitContext) return [];
        return plans
            .filter(p => p.contentId === limitContext.contentId)
            .slice()
            .sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
    }, [plans, limitContext]);

    if (!limitContext) return null;

    const activePlan: SavedPlan | undefined =
        targetPlans.find(p => p.id === activeId) ?? targetPlans[0];

    // contentId をユーザーフレンドリーなコンテンツ名に解決 (見つからなければ raw id)。
    // テスト環境では i18n オブジェクトが渡らない場合があるので optional chaining + デフォルト 'en'。
    const langSrc = i18n?.language ?? 'en';
    const lang = langSrc.startsWith('ja')
        ? 'ja'
        : langSrc.startsWith('zh')
            ? 'zh'
            : langSrc.startsWith('ko')
                ? 'ko'
                : 'en';
    const contentDef = getContentById(limitContext.contentId);
    const contentName =
        contentDef?.name?.[lang] ?? contentDef?.name?.en ?? limitContext.contentId;

    // 上限値とカレント件数 (ヘッダ表示用)。
    const maxPerContent = PLAN_LIMITS.MAX_PLANS_PER_CONTENT;
    const currentCount = targetPlans.length;

    const handleToggleCheck = (id: string) => {
        // 削除中はチェック切り替え不可 (誤操作防止)。
        if (isDeleting) return;
        // immutable に Set を作り直して、 React/zustand の購読が確実に発火するようにする。
        const next = new Set(checkedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCheckedIds(next);
    };

    const handleCancel = () => {
        if (isDeleting) return;
        limitContext.resolve('cancelled');
        setLimitContext(null);
    };

    const handleDelete = async () => {
        if (checkedIds.size === 0 || isDeleting) return;
        setIsDeleting(true);
        try {
            await executePlanDeletions(
                Array.from(checkedIds),
                authUser?.uid ?? null,
                limitContext.contentId,
                setDeleteProgress,
            );
            // 全件成功 → 取り込みフローを再開
            limitContext.resolve('resolved');
            setLimitContext(null);
        } catch {
            // 1 件でも失敗したらシートに留まる (ユーザーに再試行 / キャンセルを選ばせる)
            setIsDeleting(false);
        }
    };

    const checkedCount = checkedIds.size;

    return createPortal(
        <AnimatePresence>
            {/* Backdrop: ShareImportSheet (z=99991) の上、シート本体 (z=99993) の下 */}
            <motion.div
                key="limit-resolution-backdrop"
                className="fixed inset-0 z-[99992] bg-black/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCancel}
            />
            <motion.div
                key="limit-resolution-sheet"
                data-testid="limit-resolution-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="limit-resolution-title"
                className="glass-tier3 fixed bottom-0 left-0 right-0 z-[99993] rounded-t-2xl rounded-b-none flex flex-col max-h-[90vh] border-t border-app-red/30"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30 }}
            >
                {/* Header: タイトル + 説明 */}
                <div className="px-5 pt-5 pb-3 shrink-0 border-b border-app-border">
                    <h2
                        id="limit-resolution-title"
                        className="text-app-2xl font-black text-app-text tracking-wide"
                    >
                        {t('limit_resolution.title_per_content', {
                            contentName,
                            current: currentCount,
                            max: maxPerContent,
                        })}
                    </h2>
                    <p className="text-app-md text-app-text-muted mt-1">
                        {t('limit_resolution.body', { count: limitContext.neededCount })}
                    </p>
                </div>

                {/* Body: 既存プラン一覧 (左) + プレビュー (右、 PC 時のみ) */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                    {/* リスト */}
                    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 md:max-w-[55%]">
                        {targetPlans.map(plan => {
                            const checked = checkedIds.has(plan.id);
                            // この plan に対応する 3 ステージ (local_delete / server_delete / capacity_freed) のイベントを抽出
                            const events: DeleteProgressEvent[] = DELETE_STAGES
                                .map(stage => deleteProgressMap.get(`${plan.id}:${stage}`))
                                .filter((e): e is DeleteProgressEvent => !!e);
                            const hasEvents = events.length > 0;
                            return (
                                <SharePlanCard
                                    key={plan.id}
                                    title={plan.title}
                                    isActive={activePlan?.id === plan.id}
                                    showCheckbox={true}
                                    isChecked={checked}
                                    onToggleCheck={() => handleToggleCheck(plan.id)}
                                    onClickRow={() => setActiveId(plan.id)}
                                >
                                    {isDeleting && hasEvents && (
                                        <div
                                            role="status"
                                            aria-live="polite"
                                            className="flex flex-col gap-1 mt-2 text-app-sm"
                                        >
                                            {DELETE_STAGES.map(stage => {
                                                const evt = events.find(e => e.stage === stage);
                                                if (!evt) return null;
                                                const opts =
                                                    stage === 'capacity_freed'
                                                        ? { current: currentCount, max: maxPerContent }
                                                        : undefined;
                                                return (
                                                    <div
                                                        key={stage}
                                                        data-testid={`delete-stage-${stage}`}
                                                        data-status={evt.status}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <span
                                                            aria-hidden
                                                            className={deleteStageIconClass(evt.status)}
                                                        >
                                                            {deleteStageIcon(evt.status)}
                                                        </span>
                                                        <span className="text-app-text-sec">
                                                            {t(deleteStageI18n(stage, evt.status), opts)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </SharePlanCard>
                            );
                        })}
                    </div>

                    {/* プレビュー (PC 時のみ表示) */}
                    <div className="hidden md:block flex-1 min-w-0 overflow-y-auto border-l border-app-border bg-app-surface2/30">
                        <MitigationSheetPreview
                            planData={activePlan?.data ?? null}
                            loading={false}
                        />
                    </div>
                </div>

                {/* Footer: キャンセル + 削除して再開 */}
                <div className="px-5 py-3 shrink-0 border-t border-app-border flex items-center justify-between gap-3 bg-app-surface/40">
                    <span className="text-app-sm text-app-text-muted">
                        {t('limit_resolution.selection_count', { count: checkedCount })}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isDeleting}
                            aria-label={t('limit_resolution.button_cancel')}
                            className="px-4 py-1.5 rounded-md text-app-text border border-app-border hover:bg-app-surface2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {t('limit_resolution.button_cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={checkedCount === 0 || isDeleting}
                            aria-label={
                                checkedCount === 0
                                    ? t('limit_resolution.button_delete_and_resume_disabled')
                                    : t('limit_resolution.button_delete_and_resume', {
                                        count: checkedCount,
                                    })
                            }
                            className="px-4 py-1.5 rounded-md font-semibold text-white bg-app-red hover:bg-app-red-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {checkedCount === 0
                                ? t('limit_resolution.button_delete_and_resume_disabled')
                                : t('limit_resolution.button_delete_and_resume', {
                                    count: checkedCount,
                                })}
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
}
