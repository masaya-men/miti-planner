import React from 'react';
import clsx from 'clsx';
import type { AppliedMitigation } from '../../types';
import type { useMitigationStore } from '../../store/useMitigationStore';
// 読み込む順番は CSS の並び順になるので、Timeline にあった頃の順番(効果棒→矢印→行→メモ→カーソル)のまま
import { TimelineMobileEffectBars } from './TimelineMobileEffectBars';
import { ConflictOffscreenArrows } from './ConflictOffscreenArrows';
import type { ConflictPoint } from './conflictArrows';
import { MOBILE_TOKENS } from '../../tokens/mobileTokens';
import { TimelineRows } from './TimelineRows';
import { TimelineBands } from './TimelineBands';
import { TimelineMitigationLayer } from './TimelineMitigationLayer';
import { MemoOverlay } from '../Memo/MemoOverlay';
import { MemoInputBox } from '../Memo/MemoInputBox';
import { CursorOverlay } from '../collab/CursorOverlay';
import { MyJobHighlightAttrBridge, RecordModeAttrBridge } from './TimelineAttrBridges';
import type { useTimelineScrollSync } from './useTimelineScrollSync';
import type { useTimelineMobileScrollChrome } from './useTimelineMobileScrollChrome';
import type { useTimelineMemo } from './useTimelineMemoCursor';
import type { useTimelineSheetHover } from './useTimelineSheetView';
import type { useTimelineSheetWidth, useTimelineMemberXMap, useTimelineHoverGeom } from './useTimelineLayout';

// 軍事専用部品は標準テーマに配信しないよう遅延読み込み(useSortSlide は軽い hook なので静的のまま)
const MilspecReticle = React.lazy(() => import('../military/table/MilspecReticle').then(m => ({ default: m.MilspecReticle })));
const MilspecRowPrinter = React.lazy(() => import('../military/table/MilspecRowPrinter').then(m => ({ default: m.MilspecRowPrinter })));

type MitigationStore = ReturnType<typeof useMitigationStore.getState>;
type MemoResult = ReturnType<typeof useTimelineMemo>;
type SheetHoverResult = ReturnType<typeof useTimelineSheetHover>;
type MobileChromeResult = ReturnType<typeof useTimelineMobileScrollChrome>;

type TimelineScrollAreaProps =
    Omit<React.ComponentProps<typeof TimelineRows>, 'mitigationsByTime'>
    & React.ComponentProps<typeof TimelineBands>
    & Omit<React.ComponentProps<typeof TimelineMitigationLayer>, 'mitStartsByTime'>
    & {
        currentPlanId: string | null;
        collabReadonly: boolean;
        handleScrollSync: ReturnType<typeof useTimelineScrollSync>['handleScrollSync'];
        mobilePhaseCurRef: MobileChromeResult['mobilePhaseCurRef'];
        mobilePhaseNextRef: MobileChromeResult['mobilePhaseNextRef'];
        conflictPoints: ConflictPoint[];
        isSheetView: boolean;
        handleSheetClick: MemoResult['handleSheetClick'];
        handleSheetPointerMove: SheetHoverResult['handleSheetPointerMove'];
        handleSheetPointerLeave: SheetHoverResult['handleSheetPointerLeave'];
        sheetWidth: number;
        sheetWidthRef: ReturnType<typeof useTimelineSheetWidth>['sheetWidthRef'];
        mobileConflictingIds: React.ComponentProps<typeof TimelineMobileEffectBars>['mobileConflictingIds'];
        memos: MitigationStore['memos'];
        timeToYMapRef: React.MutableRefObject<Map<number, number>>;
        memberXMap: ReturnType<typeof useTimelineMemberXMap>['memberXMap'];
        isMemoMode: boolean;
        memoInput: MemoResult['memoInput'];
        setMemoInput: MemoResult['setMemoInput'];
        handleMemoSave: MemoResult['handleMemoSave'];
        handleMemoDragEnd: MemoResult['handleMemoDragEnd'];
        handleMemoDelete: MemoResult['handleMemoDelete'];
        handleMemoClick: MemoResult['handleMemoClick'];
        cursorToLocalXRef: ReturnType<typeof useTimelineHoverGeom>['cursorToLocalXRef'];
    };

/**
 * 表のスクロールする部分(行・帯・軽減アイコン・メモ・他者カーソル・軍事の表の照準)。Timeline から移したもの。
 * 元は毎描画で組み立てていたので React.memo にしない。
 */
