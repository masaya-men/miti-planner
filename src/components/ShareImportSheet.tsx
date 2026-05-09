// 共有 URL を踏んだときに開くメインのボトムシート。
// 単一プランは preview + 取り込みボタン、 複数プランは左にチェックボックス付きリスト + 右にプレビュー。
// status === 'idle' のときは何も描画しない (StatusBar 等の上に居座らないため)。
//
// レイヤ構成:
//   - backdrop: z=99990
//   - sheet 本体: z=99991
//   - LimitResolutionSheet (Task 15) は内部で z=99992/99993 を使い、 本シートの上に重ねる。
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { useAuthStore } from '../store/useAuthStore';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import { ShareImportProgressIndicator } from './ShareImportProgressIndicator';
import { SharePlanCard } from './SharePlanCard';
import { executeShareImport } from '../lib/executeShareImport';
import { LimitResolutionSheet } from './LimitResolutionSheet';

// done 状態に遷移してからシートを閉じるまでの遅延 (ms)。
// ユーザーが「完了表示」 を視認する時間を確保するための定数。
const CLOSE_DELAY_AFTER_DONE_MS = 1200;

export function ShareImportSheet() {
    const { t } = useTranslation();
    // store からは個別フィールドだけ subscribe する (selector を細かく分ける = 再レンダ最小化)。
    const status = useShareImportFlow((s) => s.status);
    const importItems = useShareImportFlow((s) => s.importItems);
    const selectedItemIds = useShareImportFlow((s) => s.selectedItemIds);
    const progressMap = useShareImportFlow((s) => s.progressMap);
    const errorMessage = useShareImportFlow((s) => s.errorMessage);
    const toggleSelect = useShareImportFlow((s) => s.toggleSelect);
    const setStatus = useShareImportFlow((s) => s.setStatus);
    const setProgress = useShareImportFlow((s) => s.setProgress);
    const setLimitContext = useShareImportFlow((s) => s.setLimitContext);
    const close = useShareImportFlow((s) => s.close);

    const authUser = useAuthStore((s) => s.user);

    // 左カラムのアイテム選択 (= プレビュー対象)。 importItems の最初のアイテムを初期値にする。
    const [activeItemId, setActiveItemId] = useState<string | null>(null);

    // importItems が空 → 何かしら入った瞬間に最初の 1 件をアクティブに。
    // 既に activeItemId が選ばれていれば二度目は触らない (preview 中の選択を維持するため)。
    useEffect(() => {
        if (importItems.length > 0 && !activeItemId) {
            const firstId =
                importItems[0].sourcePlanId ?? importItems[0].sourceShareId;
            setActiveItemId(firstId);
        }
    }, [importItems, activeItemId]);

    // status='idle' のときは早期 return。
    // ※ Hooks (useState / useEffect / store subscriptions) は全てこの行より上で呼ぶこと。
    if (status === 'idle') return null;

    const isBundle = importItems.length > 1;
    const selectedCount = selectedItemIds.size;
    const activeItem =
        importItems.find(
            (i) => (i.sourcePlanId ?? i.sourceShareId) === activeItemId,
        ) ?? importItems[0];

    const handleBackdropClick = () => {
        // インポート中は誤タップで閉じないようガード (進捗が消えると混乱するため)。
        if (status === 'importing') return;
        close();
    };

    const handleImport = async () => {
        // チェックされているアイテムだけ取り込み対象にする。
        const itemsToImport = importItems.filter((i) =>
            selectedItemIds.has(i.sourcePlanId ?? i.sourceShareId),
        );
        setStatus('importing');
        await executeShareImport(
            itemsToImport,
            authUser?.uid ?? null,
            authUser?.displayName ?? '',
            setProgress,
            // limit hit 時は LimitResolutionSheet (z=99993) で promise を resolve させる。
            // setLimitContext 内部で status='limit_hit' に切り替わる。
            (params) =>
                new Promise((resolve) =>
                    setLimitContext({ ...params, resolve }),
                ),
        );
        setStatus('done');
        // ユーザーが「完了」 を視認できる程度の遅延を入れて自動で閉じる。
        setTimeout(() => close(), CLOSE_DELAY_AFTER_DONE_MS);
    };

    // status === 'idle' は上で早期 return しているのでここに来ない。
    return createPortal(
        <AnimatePresence>
            <motion.div
                key="share-import-backdrop"
                className="fixed inset-0 z-[99990] bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
            />
            <motion.div
                key="share-import-sheet"
                data-testid="share-import-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-import-title"
                className="glass-tier3 fixed bottom-0 left-0 right-0 z-[99991] rounded-t-2xl rounded-b-none flex flex-col max-h-[90vh] border-t border-app-border"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30 }}
            >
                {/* Header: タイトル */}
                <div className="px-5 pt-5 pb-3 shrink-0 border-b border-app-border">
                    <h2
                        id="share-import-title"
                        className="text-app-2xl font-black text-app-text tracking-wide"
                    >
                        {isBundle
                            ? t('share_import.title_bundle', {
                                  count: importItems.length,
                              })
                            : t('share_import.title')}
                    </h2>
                </div>

                {/* Loading 状態 */}
                {status === 'loading' && (
                    <div className="p-8 text-center text-app-text-muted">
                        {t('share_import.loading')}
                    </div>
                )}

                {/* Error 状態: not_found のときだけ専用文言、 他はジェネリックエラー */}
                {status === 'error' && (
                    <div className="p-8 text-center text-app-red">
                        {errorMessage === 'not_found'
                            ? t('share_import.not_found')
                            : t('share_import.error')}
                    </div>
                )}

                {/* Preview / Importing / Done 状態 */}
                {(status === 'preview' ||
                    status === 'importing' ||
                    status === 'done') && (
                    <>
                        {/* Body: bundle 時のみ左にリスト、 右にプレビュー。
                            モバイルで bundle 列を完全に消すと「何を取り込もうとしているか」 が見えなくなるので、
                            モバイルでは横幅を 140px に絞り、 PC では 200px。 */}
                        <div className="flex-1 overflow-hidden flex flex-row min-h-0">
                            {isBundle && (
                                <div className="flex-shrink-0 w-[140px] md:w-[200px] border-r border-app-border p-2 overflow-y-auto bg-app-surface2/30 flex flex-col gap-2">
                                    {importItems.map((item) => {
                                        const itemPlanId =
                                            item.sourcePlanId ??
                                            item.sourceShareId;
                                        const isActive =
                                            activeItemId === itemPlanId;
                                        // この item の進捗イベントだけを抽出 (ProgressIndicator 用)。
                                        const itemEvents = Array.from(
                                            progressMap.values(),
                                        ).filter(
                                            (e) => e.planId === itemPlanId,
                                        );
                                        const isChecked =
                                            selectedItemIds.has(itemPlanId);
                                        return (
                                            <SharePlanCard
                                                key={itemPlanId}
                                                title={item.title}
                                                isActive={isActive}
                                                // preview 中だけチェックを許可。 importing/done では選択固定。
                                                showCheckbox={
                                                    status === 'preview'
                                                }
                                                isChecked={isChecked}
                                                onToggleCheck={() =>
                                                    toggleSelect(itemPlanId)
                                                }
                                                onClickRow={() =>
                                                    setActiveItemId(itemPlanId)
                                                }
                                            >
                                                {(status === 'importing' ||
                                                    status === 'done') &&
                                                    itemEvents.length > 0 && (
                                                        <ShareImportProgressIndicator
                                                            events={itemEvents}
                                                        />
                                                    )}
                                            </SharePlanCard>
                                        );
                                    })}
                                </div>
                            )}

                            {/* プレビュー (right) */}
                            <div className="flex-1 min-w-0 overflow-y-auto p-3">
                                {activeItem && (
                                    <>
                                        <MitigationSheetPreview
                                            planData={activeItem.planData}
                                            loading={false}
                                        />
                                        {/* 単一インポート時の進捗インジケータ。
                                            bundle 時は左カラムのカード内に出すのでここでは出さない。 */}
                                        {!isBundle &&
                                            (status === 'importing' ||
                                                status === 'done') &&
                                            (() => {
                                                const itemPlanId =
                                                    activeItem.sourcePlanId ??
                                                    activeItem.sourceShareId;
                                                const itemEvents = Array.from(
                                                    progressMap.values(),
                                                ).filter(
                                                    (e) =>
                                                        e.planId === itemPlanId,
                                                );
                                                return itemEvents.length > 0 ? (
                                                    <ShareImportProgressIndicator
                                                        events={itemEvents}
                                                    />
                                                ) : null;
                                            })()}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Footer: 選択件数 (bundle のみ) + 取り込みボタン */}
                        <div className="px-5 py-3 shrink-0 border-t border-app-border flex items-center justify-between gap-3 bg-app-surface/40">
                            {isBundle ? (
                                <span className="text-app-sm text-app-text-muted">
                                    {t('limit_resolution.selection_count', {
                                        count: selectedCount,
                                    })}
                                </span>
                            ) : (
                                <span /> /* spacer (justify-between 用) */
                            )}
                            <button
                                type="button"
                                disabled={
                                    selectedCount === 0 || status !== 'preview'
                                }
                                onClick={handleImport}
                                aria-label={
                                    isBundle
                                        ? t(
                                              'share_import.button_import_count',
                                              { count: selectedCount },
                                          )
                                        : t('share_import.button_import_single')
                                }
                                className="px-5 py-2 rounded-md bg-app-blue text-white font-semibold uppercase hover:bg-app-blue-hover disabled:bg-app-text-muted/30 disabled:text-app-text-muted disabled:cursor-not-allowed active:scale-95 transition-all"
                            >
                                {isBundle
                                    ? t('share_import.button_import_count', {
                                          count: selectedCount,
                                      })
                                    : t('share_import.button_import_single')}
                            </button>
                        </div>
                    </>
                )}
            </motion.div>

            {/* 上限ヒット時に重ねて開く解消シート。 limitContext が null の間は内部で何も描画しない。 */}
            <LimitResolutionSheet />
        </AnimatePresence>,
        document.body,
    );
}
