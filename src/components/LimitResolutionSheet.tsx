// 共有取り込みで「コンテンツあたり / 全体上限」 に達したときに重ねて開く
// ボトムシート。 ShareImportSheet (z=99991) の上に重ねるため z=99993。
//
// 仕様変更点 (Phase B-1.5 polish #4 #5 #7):
// - reason: 'max_per_content' | 'max_total' で表示モードを分岐
// - レイアウトを ShareImportSheet と同一 (左狭リスト + 右広 preview)、
//   mobile も preview 表示 (hidden md:block 撤去)
// - 削除進捗の 3 段テキストを廃止 → SweepOverlay (red) + ✓ ドロップイン + カード退場
// - spring 値を MitigationSheet と統一 (stiffness: 300, damping: 28)
// - motion.div に layout prop で内容拡張時の高さアニメ滑らか化
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { usePlanStore } from '../store/usePlanStore';
import { useAuthStore } from '../store/useAuthStore';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import { SharePlanCard } from './SharePlanCard';
import { executePlanDeletions } from '../lib/executePlanDeletions';
import { PLAN_LIMITS } from '../types/firebase';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import type { DeleteProgressEvent } from '../lib/shareImportTypes';
import type { SavedPlan } from '../types';

const DELETE_STAGES: DeleteProgressEvent['stage'][] = [
    'local_delete',
    'server_delete',
    'capacity_freed',
];

