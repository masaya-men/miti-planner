// 共有 URL を踏んだときに開くメインのボトムシート (Phase B-1.5 polish 後)。
// レイアウト: 単一 / バンドル / loading 全環境共通 「左狭リスト + 右広 preview」。
// アニメ: spring stiffness: 300 / damping: 28 + layout prop で内容拡張時の高さ滑らかアニメ。
//
// status === 'idle' のときは中身 (backdrop + sheet) を描画しないが、 ポータル/AnimatePresence は
// 残したまま children を null にする。 これにより exit アニメーション (slide-down) が正しく走る。
//
// レイヤ構成:
//   - backdrop: z=99990
//   - sheet 本体: z=99991
//   - LimitResolutionSheet (Task 6) は内部で z=99992/99993 を使い、 本シートの上に重ねる。
import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { useAuthStore } from '../store/useAuthStore';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import { SharePlanCard } from './SharePlanCard';
import { ImportProgressOverlay } from './ImportProgressOverlay';
import { executeShareImport } from '../lib/executeShareImport';
import { LimitResolutionSheet } from './LimitResolutionSheet';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import type { ProgressEvent } from '../lib/shareImportTypes';

/** 1 アイテムの進捗を 0-1 で返す (Phase B-1.5 polish 第 2 弾 #4 Revision)。
 *  ステージ重み: check 33% / local 66% / server 100%、 in_progress は手前 10/50/80%。
 *  中央オーバーレイの linear bar 充填率算出に使う。 */
function getImportItemFraction(events: ProgressEvent[]): number {
    if (events.length === 0) return 0;
    const server = events.find(e => e.stage === 'server');
    if (server) return server.status === 'in_progress' ? 0.8 : 1.0;
    const local = events.find(e => e.stage === 'local');
    if (local) return local.status === 'in_progress' ? 0.5 : 0.66;
    const check = events.find(e => e.stage === 'check');
    if (check) return check.status === 'in_progress' ? 0.1 : 0.33;
    return 0;
}

/** アイテムが「処理終了 (success/failed/cancelled/skipped どれか)」か。 */
function isImportItemTerminal(events: ProgressEvent[]): boolean {
    if (events.length === 0) return false;
    return !events.some(e => e.status === 'in_progress');
}

// done 状態に遷移してからシートを閉じるまでの遅延 (ms)。
// ユーザーが「完了表示」 を視認する時間を確保するための定数。
const CLOSE_DELAY_AFTER_DONE_MS = 1200;

/** ProgressEvent[] → sweep status の解決ロジック (取り込み 3 stage を 1 本の sweep に集約)。
 *  - server stage success/skipped → success (取り込み完了)
 *  - 任意 stage failed → failed (赤 sweep 100% 維持)
 *  - それ以外で events 1 件以上 → active (sweep 走行)
 *  - events なし → idle */
function resolveItemSweepStatus(
    events: ProgressEvent[],
): 'idle' | 'active' | 'success' | 'failed' {
    if (events.length === 0) return 'idle';
    const failed = events.find(e => e.status === 'failed');
    if (failed) return 'failed';
    const serverDone = events.find(
        e => e.stage === 'server' && (e.status === 'success' || e.status === 'skipped'),
    );
    if (serverDone) return 'success';
    return 'active';
}

