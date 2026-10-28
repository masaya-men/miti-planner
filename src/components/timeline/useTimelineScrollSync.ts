import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { AppliedMitigation } from '../../types';
import { useMitigationStore } from '../../store/useMitigationStore';
import { planOpenHideEmptyRows } from './planOpenHideEmptyRows';
import { useSmoothWheelScroll } from '../../lib/scroll/useSmoothWheelScroll';
import { yToTimeSec, reanchorScrollTop } from '../Memo/coords';
import type { RecastRowHandle } from '../RecastRow';
import type { RowLayout } from './rowLayout';

/*
 * スクロールと横の同期。Timeline 本体から移したもの。
 * 本体では間に別フックの effect が挟まる位置に散らばっていたため、元の位置ごとに 3 つのフックへ割っている。
 * 本体では元と同じ位置で呼ぶこと(順序を入れ替えない)。
 */

/** ① 指定時刻へなめらかにスクロール。縦位置は rowLayoutRef(常に最新)から得るので deps 不要 */
export function useTimelineNavJump({
    scrollContainerRef, rowLayoutRef,
}: {
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    rowLayoutRef: MutableRefObject<RowLayout>;
}) {
    // useCallback で包む: progress:jump-to-time リスナが最新版を参照するため。
    // 縦位置は rowLayoutRef(常に最新の行の配置)から得るので deps 不要。
    const handleNavJump = useCallback((time: number) => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollTo({ top: rowLayoutRef.current.topOf(time), behavior: 'smooth' });
    }, [rowLayoutRef, scrollContainerRef]);
    return { handleNavJump };
}

/**
 * ② プラン切替でスクロールと空行非表示をリセットする effect と、ホイールのなめらかスクロール。
 * 戻り値 = この描画で使う「空の行は隠す」。切り替えた直後の描画では、ストアに書く前でも
 * 切り替え後の値を返す(描いた後に戻すと、保存値が「出す」の時に全行を作って捨てて約 1.6 秒固まっていた・2026-10-28)。
 */
export function useTimelinePlanScrollReset({
    scrollContainerRef, currentPlanId, joinerRoomToken, hideEmptyRows,
}: {
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    currentPlanId: string | null;
    joinerRoomToken: string | null;
    hideEmptyRows: boolean;
}): boolean {
    const resetKey = `${currentPlanId ?? ''}|${joinerRoomToken ?? ''}`;
    // effect がストアへ書き終えたプラン。これと違う間は、ストアの値の代わりに切り替え後の値で描く
    const appliedKeyRef = useRef<string | null>(null);
    const pending = appliedKeyRef.current !== resetKey ? planOpenHideEmptyRows(currentPlanId, joinerRoomToken) : null;

    // プラン切替時に縦横スクロールをトップ・左端へ、空行非表示をデフォルト(コンパクト)にリセット
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, left: 0 });
        }
        appliedKeyRef.current = `${currentPlanId ?? ''}|${joinerRoomToken ?? ''}`;
        const next = planOpenHideEmptyRows(currentPlanId, joinerRoomToken);
        if (next !== null) useMitigationStore.getState().setHideEmptyRows(next);
    }, [currentPlanId, joinerRoomToken, scrollContainerRef]);

    useSmoothWheelScroll(scrollContainerRef, { horizontalScrollOnShift: true, stiffness: 80, wheelMultiplier: 1.5 });
    return pending ?? hideEmptyRows;
}

interface UseTimelineScrollSyncArgs {
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    headerRef: RefObject<HTMLDivElement | null>;
    controlBarRef: RefObject<HTMLDivElement | null>;
    recastRowRef: RefObject<RecastRowHandle | null>;
    timeToYMapRef: MutableRefObject<Map<number, number>>;
    sortedTimeYRef: MutableRefObject<[number, number][]>;
    hideEmptyRows: boolean;
    showPreStart: boolean;
    recastRowVisible: boolean;
    timelineMitigations: AppliedMitigation[];
}

