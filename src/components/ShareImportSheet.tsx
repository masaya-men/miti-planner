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
import { backdropClose } from '../utils/backdropClose';
import { Fragment, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { useAuthStore } from '../store/useAuthStore';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import { ImportProgressOverlay } from './ImportProgressOverlay';
import { executeShareImport } from '../lib/executeShareImport';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { ShareImportItemList } from './shareImport/ShareImportItemList';
import { ShareImportFooter } from './shareImport/ShareImportFooter';
import { ShareImportLoadingOverlay } from './shareImport/ShareImportLoadingOverlay';
import { useActiveImportItem } from './shareImport/useActiveImportItem';
import { useCloseAfterDone } from './shareImport/useCloseAfterDone';
import { useLoadingBreathing } from './shareImport/useLoadingBreathing';
import { computeOverlayMetrics } from './shareImport/overlayMetrics';

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

    const leftListRef = useRef<HTMLDivElement>(null);
    const rightPreviewRef = useRef<HTMLDivElement>(null);

    const authUser = useAuthStore((s) => s.user);

    const { activeItemId, setActiveItemId } = useActiveImportItem(importItems);

    useCloseAfterDone(status, close);

    const isBundle = importItems.length > 1;
    const selectedCount = selectedItemIds.size;
    const activeItem =
        importItems.find(
            (i) => (i.sourcePlanId ?? i.sourceShareId) === activeItemId,
        ) ?? importItems[0];

    const overlayMetrics = computeOverlayMetrics(importItems, progressMap);


    const handleBackdropClick = () => {
        // loading 中も backdrop クリックは無視 (シートを誤って閉じさせない、 操作不能演出)
        if (status === 'importing' || status === 'limit_hit' || status === 'loading') return;
        close();
    };
    // Esc も外側クリックと同じ扱い (取り込み中・上限ヒット中・読み込み中は閉じない)
    useEscapeClose(status !== 'idle', handleBackdropClick);

    // 読み込み中の演出フラグ。
    const isLoadingPhase = status === 'loading';

    const hasSettled = useLoadingBreathing(isLoadingPhase);


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
                        className={`fixed inset-0 z-[99990] modal-scrim ${isLoadingPhase ? 'cursor-not-allowed' : ''}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        {...backdropClose(handleBackdropClick)}
                    />
                    <motion.div
                        key="share-import-sheet"
                        data-testid="share-import-sheet"
                        data-lenis-prevent
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="share-import-title"
                        // 下から出るシート: h-[80vh] / rounded-t-sheet / 素材 float-surface(2026-10-28 統一)
                        // 読み込み中は cursor-not-allowed で操作不能であることを明示 (呼吸アニメは維持)
                        className={`float-surface glass-border-b-0 fixed bottom-0 left-0 right-0 z-[99991] rounded-t-sheet rounded-b-none flex flex-col h-[80vh] ${isLoadingPhase ? 'cursor-not-allowed' : ''}`}
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
                        <ShareImportLoadingOverlay isLoadingPhase={isLoadingPhase} />

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
                                    <ShareImportItemList
                                        leftListRef={leftListRef}
                                        importItems={importItems}
                                        activeItemId={activeItemId}
                                        progressMap={progressMap}
                                        selectedItemIds={selectedItemIds}
                                        redFlaggedPlanIds={redFlaggedPlanIds}
                                        status={status}
                                        isBundle={isBundle}
                                        lang={lang}
                                        toggleSelect={toggleSelect}
                                        setActiveItemId={setActiveItemId}
                                    />

                                    {/* Right preview */}
                                    <div ref={rightPreviewRef} className="flex-1 min-w-0 overflow-y-auto p-3">
                                        {activeItem && (
                                            <MitigationSheetPreview
                                                planData={activeItem.planData}
                                                loading={false}
                                                disableSmoothScroll
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
                                <ShareImportFooter
                                    isBundle={isBundle}
                                    selectedCount={selectedCount}
                                    status={status}
                                    close={close}
                                    handleImport={handleImport}
                                />
                            </>
                        )}
                            </motion.div>
                        )}
                    </motion.div>
                </Fragment>
            )}
        </AnimatePresence>,
        document.body,
    );
}