function resolveSweepStatus(
    events: DeleteProgressEvent[],
    isDeleting: boolean,
): { sweepStatus: 'idle' | 'active' | 'success' | 'failed'; isExiting: boolean } {
    // 一覧 stage の最終状態から sweep status を決める。
    // - 削除開始前: idle
    // - 削除中で capacity_freed 未到達: active (sweep 走行)
    // - capacity_freed success: success → カード退場開始
    // - いずれかが failed: failed (赤 sweep 100% 維持、 退場しない)
    if (events.length === 0) return { sweepStatus: isDeleting ? 'active' : 'idle', isExiting: false };
    const failed = events.find(e => e.status === 'failed');
    if (failed) return { sweepStatus: 'failed', isExiting: false };
    const capacityFreed = events.find(e => e.stage === 'capacity_freed' && e.status === 'success');
    if (capacityFreed) return { sweepStatus: 'success', isExiting: true };
    return { sweepStatus: 'active', isExiting: false };
}

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

    // reason に応じてリストを切り替え (#7)。
    // - max_per_content: 同じ contentId のプランだけ
    // - max_total: 全コンテンツ横断 (削除候補を全プランから選ばせる)
    // 並び順は最終更新が古い順 (削除候補が見つけやすい)。
    const targetPlans = useMemo<SavedPlan[]>(() => {
        if (!limitContext) return [];
        const all = plans.slice().sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
        if (limitContext.reason === 'max_total') return all;
        return all.filter(p => p.contentId === limitContext.contentId);
    }, [plans, limitContext]);

    if (!limitContext) return null;

    const activePlan: SavedPlan | undefined =
        targetPlans.find(p => p.id === activeId) ?? targetPlans[0];

    // contentId をユーザーフレンドリーなコンテンツ名に解決 (per_content モード時のヘッダ用)。
    // テスト環境では i18n オブジェクトが渡らない場合があるので optional chaining + デフォルト 'en'。
    const langSrc = i18n?.language ?? 'en';
    const lang = langSrc.startsWith('ja')
        ? 'ja'
        : langSrc.startsWith('zh')
            ? 'zh'
            : langSrc.startsWith('ko')
                ? 'ko'
                : 'en';
    // max_total モード時は contentId が null なので contentName は空文字 (header で使わない)。
    const contentName = limitContext.contentId
        ? (getContentById(limitContext.contentId)?.name?.[lang]
            ?? getContentById(limitContext.contentId)?.name?.en
            ?? limitContext.contentId)
        : '';

    const maxPerContent = PLAN_LIMITS.MAX_PLANS_PER_CONTENT;
    const maxTotal = PLAN_LIMITS.MAX_TOTAL_PLANS;

    // ヘッダーのタイトル: reason に応じて分岐。
    const titleText = limitContext.reason === 'max_total'
        ? t('limit_resolution.title_total', {
              current: targetPlans.length,
              max: maxTotal,
          })
        : t('limit_resolution.title_per_content', {
              contentName,
              current: targetPlans.length,
              max: maxPerContent,
          });

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
            // executePlanDeletions の contentId 引数は Firestore deleteFromFirestore の
            // サブコレクションパス解決にだけ使われる (server_delete 経路のみ)。 max_total 時は
            // contentId が null だが、 各プランの deleteFromFirestore は plan.contentId を
            // 内部的に解決するため、 ここで渡す値はゲスト (uid なし) 経路で使われない。
            // 安全のため、 max_total 時は空文字 fallback ('') を渡す。
            await executePlanDeletions(
                Array.from(checkedIds),
                authUser?.uid ?? null,
                limitContext.contentId ?? '',
                setDeleteProgress,
            );
            // 全件成功 → 取り込みフローを再開
            limitContext.resolve('resolved');
            setLimitContext(null);
        } catch {
            // 部分失敗時: 既に削除済みの ID を checkedIds から除いてリトライ可能にする。
            const currentPlanIds = new Set(usePlanStore.getState().plans.map(p => p.id));
            setCheckedIds(prev => {
                const next = new Set<string>();
                prev.forEach(id => {
                    if (currentPlanIds.has(id)) next.add(id);
                });
                return next;
            });
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
                layout
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 28,
                    layout: { type: 'spring', stiffness: 300, damping: 28 },
                }}
            >
                {/* Header: タイトル + 説明 */}
                <div className="px-5 pt-5 pb-3 shrink-0 border-b border-app-border">
                    <h2
                        id="limit-resolution-title"
                        className="text-app-2xl font-black text-app-text tracking-wide"
                    >
                        {titleText}
                    </h2>
                    <p className="text-app-md text-app-text-muted mt-1">
                        {t('limit_resolution.body', { count: limitContext.neededCount })}
                    </p>
                </div>

                {/* Body: ShareImportSheet と同一レイアウト (左狭リスト + 右広 preview)。
                    mobile (hidden md:block) を撤去、 全環境で flex-row。 */}
                <div className="flex-1 overflow-hidden flex flex-row min-h-0">
                    {/* リスト */}
                    <div className="flex-shrink-0 w-[140px] md:w-[200px] border-r border-app-border p-2 overflow-y-auto bg-app-surface2/30 flex flex-col gap-2">
                        <LayoutGroup>
                            <AnimatePresence>
                                {targetPlans.map(plan => {
                                    const checked = checkedIds.has(plan.id);
                                    // この plan に対応する 3 ステージ (local_delete / server_delete / capacity_freed) のイベント
                                    const events: DeleteProgressEvent[] = DELETE_STAGES
                                        .map(stage => deleteProgressMap.get(`${plan.id}:${stage}`))
                                        .filter((e): e is DeleteProgressEvent => !!e);
                                    const { sweepStatus, isExiting } = resolveSweepStatus(
                                        events,
                                        isDeleting && checked,
                                    );
                                    const contentDef = plan.contentId ? getContentById(plan.contentId) : null;
                                    const contentLabel = contentDef
                                        ? getPhaseName(contentDef.name, lang)
                                        : '';
                                    return (
                                        <SharePlanCard
                                            key={plan.id}
                                            title={contentLabel || plan.title}
                                            subtitle={contentLabel ? plan.title : undefined}
                                            isActive={activePlan?.id === plan.id}
                                            showCheckbox={true}
                                            isChecked={checked}
                                            onToggleCheck={() => handleToggleCheck(plan.id)}
                                            onClickRow={() => setActiveId(plan.id)}
                                            sweepStatus={isDeleting && checked ? sweepStatus : undefined}
                                            sweepColor="red"
                                            isExiting={isExiting}
                                        />
                                    );
                                })}
                            </AnimatePresence>
                        </LayoutGroup>
                    </div>

                    {/* プレビュー (mobile も表示)。 hidden md:block を撤去 */}
                    <div className="flex-1 min-w-0 overflow-y-auto border-l border-app-border bg-app-surface2/30">
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
                                    : t('limit_resolution.button_delete_and_resume', { count: checkedCount })
                            }
                            className="px-4 py-1.5 rounded-md font-semibold text-white bg-app-red hover:bg-app-red-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {checkedCount === 0
                                ? t('limit_resolution.button_delete_and_resume_disabled')
                                : t('limit_resolution.button_delete_and_resume', { count: checkedCount })}
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
}