/** ③ 縦横スクロールの同期一式(ヘッダー横追従・位置合わせ直し・余白合わせ・リキャスト行の再同期) */
export function useTimelineScrollSync({
    scrollContainerRef, headerRef, controlBarRef, recastRowRef, timeToYMapRef, sortedTimeYRef,
    hideEmptyRows, showPreStart, recastRowVisible, timelineMitigations,
}: UseTimelineScrollSyncArgs) {
    // handleScrollSync がヘッダー/コントロールバー内の対象要素を毎スクロールイベントで
    // querySelector していたのをキャッシュする(2026-08-14、実測プロファイルでスクロール毎の
    // 負荷の一因と判明)。要素が差し替わった場合のみ(isConnected/contains チェックで検知して)
    // 再検索するので、挙動(idヒット→firstElementChildフォールバック)は変えていない。
    const scrollSyncInnerElsRef = useRef<{ header: HTMLElement | null; controls: HTMLElement | null }>({ header: null, controls: null });
    // 表の展開/折りたたみ前後でスクロールアンカーを維持するため、直近のビューポート中央の時刻を保持
    const lastCenterTimeRef = useRef<number | null>(null);

    const handleScrollSync = () => {
        if (!scrollContainerRef.current) return;
        const scrollLeft = scrollContainerRef.current.scrollLeft;

        // 縦: 表の展開/折りたたみでアンカーを維持するため、ビューポート中央の時刻を記録
        const sc = scrollContainerRef.current;
        const centerT = yToTimeSec(sc.scrollTop + sc.clientHeight / 2, timeToYMapRef.current);
        if (centerT !== null) lastCenterTimeRef.current = centerT;

        // Use transform for more reliable sync across different content widths
        const containers = [
            { ref: headerRef, id: 'timeline-header-inner', cacheKey: 'header' as const },
            { ref: controlBarRef, id: 'timeline-controls-inner', cacheKey: 'controls' as const },
        ];

        containers.forEach(({ ref, id, cacheKey }) => {
            if (!ref.current) return;
            let inner = scrollSyncInnerElsRef.current[cacheKey];
            if (!inner || !inner.isConnected || !ref.current.contains(inner)) {
                inner = (ref.current.querySelector(`#${id}`) as HTMLElement | null)
                    ?? (ref.current.firstElementChild as HTMLElement | null);
                scrollSyncInnerElsRef.current[cacheKey] = inner;
            }
            if (inner) inner.style.transform = `translateX(-${scrollLeft}px)`;
        });
    };

    // 表の展開/折りたたみ (hideEmptyRows) で全行の高さ・Y が変わると、scrollTop 数値は
    // 保持されても指す時刻がズレて画面が飛ぶ。直前に見ていた中央の時刻を新しい配置で
    // 計算し直してスクロールを合わせ、アンカーを維持する (desktop/mobile 両トグル経路に有効)。
    const reanchorMountedRef = useRef(false);
    useLayoutEffect(() => {
        if (!reanchorMountedRef.current) { reanchorMountedRef.current = true; return; }
        const c = scrollContainerRef.current;
        const anchor = lastCenterTimeRef.current;
        if (!c || anchor === null) return;
        c.scrollTop = reanchorScrollTop(anchor, timeToYMapRef.current, c.clientHeight);
    }, [hideEmptyRows, scrollContainerRef, timeToYMapRef]);


    useEffect(() => {
        const syncPadding = () => {
            if (scrollContainerRef.current && headerRef.current) {
                const scrollbarWidth = scrollContainerRef.current.offsetWidth - scrollContainerRef.current.clientWidth;
                headerRef.current.style.paddingRight = `${scrollbarWidth}px`;
                if (controlBarRef.current) controlBarRef.current.style.paddingRight = `${scrollbarWidth}px`;
            }
        };

        syncPadding();
        window.addEventListener('resize', syncPadding);
        return () => window.removeEventListener('resize', syncPadding);
    }, [controlBarRef, headerRef, scrollContainerRef]);

    // リキャスト行: スクロールに連動して current time を更新 (GPU 描画、 React 再レンダーなし)
    // セッション 18 案 C1: RecastRow は header (scroll container の外) に物理移動したので、
    // scrollTop はそのまま wrapper 座標系として扱える (recastRowHeight 控除は不要)。
    // 現在のスクロール位置を currentTime に変換し、 RecastRow.update() へ反映する関数。
    // スクロールハンドラと「配置変化時の再同期」 effect の両方から呼ぶため useCallback で共有する。
    const syncRecastRow = useCallback(() => {
        // OFF 時はアイコンを全部隠す (セルは残るので罫線維持)
        if (!recastRowVisible) {
            recastRowRef.current?.hideAll();
            return;
        }
        const container = scrollContainerRef.current;
        if (!container) return;
        const scrollTop = container.scrollTop;
        const offsetTime = showPreStart ? -10 : 0;
        let currentTime: number;
        if (sortedTimeYRef.current.length > 0) {
            // 上端が scrollTop に最も近い行の時刻を逆引き(行の高さが可変でも、空の行を隠す設定でも同じ方法)。
            // Y昇順ソート済み配列(sortedTimeYRef)を二分探索する。以前はtimeToYMapを毎回
            // forEachで全走査しており、戦闘が長い(=行数が多い)ほどスクロール1回ごとの
            // コストが積み重なりメインスレッドを塞いでいた(2026-08-14ユーザー実機報告
            // 「スマホでスクロールが重い/変身アニメがとびとび」の主因)。
            const arr = sortedTimeYRef.current;
            let lo = 0, hi = arr.length - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (arr[mid][1] < scrollTop) lo = mid + 1; else hi = mid;
            }
            let closestIdx = lo;
            if (lo > 0 && Math.abs(arr[lo - 1][1] - scrollTop) <= Math.abs(arr[lo][1] - scrollTop)) {
                closestIdx = lo - 1;
            }
            currentTime = arr[closestIdx][0];
        } else {
            currentTime = offsetTime;
        }
        recastRowRef.current?.update(currentTime);
    }, [recastRowVisible, scrollContainerRef, showPreStart, sortedTimeYRef, recastRowRef]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        syncRecastRow(); // 初期化
        container.addEventListener('scroll', syncRecastRow, { passive: true });
        return () => container.removeEventListener('scroll', syncRecastRow);
    }, [scrollContainerRef, syncRecastRow]);

    // 配置 (timelineMitigations) が変わったら、 スクロールを待たずに即リキャスト行を再同期する。
    // update() はスクロール時にしか呼ばれないため、 これが無いと「現在のスクロール位置では
    // 本来クロックが出るべき新規配置」 が、 ユーザーが一度スクロールするまで --cd-display:none の
    // まま表示されない (特にターゲットシールド系チャージ技は同じ位置で置いて確認するため顕在化)。
    useEffect(() => {
        syncRecastRow();
    }, [syncRecastRow, timelineMitigations]);

    return { scrollSyncInnerElsRef, handleScrollSync, syncRecastRow };
}