export const TimelineScrollArea: React.FC<TimelineScrollAreaProps> = ({
    t, scrollContainerRef, currentPlanId, isMobileTimeline, collabReadonly, handleScrollSync, isMobileView,
    phases, mobilePhaseCurRef, mobilePhaseNextRef, conflictPoints,
    sheetContainerRef, handleSheetClick, isSheetView, handleSheetPointerMove, handleSheetPointerLeave, rowLayout,
    timelineMitigations, showPreStart, sheetWidth, hiddenPartyMemberIds, MITIGATIONS, hideEmptyRows, maxTime, eventsByTime,
    shieldExhaustedAt, barrierOverwrittenAt, mobileConflictingIds,
    damageMap, sortedPartyMembers, visiblePartyMembers,
    stableMobileDamageClick, stableMobileLongPress, stablePhaseAdd, stableLabelAdd, stableAddClick,
    stableEventClick, stableCellClick, stableTimelineSelect, stableTimelineSelectHover,
    phaseColumnCollapsed, labelColumnVisible, timelineSelectMode, labelSelectMode,
    showRowBorders, sheetCols, rowSwapMarkers, rowLabels, maxMitiIconsPerRow,
    hoverGeomRef, labels, contentLanguage, overlayRef,
    partyMembers, memberLayout, sheetColumnMap, livingDeadTriggers, readOnly, removeMitigation, updateMitigationTime,
    partySortOrder, conflictingIds, lastPlacedMitigationId, handleCellClick, isMilspecTable,
    memos, timeToYMapRef, memberXMap, isMemoMode, handleMemoDragEnd, handleMemoClick, handleMemoDelete,
    sheetWidthRef, cursorToLocalXRef, memoInput, handleMemoSave, setMemoInput,
}) => (
    <>
        {/* MYジョブハイライト: 親コンテナに data-myjob-highlight を立てるだけ(CSS で薄暗く) */}
        <MyJobHighlightAttrBridge targetRef={scrollContainerRef} />
        {/* 進捗記録モード: 親コンテナに data-record-mode を立てるだけ(CSS で行ハイライト+カーソル) */}
        <RecordModeAttrBridge targetRef={scrollContainerRef} />
        <div
            ref={scrollContainerRef}
            className={clsx(
                "timeline-scroll-container flex-1 overflow-y-auto overflow-x-hidden md:overflow-x-auto relative custom-scrollbar bg-white dark:bg-[var(--color-bg-primary)] duration-200",
                // 通常アプリ: モバイルでプラン未選択なら空状態のため隠す。
                // ジョイナー(_collabReadonly=true)はプラン未選択でも部屋の表を出すので隠さない。
                !currentPlanId && isMobileTimeline && !collabReadonly && "hidden"
            )}
            onScroll={handleScrollSync}
            style={{
                // sticky なフェーズバー(下)は通常フローの実要素なので、padding では
                // ヘッダー分だけ確保すれば十分(バーの高さは自身の実高さで自動的に押し出す)。
                // ここに phaseBarHeight を足すと二重計上になりヘッダーとバーの間に隙間ができるので入れない。
                paddingTop: isMobileView ? MOBILE_TOKENS.header.compactHeight : undefined,
            }}
        >
            {/* モバイル: ヘッダー直下に隙間なく固定した現在フェーズ名。ヘッダーと同じガラス背景で1枚のパネルに見せる。
                境界に近づくスクロール量そのものに連動して横スライド(syncMobilePhaseLabelがscroll毎にtransform直書き)。
                PC 側の行ごと回転ラベルはモバイルでは出さずこちらに一本化。 */}
            {isMobileTimeline && phases.length > 0 && (
                <div
                    className="sticky top-0 z-20 overflow-hidden backdrop-blur-md"
                    style={{
                        height: MOBILE_TOKENS.header.phaseBarHeight,
                        backgroundColor: 'var(--color-nav-bg)',
                        borderBottom: '0.5px solid var(--color-nav-border)',
                    }}
                >
                    <span
                        ref={mobilePhaseCurRef}
                        className="absolute inset-0 flex items-center justify-center text-app-base font-bold text-app-text leading-none"
                    />
                    <span
                        ref={mobilePhaseNextRef}
                        className="absolute inset-0 flex items-center justify-center text-app-base font-bold text-app-text leading-none"
                    />
                </div>
            )}
            {/* 画面外競合ガイド矢印: sticky + height:0 で viewport 端に固定、コンテンツと一緒に流れない */}
            {/* 常時マウントにすることで scroll/ResizeObserver の付け外し churn を防ぐ。
                points が空のときは ConflictOffscreenArrows が何も描画しない。PC/モバイル共通。 */}
            <div className="sticky top-0 z-30 h-0 overflow-visible pointer-events-none">
                <ConflictOffscreenArrows
                    points={conflictPoints}
                    scrollContainerRef={scrollContainerRef}
                    topInset={isMobileTimeline && phases.length > 0 ? MOBILE_TOKENS.header.phaseBarHeight : 0}
                    // +compactHeight: 矢印のsticky土台自体がスクロールコンテナのpadding-top
                    // (compactHeight分)だけ画面上端からずれた位置を基準点にしているため、
                    // 下矢印を「本当の画面下端」基準で置くにはその分も追加で引く必要がある
                    // (実測で判明。上矢印側は偶然この基準ズレとフェーズバーの位置が一致するため
                    // 補正不要だった)。
                    bottomInset={isMobileTimeline ? MOBILE_TOKENS.bottomNav.height + 2 + MOBILE_TOKENS.header.compactHeight : 0}
                />
            </div>
            {/* isolate: 内部の mix-blend-mode(モバイルのエフェクト棒⇄アイコンのクロスフェード)を
                このコンテナ内だけに閉じ込め、ページ全体の背景と混ざらないようにする。 */}
            <div ref={sheetContainerRef} onClick={handleSheetClick} onPointerMove={isSheetView ? handleSheetPointerMove : undefined} onPointerLeave={isSheetView ? handleSheetPointerLeave : undefined} className="relative isolate bg-transparent md:w-max md:min-w-full" style={{
                // 表全体の高さ = 行の配置係の合計(描画と同じ計算。旧実装は別ループで数えていて、
                // スマホの同時刻 2 件行を 1 段分少なく数えていた)
                height: `calc(${rowLayout.totalHeight}px + 50vh)`
            }}>
                {(() => {
                    // 🚀 Performance Optimization: Pre-calculate mitigations map
                    const mitigationsByTime = new Map<number, AppliedMitigation[]>();
                    const mitStartsByTime = new Map<number, boolean>();
                    timelineMitigations.forEach(mit => {
                        if (!mit.autoHidden) {
                            mitStartsByTime.set(mit.time, true);
                        }
                        for (let t = mit.time; t < mit.time + mit.duration; t++) {
                            if (!mitigationsByTime.has(t)) mitigationsByTime.set(t, []);
                            if (!mit.autoHidden) {
                                mitigationsByTime.get(t)!.push(mit);
                            }
                        }
                    });

                    return (
                        <>
                            {isMobileTimeline && (
                                <TimelineMobileEffectBars
                                    showPreStart={showPreStart} sheetWidth={sheetWidth} hiddenPartyMemberIds={hiddenPartyMemberIds}
                                    timelineMitigations={timelineMitigations} MITIGATIONS={MITIGATIONS} rowLayout={rowLayout} hideEmptyRows={hideEmptyRows}
                                    maxTime={maxTime} eventsByTime={eventsByTime} mitStartsByTime={mitStartsByTime}
                                    shieldExhaustedAt={shieldExhaustedAt} barrierOverwrittenAt={barrierOverwrittenAt} mobileConflictingIds={mobileConflictingIds}
                                />
                            )}
                            <TimelineRows
                                rowLayout={rowLayout} eventsByTime={eventsByTime} damageMap={damageMap} mitigationsByTime={mitigationsByTime}
                                isMobileTimeline={isMobileTimeline} sortedPartyMembers={sortedPartyMembers} visiblePartyMembers={visiblePartyMembers}
                                hiddenPartyMemberIds={hiddenPartyMemberIds}
                                stableMobileDamageClick={stableMobileDamageClick} stableMobileLongPress={stableMobileLongPress}
                                stablePhaseAdd={stablePhaseAdd} stableLabelAdd={stableLabelAdd} stableAddClick={stableAddClick}
                                stableEventClick={stableEventClick} stableCellClick={stableCellClick}
                                stableTimelineSelect={stableTimelineSelect} stableTimelineSelectHover={stableTimelineSelectHover}
                                phaseColumnCollapsed={phaseColumnCollapsed} labelColumnVisible={labelColumnVisible}
                                timelineSelectMode={timelineSelectMode} labelSelectMode={labelSelectMode}
                                showRowBorders={showRowBorders} sheetCols={sheetCols} rowSwapMarkers={rowSwapMarkers} rowLabels={rowLabels}
                                phases={phases} maxMitiIconsPerRow={maxMitiIconsPerRow} mobileConflictingIds={mobileConflictingIds}
                            />

                            <TimelineBands
                                t={t} isMobileTimeline={isMobileTimeline} isMobileView={isMobileView} sheetContainerRef={sheetContainerRef}
                                hoverGeomRef={hoverGeomRef} phases={phases} labels={labels} phaseColumnCollapsed={phaseColumnCollapsed}
                                labelColumnVisible={labelColumnVisible} showPreStart={showPreStart} contentLanguage={contentLanguage}
                                rowLayout={rowLayout} labelSelectMode={labelSelectMode} overlayRef={overlayRef}
                            />

                            {/* スマホは MitiIcons (各行内) が軽減表示を担うので PC 用 MitigationItem は呼ばない (呼ぶと colStart=0 で左フェーズ列に見切れ流入) */}
                            {!isMobileTimeline && (
                                <TimelineMitigationLayer
                                    timelineMitigations={timelineMitigations} showPreStart={showPreStart} hideEmptyRows={hideEmptyRows}
                                    hiddenPartyMemberIds={hiddenPartyMemberIds} MITIGATIONS={MITIGATIONS} partyMembers={partyMembers}
                                    memberLayout={memberLayout} sheetColumnMap={sheetColumnMap} livingDeadTriggers={livingDeadTriggers}
                                    eventsByTime={eventsByTime} mitStartsByTime={mitStartsByTime} maxTime={maxTime} rowLayout={rowLayout}
                                    shieldExhaustedAt={shieldExhaustedAt} barrierOverwrittenAt={barrierOverwrittenAt} readOnly={readOnly}
                                    removeMitigation={removeMitigation} updateMitigationTime={updateMitigationTime}
                                    partySortOrder={partySortOrder} scrollContainerRef={scrollContainerRef} conflictingIds={conflictingIds}
                                    lastPlacedMitigationId={lastPlacedMitigationId} handleCellClick={handleCellClick} isMilspecTable={isMilspecTable}
                                />
                            )}
                        </>
                    );
                })()}
            {/* メモオーバーレイ (= 既存メモをシート上に表示)。
                メモ機能自体がスマホ非対応(作成ボタンも hidden md:flex)のため、
                既存メモの読み取り専用表示もスマホでは出さない(2026-08-14実機報告)。 */}
            {!isMobileTimeline && (
                <MemoOverlay
                    memos={memos}
                    timeToYMap={timeToYMapRef.current}
                    sheetWidth={sheetWidth}
                    xRatioToPxFn={memberXMap.toPx}
                    pxToXRatioFn={memberXMap.toRatio}
                    interactive={isMemoMode}
                    onMemoDragEnd={handleMemoDragEnd}
                    onMemoClick={handleMemoClick}
                    onMemoDelete={handleMemoDelete}
                />
            )}
            {/* ④-b-2: 他者カーソル(P2P 受信)。CursorOverlay が自分で roster を購読して
                描く相手の有無を判定する(ソロ/閲覧者なら自前で null を返し rAF も回さない)。
                map/width は ref で渡し、Timeline 再描画なしでも rAF が最新を読める。 */}
            <CursorOverlay
                timeToYMapRef={timeToYMapRef}
                sheetWidthRef={sheetWidthRef}
                toLocalXRef={cursorToLocalXRef}
            />
            {/* メモ入力ボックス (新規 / 編集 共用) */}
            {memoInput && (
                <MemoInputBox
                    topPx={memoInput.topPx}
                    leftPx={memoInput.leftPx}
                    initialText={memoInput.initialText}
                    onSave={handleMemoSave}
                    onCancel={() => setMemoInput(null)}
                />
            )}
            {/* 軍事の表: 指した所に吸い付く照準(見本 v11 js:1027-1053)。標準では出さない */}
            {isMilspecTable && (
                <React.Suspense fallback={null}><MilspecReticle rootRef={sheetContainerRef} /></React.Suspense>
            )}
            {/* 軍事の表: プラン・コンテンツの切替と電源投入で、見えている行を上から描き込む */}
            {isMilspecTable && (
                <React.Suspense fallback={null}><MilspecRowPrinter scrollRef={scrollContainerRef} /></React.Suspense>
            )}
            </div>
        </div>
    </>
);