export function ShareImportSheet() {
    const { t, i18n } = useTranslation();
    const status = useShareImportFlow((s) => s.status);
    const importItems = useShareImportFlow((s) => s.importItems);
    const selectedItemIds = useShareImportFlow((s) => s.selectedItemIds);
    const progressMap = useShareImportFlow((s) => s.progressMap);
    const errorMessage = useShareImportFlow((s) => s.errorMessage);
    const redFlaggedPlanIds = useShareImportFlow((s) => s.redFlaggedPlanIds);
    const toggleSelect = useShareImportFlow((s) => s.toggleSelect);
    const setStatus = useShareImportFlow((s) => s.setStatus);
    const setProgress = useShareImportFlow((s) => s.setProgress);
    const setLimitContext = useShareImportFlow((s) => s.setLimitContext);
    const close = useShareImportFlow((s) => s.close);

    const authUser = useAuthStore((s) => s.user);

    // 左カラムのアイテム選択 (= プレビュー対象)。 importItems の最初のアイテムを初期値にする。
    const [activeItemId, setActiveItemId] = useState<string | null>(null);

    useEffect(() => {
        if (importItems.length === 0) return;
        const ids = new Set(
            importItems.map((i) => i.sourcePlanId ?? i.sourceShareId),
        );
        if (!activeItemId || !ids.has(activeItemId)) {
            const firstId =
                importItems[0].sourcePlanId ?? importItems[0].sourceShareId;
            setActiveItemId(firstId);
        }
    }, [importItems, activeItemId]);

    useEffect(() => {
        if (status !== 'done') return;
        const id = setTimeout(() => close(), CLOSE_DELAY_AFTER_DONE_MS);
        return () => clearTimeout(id);
    }, [status, close]);

    const isBundle = importItems.length > 1;
    const selectedCount = selectedItemIds.size;
    const activeItem =
        importItems.find(
            (i) => (i.sourcePlanId ?? i.sourceShareId) === activeItemId,
        ) ?? importItems[0];

    // 中央オーバーレイ用の集計 (importing / done 中のみ意味あり)
    const overlayMetrics = (() => {
        if (importItems.length === 0) {
            return { percent: 0, completedCount: 0, totalCount: 0 };
        }
        let totalFraction = 0;
        let completedCount = 0;
        for (const item of importItems) {
            const planId = item.sourcePlanId ?? item.sourceShareId;
            const events = Array.from(progressMap.values()).filter(
                (e) => e.planId === planId,
            );
            totalFraction += getImportItemFraction(events);
            if (isImportItemTerminal(events)) completedCount += 1;
        }
        return {
            percent: (totalFraction / importItems.length) * 100,
            completedCount,
            totalCount: importItems.length,
        };
    })();

    const handleBackdropClick = () => {
        // loading 中も backdrop クリックは無視 (シートを誤って閉じさせない、 操作不能演出)
        if (status === 'importing' || status === 'limit_hit' || status === 'loading') return;
        close();
    };

    // 読み込み中の演出フラグ (Phase B-1.5 polish 第 2 弾 #5)。
    // - シートが画面下部に小さく出て上下に「ぽよんぽよん…」 とアニメ
    // - 完了後にバウンドしながら y=0 まで上がってきて止まる
    // - 操作不能を示すため backdrop + sheet 上で cursor: not-allowed
    const isLoadingPhase = status === 'loading';

    const handleImport = async () => {
        const itemsToImport = importItems.filter((i) =>
            selectedItemIds.has(i.sourcePlanId ?? i.sourceShareId),
        );
        setStatus('importing');
        await executeShareImport(
            itemsToImport,
            authUser?.uid ?? null,
            authUser?.displayName ?? '',
            setProgress,
            (params) =>
                new Promise((resolve) =>
                    setLimitContext({ ...params, resolve }),
                ),
        );
        setStatus('done');
    };

    // テスト環境では i18n オブジェクトが渡らない場合があるので optional chaining + デフォルト 'en'
    const lang = i18n?.language ?? 'en';

    return createPortal(
        <AnimatePresence>
            {status !== 'idle' && (
                <Fragment key="share-import-sheet-fragment">
                    <motion.div
                        key="share-import-backdrop"
                        className={`fixed inset-0 z-[99990] bg-black/60 ${isLoadingPhase ? 'cursor-not-allowed' : ''}`}
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
                        className={`glass-tier3 fixed bottom-0 left-0 right-0 z-[99991] rounded-t-2xl rounded-b-none flex flex-col max-h-[90vh] border-t border-app-border ${isLoadingPhase ? 'cursor-not-allowed' : ''}`}
                        // 注意: layout prop は子要素の position 自動アニメも引き起こすため、
                        // sheet 直下のこの 1 個に限定する (子は通常の <div> に維持)。
                        layout
                        initial={{ y: '100%' }}
                        animate={
                            isLoadingPhase
                                // 読み込み中の一連の動き (Phase B-1.5 polish 第 2 弾 #5)。
                                // 1) 100% → 65% (slide-in)
                                // 2) 65% で一拍ホールド
                                // 3) 65→58→65 で 1 回ぽよん
                                // 4) 65% で一拍ホールド
                                // 5) 65→58→65 で 2 回目ぽよん
                                // total 2.6 秒。 シートは「画面の下から半分出てきて 2 回ぽよん」 と
                                // ユーザーに認知される。
                                ? { y: ['100%', '65%', '65%', '58%', '65%', '65%', '58%', '65%'] }
                                : { y: 0 }
                        }
                        exit={{ y: '100%' }}
                        transition={
                            isLoadingPhase
                                ? {
                                      duration: 2.6,
                                      times: [0, 0.18, 0.35, 0.45, 0.55, 0.72, 0.85, 1],
                                      ease: 'easeOut',
                                  }
                                : {
                                      // 読み込み完了 → y=0 に上がる時はバウンドしてから止まる。
                                      // 低 damping + mass で複数オシレーションを見せる
                                      // (「ぽよんぽよんしてバウンスして止まる」 の最終段)。
                                      type: 'spring',
                                      stiffness: 120,
                                      damping: 8,
                                      mass: 1.2,
                                      layout: { type: 'spring', stiffness: 300, damping: 28 },
                                  }
                        }
                    >
                        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-app-border">
                            <h2
                                id="share-import-title"
                                className="text-app-2xl font-black text-app-text tracking-wide"
                            >
                                {/* 読み込み中はシートが y=65% 付近で上下に揺れていて、 ヘッダ
                                    だけが画面下から覗いている状態。 title を「読み込んでいます…」
                                    にしてユーザーがいま何が起きているか分かるようにする。 */}
                                {status === 'loading'
                                    ? t('share_import.loading')
                                    : isBundle
                                        ? t('share_import.title_bundle', { count: importItems.length })
                                        : t('share_import.title')}
                            </h2>
                        </div>

                        {status === 'error' && (
                            <div className="p-8 text-center text-app-red">
                                {errorMessage === 'not_found'
                                    ? t('share_import.not_found')
                                    : t('share_import.error')}
                            </div>
                        )}

                        {(status === 'preview' ||
                            status === 'importing' ||
                            status === 'limit_hit' ||
                            status === 'done') && (
                            <>
                                <div className="flex-1 overflow-hidden flex flex-row min-h-0">
                                    {/* Left list (#1: 単一でも常に描画) */}
                                    <div className="flex-shrink-0 w-[140px] md:w-[200px] border-r border-app-border p-2 overflow-y-auto bg-app-surface2/30 flex flex-col gap-2">
                                        <LayoutGroup>
                                            {importItems.map((item) => {
                                                const itemPlanId = item.sourcePlanId ?? item.sourceShareId;
                                                const isActive = activeItemId === itemPlanId;
                                                const itemEvents = Array.from(progressMap.values()).filter(
                                                    (e) => e.planId === itemPlanId,
                                                );
                                                const isChecked = selectedItemIds.has(itemPlanId);
                                                const isRedFlagged = redFlaggedPlanIds.has(itemPlanId);
                                                // #2: コンテンツ名を主タイトル、 プラン名を副タイトル
                                                const contentDef = item.contentId
                                                    ? getContentById(item.contentId)
                                                    : null;
                                                const contentLabel = contentDef
                                                    ? getPhaseName(contentDef.name, lang)
                                                    : '';
                                                // sweep は importing / done 時のみ表示。
                                                // done のときも継続表示するのは、 CLOSE_DELAY_AFTER_DONE_MS の
                                                // 1.2 秒間に success 状態の青チェックアイコンを視認させるため。
                                                const sweepStatus = (status === 'importing' || status === 'done')
                                                    ? resolveItemSweepStatus(itemEvents)
                                                    : undefined;
                                                return (
                                                    <SharePlanCard
                                                        key={itemPlanId}
                                                        title={contentLabel || item.title}
                                                        subtitle={contentLabel ? item.title : undefined}
                                                        isActive={isActive}
                                                        // 単一プランでは checkbox を出さない: 外しても取り込みボタンが
                                                        // disabled になるだけで UX 矛盾になる (キャンセル/取り込みの 2 択で十分)。
                                                        showCheckbox={isBundle && status === 'preview'}
                                                        isChecked={isChecked}
                                                        onToggleCheck={() => toggleSelect(itemPlanId)}
                                                        onClickRow={() => setActiveItemId(itemPlanId)}
                                                        isRedFlagged={isRedFlagged}
                                                        sweepStatus={sweepStatus}
                                                        sweepColor="blue"
                                                    />
                                                );
                                            })}
                                        </LayoutGroup>
                                    </div>

                                    {/* Right preview */}
                                    <div className="flex-1 min-w-0 overflow-y-auto p-3">
                                        {activeItem && (
                                            <MitigationSheetPreview
                                                planData={activeItem.planData}
                                                loading={false}
                                            />
                                        )}
                                    </div>
                                </div>
                                {/* 中央オーバーレイ (#4 Revision 2): createPortal で document.body に
                                    マウントされ、 画面真ん中に fixed 表示される。 JSX のこの位置は
                                    レンダリングツリーの一員という意味だけで、 実際の DOM 位置は body 直下。 */}
                                <ImportProgressOverlay
                                    visible={status === 'importing' || status === 'done'}
                                    percent={overlayMetrics.percent}
                                    label={t('share_import.progress_label')}
                                    countLabel={
                                        isBundle
                                            ? `${overlayMetrics.completedCount}/${overlayMetrics.totalCount}`
                                            : undefined
                                    }
                                    color="blue"
                                />

                                {/* Footer (キャンセルボタン追加) */}
                                <div className="px-5 py-3 shrink-0 border-t border-app-border flex items-center justify-between gap-3 bg-app-surface/40">
                                    {isBundle ? (
                                        <span className="text-app-sm text-app-text-muted">
                                            {t('limit_resolution.selection_count', { count: selectedCount })}
                                        </span>
                                    ) : (
                                        <span />
                                    )}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={close}
                                            disabled={status !== 'preview'}
                                            aria-label={t('share_import.button_cancel')}
                                            className="px-4 py-2 rounded-md text-app-text border border-app-border hover:bg-app-surface2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {t('share_import.button_cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={selectedCount === 0 || status !== 'preview'}
                                            onClick={handleImport}
                                            aria-label={
                                                isBundle
                                                    ? t('share_import.button_import_count', { count: selectedCount })
                                                    : t('share_import.button_import_single')
                                            }
                                            className="px-5 py-2 rounded-md bg-app-blue text-white font-semibold uppercase hover:bg-app-blue-hover disabled:bg-app-text-muted/30 disabled:text-app-text-muted disabled:cursor-not-allowed active:scale-95 transition-all"
                                        >
                                            {isBundle
                                                ? t('share_import.button_import_count', { count: selectedCount })
                                                : t('share_import.button_import_single')}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                </Fragment>
            )}

            {/* 上限ヒット時に重ねて開く解消シート。 limitContext が null の間は内部で何も描画しない */}
            <LimitResolutionSheet />
        </AnimatePresence>,
        document.body,
    );
}
