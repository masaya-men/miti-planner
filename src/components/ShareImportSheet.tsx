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

/** LoPo らしい控えめなローディングインジケータ。 3 点が opacity + scale で
 *  順番に脈打つ (Phase B-1.5 polish 第 2 弾 #5 Rev 3)。 業界標準の dot loader を
 *  LoPo の白黒トーンで再現。 */
function LoadingDots() {
    return (
        <div className="flex items-center gap-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-app-text-muted"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.18,
                        ease: 'easeInOut',
                    }}
                />
            ))}
        </div>
    );
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

    // 読み込み中の演出フラグ。
    const isLoadingPhase = status === 'loading';

    // Rev 4: 2 段階アニメ。
    //   Phase A: slide-in (y 100% → 0) with bouncy spring → ~700ms 後に hasSettled=true
    //   Phase B: hasSettled=true → 呼吸ループ (y: 0 ↔ -12px) を framer-motion で発火
    //   loading → preview 遷移時は、 呼吸の現在値から y=0 へ smooth tween で戻し、
    //   layout (height growth) も smooth tween で同時進行 → 「同じシートが伸びる」 演出。
    const [hasSettled, setHasSettled] = useState(false);
    useEffect(() => {
        if (isLoadingPhase) {
            // 初期 slide-in (~700ms) が終わってから呼吸モードに切替
            const tid = window.setTimeout(() => setHasSettled(true), 700);
            return () => {
                window.clearTimeout(tid);
            };
        }
        // loading を抜けたら次回開示用にリセット
        setHasSettled(false);
    }, [isLoadingPhase]);

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
                        className={`fixed inset-0 z-[99990] ${isLoadingPhase ? 'bg-black/75 cursor-not-allowed' : 'bg-black/60'}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleBackdropClick}
                    />
                    <motion.div
                        key="share-import-sheet"
                        data-testid="share-import-sheet"
                        data-lenis-prevent
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="share-import-title"
                        // 読み込み中は:
                        //   - min-h-[55vh] でシートを画面下から 55vh 分しっかり見せる
                        //   - 呼吸アニメは framer-motion の animate keyframe で扱う (snap 防止)
                        //   - cursor-not-allowed で操作不能であることを明示
                        className={`glass-tier3 fixed bottom-0 left-0 right-0 z-[99991] rounded-t-2xl rounded-b-none flex flex-col max-h-[90vh] border-t border-app-border ${isLoadingPhase ? 'min-h-[55vh] cursor-not-allowed' : ''}`}
                        layout
                        initial={{ y: '100%' }}
                        animate={
                            // Phase A (slide-in): まず y=0 に着地
                            // Phase B (breathing): hasSettled で keyframe ループに切替
                            // 非 loading: 常に y=0
                            isLoadingPhase && hasSettled
                                ? { y: [0, -12, 0] }
                                : { y: 0 }
                        }
                        exit={{ y: '100%' }}
                        transition={{
                            y: isLoadingPhase
                                ? hasSettled
                                    ? {
                                          // 呼吸 (1 cycle = 1.6 秒、 上下 12px、 ease-in-out で柔らかく)
                                          duration: 1.6,
                                          repeat: Infinity,
                                          ease: 'easeInOut',
                                      }
                                    : {
                                          // 初期 slide-in (100% → 0): 控えめなバウンス spring。
                                          // 強すぎず弱すぎず、 着地感が伝わる程度。
                                          type: 'spring',
                                          stiffness: 200,
                                          damping: 22,
                                          mass: 1.0,
                                      }
                                : {
                                      // 読み込み完了時: 呼吸の途中値からでも snap せず smooth に y=0 に戻す
                                      type: 'tween',
                                      duration: 0.6,
                                      ease: 'easeOut',
                                  },
                            layout: {
                                // Issue B 対応: 高さ拡張 (= 上に伸びる) は bouncy spring を廃止し、
                                // ゆっくり smooth な tween で「ずるっと伸びる」 演出に。
                                type: 'tween',
                                duration: 0.9,
                                ease: [0.25, 0.1, 0.25, 1],
                            },
                        }}
                    >
                        {/* Rev 4 設計:
                            メインコンテンツ (header + body + footer) を「ローディング中以外」 で
                            常時レンダリングし、 ローディング表示を absolute inset-0 のオーバーレイ
                            として上に重ねる。 status 遷移時には:
                              - ローディングオーバーレイが fade-out
                              - メインが fade-in (少し delay)
                              - シート全体は同じ motion.div のまま (= 別シートに見えない)
                              - layout (高さ) は smooth tween で「上に伸びる」 演出
                            これにより「読み込んでいるシートそのものが上にせり上がる」 印象になる。 */}
                        <AnimatePresence>
                            {isLoadingPhase && (
                                <motion.div
                                    key="loading-overlay"
                                    className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-6 px-6 py-12 bg-app-surface/95 rounded-t-2xl"
                                    initial={{ opacity: 1 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.55, ease: 'easeOut' }}
                                >
                                    <h2
                                        id="share-import-title"
                                        className="text-app-4xl font-black text-app-text tracking-wide text-center"
                                    >
                                        {t('share_import.loading')}
                                    </h2>
                                    <LoadingDots />
                                    <p className="text-app-md text-app-text-muted text-center">
                                        {t('share_import.loading_sub')}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {!isLoadingPhase && (
                            <motion.div
                                key="main-content"
                                className="flex flex-col flex-1 min-h-0"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
                            >
                        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-app-border">
                            <h2
                                id="share-import-title"
                                className="text-app-2xl font-black text-app-text tracking-wide"
                            >
                                {isBundle
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
