import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { AppliedMitigation, PartyMember, TimelineEvent } from '../../types';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useEffectiveThemeStyle } from '../../store/useThemeStore';
import { useRenderPendingStore } from '../../store/useRenderPendingStore';
import { getSortedPartyMemberIds } from '../../constants/party';
import { MOBILE_MITI_ICON_PITCH_PX, MOBILE_MITI_ICONS_ROW_PADDING_PX } from '../../utils/mobileEffectBar';
import { pxToXRatio, xRatioToPx } from '../Memo/coords';
import { useMeasuredMemberLayout } from '../Timeline.layoutHooks';
import type { MemberRefEntry } from '../Timeline.layoutHooks';
import { computeRowLayout, EMPTY_ROW_LAYOUT, ROW_UNIT_PX } from './rowLayout';
import type { RowLayout } from './rowLayout';
import type { SheetColumn } from './sheet/sheetColumns';
import { lanesBands, sheetBands, convertMemberX, lanesSheetWidth, readLanesColumnVars } from './sheet/memberX';
import type { HoverGeom } from './sheet/TableHoverHighlight';
import { matchesMobile } from '../../hooks/useIsMobile';

/*
 * 列と行の位置計算。Timeline 本体から移したもの。
 * 本体の中で飛び地(スクロール同期の effect を挟む)に散らばっていたため、
 * effect と描画中の ref 書き込みの相対順を保つよう、元の位置ごとに 7 つのフックへ割っている。
 * 本体では元と同じ位置で順に呼ぶこと(順序を入れ替えない)。
 */

/** ① 画面の種類と 1 段の高さ。isMobileTimeline は描画中に window.innerWidth を読むだけ(state 化しない) */
export function useTimelineViewMode() {
    const isMobileTimeline = matchesMobile(window);
    // PC 軍事モードのときだけ true。標準では常に false = 従来 DOM のまま (標準モード不変)。
    const themeStyle = useEffectiveThemeStyle();
    const isMilspecTable = themeStyle === 'military' && !isMobileTimeline;
    // 1 段の高さ(PC=攻撃 1 つ分 / スマホ=カード 1 枚)。縦位置は rowLayout(下で計算)から得る
    const rowUnitPx = isMobileTimeline ? ROW_UNIT_PX.mobile : ROW_UNIT_PX.pc;
    return { isMobileTimeline, isMilspecTable, rowUnitPx };
}

/** ② 表の幅(ResizeObserver で追従)と、モバイルのアイコン行に入る最大数 */
export function useTimelineSheetWidth({ sheetContainerRef }: { sheetContainerRef: RefObject<HTMLDivElement | null> }) {
    // sheetWidth を state 化 + ResizeObserver で動的更新 (初期 0 で left=0 に固まる問題を解決)
    const [sheetWidth, setSheetWidth] = useState(0);
    useLayoutEffect(() => {
        const el = sheetContainerRef.current;
        if (!el) return;
        const updateWidth = () => setSheetWidth(el.getBoundingClientRect().width);
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(el);
        return () => observer.disconnect();
    }, [sheetContainerRef]);
    // ④-b-2: CursorOverlay の rAF が再描画なしで最新幅を読めるよう ref ミラーを保持(sheetWidth は低頻度更新)。
    const sheetWidthRef = useRef(sheetWidth);
    sheetWidthRef.current = sheetWidth;

    // モバイル軽減アイコン専用行: 1行に入りきる最大アイコン数(画面幅から算出、maxConcurrentと
    // 同じ考え方)。あふれた分は折り返さず「+N」バッジにする(2026-08-13ユーザー要望=
    // 行の高さを固定コマからはみ出させないため、2段折り返しは絶対にしない)。
    const maxMitiIconsPerRow = useMemo(() => {
        const availableWidth = (sheetWidth > 0 ? sheetWidth : 350) - MOBILE_MITI_ICONS_ROW_PADDING_PX * 2;
        return Math.max(1, Math.floor(availableWidth / MOBILE_MITI_ICON_PITCH_PX));
    }, [sheetWidth]);
    return { sheetWidth, sheetWidthRef, maxMitiIconsPerRow };
}

/** ③ フェーズ・ラベル列の折りたたみとリキャスト行の表示 ON/OFF(localStorage に保存) */
export function useTimelineColumnCollapse() {
    const [phaseColumnCollapsed, setPhaseColumnCollapsed] = useState(() => {
        try { return localStorage.getItem('lopo-phase-col-collapsed') === 'true'; } catch { return false; }
    });
    const [labelColumnCollapsed, setLabelColumnCollapsed] = useState(() => {
        try { return localStorage.getItem('lopo-label-col-collapsed') === 'true'; } catch { return false; }
    });
    // リキャスト行の表示 ON/OFF (セッション 18 案 C1 物理移動)。 デフォルト ON。
    const [recastRowVisible, setRecastRowVisible] = useState(() => {
        try {
            const v = localStorage.getItem('lopo-recast-row-visible');
            return v === null ? true : v === 'true';
        } catch { return true; }
    });

    const handleTogglePhaseCollapse = () => {
        setPhaseColumnCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('lopo-phase-col-collapsed', String(next)); } catch { /* 意図的に無視: localStorage 不可でも表示は継続 */ }
            return next;
        });
    };

    const handleToggleLabelCollapse = () => {
        setLabelColumnCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('lopo-label-col-collapsed', String(next)); } catch { /* 意図的に無視: localStorage 不可でも表示は継続 */ }
            return next;
        });
    };

    const handleToggleRecastRowVisible = () => {
        setRecastRowVisible(prev => {
            const next = !prev;
            try { localStorage.setItem('lopo-recast-row-visible', String(next)); } catch { /* 意図的に無視: localStorage 不可でも表示は継続 */ }
            return next;
        });
    };
    return {
        phaseColumnCollapsed, labelColumnCollapsed, recastRowVisible,
        handleTogglePhaseCollapse, handleToggleLabelCollapse, handleToggleRecastRowVisible,
    };
}

interface UseTimelineRowLayoutArgs {
    fightDuration: number;
    timelineEvents: TimelineEvent[];
    timelineMitigations: AppliedMitigation[];
    hideEmptyRows: boolean;
    rowUnitPx: number;
    rowLayoutRef: MutableRefObject<RowLayout>;
    timeToYMapRef: MutableRefObject<Map<number, number>>;
    sortedTimeYRef: MutableRefObject<[number, number][]>;
}

/** ④ 行の配置(格子の秒・時刻ごとの攻撃・各行の位置と高さ)と、それを読む ref への描画中書き込み */
export function useTimelineRowLayout({
    fightDuration, timelineEvents, timelineMitigations, hideEmptyRows, rowUnitPx,
    rowLayoutRef, timeToYMapRef, sortedTimeYRef,
}: UseTimelineRowLayoutArgs) {
    const gridLines = useMemo(() => {
        const lines = [];
        const start = -10;
        const end = fightDuration;
        for (let i = start; i <= end; i++) {
            lines.push(i);
        }
        return lines;
    }, [fightDuration]);

    const eventsByTime = useMemo(() => {
        const targetOrder = { MT: 0, ST: 1 } as const;
        const map = new Map<number, TimelineEvent[]>();
        timelineEvents.forEach(event => {
            const t = event.time;
            if (!map.has(t)) map.set(t, []);
            map.get(t)?.push(event);
        });
        // 同一時刻内: MT → ST → AoE の順を保証
        map.forEach(events => {
            if (events.length > 1) {
                events.sort((a, b) =>
                    (targetOrder[a.target as keyof typeof targetOrder] ?? 2) -
                    (targetOrder[b.target as keyof typeof targetOrder] ?? 2)
                );
            }
        });
        return map;
    }, [timelineEvents]);

    // 行の配置係: 各秒の行の位置と高さ・表全体の高さを 1 か所で決める(縦位置の答えはすべてここから)。
    // 行の高さ = 1 段 × max(1, 攻撃数)。空の行を隠す設定の可視判定もここ(旧: 表全体の高さと描画ループで二重に計算)。
    const forceShowTime0 = useTutorialStore(s => s.isActive && s.getCurrentStep()?.id === 'create-6-add-event');
    const rowLayout = useMemo(() => {
        let maxPopulatedTime = -11;
        if (hideEmptyRows) {
            timelineEvents.forEach(e => { if (e.time > maxPopulatedTime) maxPopulatedTime = e.time; });
            timelineMitigations.forEach(m => { if (m.time > maxPopulatedTime) maxPopulatedTime = m.time; });
        }
        const mitStartTimes = new Set<number>();
        timelineMitigations.forEach(m => { if (!m.autoHidden) mitStartTimes.add(m.time); });
        return computeRowLayout({
            times: gridLines,
            eventCountAt: t => eventsByTime.get(t)?.length ?? 0,
            hasMitigationStartAt: t => mitStartTimes.has(t),
            hideEmptyRows,
            maxPopulatedTime,
            forceVisibleTimes: forceShowTime0 ? new Set([0]) : undefined,
            unitPx: rowUnitPx,
        });
    }, [gridLines, eventsByTime, timelineEvents, timelineMitigations, hideEmptyRows, forceShowTime0, rowUnitPx]);
    // 縦位置を使うコールバック(スクロール同期・ジャンプ・範囲選択・メモ・カーソル)は ref 経由で最新を読む
    rowLayoutRef.current = rowLayout;
    timeToYMapRef.current = rowLayout.timeToY;
    sortedTimeYRef.current = rowLayout.sortedTimeY;
    return { gridLines, eventsByTime, rowLayout };
}

interface UseTimelinePartyOrderArgs {
    partyMembers: PartyMember[];
    partySortOrder: Parameters<typeof getSortedPartyMemberIds>[0];
    hiddenPartyMemberIds: string[];
}

/** ⑤ 並べ替え済みのメンバーと、表示/非表示スイッチで隠した分を除いた列描画専用リスト */
export function useTimelinePartyOrder({ partyMembers, partySortOrder, hiddenPartyMemberIds }: UseTimelinePartyOrderArgs) {
    // 注意: sortedPartyMembers は TimelineRow 等で「H1 の maxHp を引く」ような計算にも
    // partyMembers として渡って使われている(表示専用ではない)。表示/非表示スイッチは
    // 見た目だけの絞り込みという確定仕様のため、ここでは絶対にフィルタしない。
    // 非表示メンバーの列描画だけを絞り込みたい箇所は、必ず visiblePartyMembers
    // (この下で定義・hiddenPartyMemberIds を反映した派生リスト)の方を使うこと。
    const sortedPartyMembers = useMemo(() => {
        const order = getSortedPartyMemberIds(partySortOrder);

        return [...partyMembers].sort((a, b) => {
            const indexA = order.indexOf(a.id);
            const indexB = order.indexOf(b.id);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });
    }, [partyMembers, partySortOrder]);

    // 表示/非表示スイッチで隠したメンバーを除いた列描画専用リスト。JobPickerRow/RecastRow など
    // 「メンバーごとに1列描画するだけ」のコンポーネントにのみ渡す(見た目だけへの影響に限定するため)。
    const visiblePartyMembers = useMemo(
        () => sortedPartyMembers.filter((m) => !hiddenPartyMemberIds.includes(m.id)),
        [sortedPartyMembers, hiddenPartyMemberIds]
    );
    return { sortedPartyMembers, visiblePartyMembers };
}

interface UseTimelineMemberXMapArgs {
    sortedPartyMembers: PartyMember[];
    visiblePartyMembers: PartyMember[];
    isSheetView: boolean;
    sheetWidth: number;
    sheetContainerRef: RefObject<HTMLDivElement | null>;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
    memberXMapRef: MutableRefObject<{ toPx: (xRatio: number) => number; toRatio: (px: number) => number }>;
}

/** ⑥ 列の実測(memberLayout)・「更新中」表示の解除・メモやカーソルの横位置変換。最後に memberXMapRef を描画中に差し替える */
export function useTimelineMemberXMap({
    sortedPartyMembers, visiblePartyMembers, isSheetView, sheetWidth,
    sheetContainerRef, scrollContainerRef, memberXMapRef,
}: UseTimelineMemberXMapArgs) {
    // DOM 計測ベースの memberLayout (CSS clamp() に追従)
    const [refVersion, setRefVersion] = useState(0);
    const memberHeaderRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

    const setMemberHeaderRef = useCallback((id: string, el: HTMLDivElement | null) => {
        const prev = memberHeaderRefs.current.get(id);
        if (prev !== el) {
            memberHeaderRefs.current.set(id, el);
            setRefVersion(v => v + 1);
        }
    }, []);

    // メンバーごとに安定した ref コールバックをキャッシュ。
    // JSX 内でインライン関数 `(el) => setMemberHeaderRef(id, el)` を書くと
    // 毎レンダーで新インスタンスが生成され React が detach→attach を繰り返し、
    // setRefVersion → 再レンダー → 無限ループを起こす。
    // useRef に id→callback をキャッシュすることで関数参照を安定化する。
    const memberRefCallbacks = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
    const getMemberRefCallback = useCallback((id: string) => {
        if (!memberRefCallbacks.current.has(id)) {
            memberRefCallbacks.current.set(id, (el: HTMLDivElement | null) => setMemberHeaderRef(id, el));
        }
        return memberRefCallbacks.current.get(id)!;
    }, [setMemberHeaderRef]);

    const memberRefEntries = useMemo(
        (): MemberRefEntry[] => sortedPartyMembers.map(m => ({ id: m.id, el: memberHeaderRefs.current.get(m.id) ?? null })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sortedPartyMembers, refVersion],
    );
    const memberLayout = useMeasuredMemberLayout(memberRefEntries);

    // 表示メンバー絞り込みトグル(PartyVisibilityMenu)が出す「更新中」インジケーターを消すタイミング。
    // memberLayout は列の増減(=表示切り替え)による再描画カスケードの最後に更新される値なので、
    // これが確定した = 一連の重い再描画が落ち着いた、とみなせる(2026-08-19実測で確認済み)。
    useEffect(() => {
        useRenderPendingStore.getState().hide();
    }, [memberLayout]);

    // メモ・カーソルの横位置: 保存/送信は常にレーン表示の xRatio。スプシ表示では「読む=レーン→スプシ、書く=スプシ→レーン」に
    // 変換し、同じメンバーの列の中に収める(列の外=左の情報列は両表示で同じなのでそのまま)。
    const [memberStartPx, setMemberStartPx] = useState(0);
    const [scrollViewportW, setScrollViewportW] = useState(0);
    useLayoutEffect(() => {
        if (!isSheetView) return; // レーン表示では不要(余計な再描画を避ける)
        const containerEl = sheetContainerRef.current;
        const firstMemberEl = document.querySelector('[data-member-id]') as HTMLElement | null;
        if (!containerEl || !firstMemberEl) return;
        setMemberStartPx(firstMemberEl.getBoundingClientRect().left - containerEl.getBoundingClientRect().left);
        setScrollViewportW(scrollContainerRef.current?.clientWidth ?? 0);
    }, [memberLayout, isSheetView, sheetWidth, scrollContainerRef, sheetContainerRef]);
    const memberXMap = useMemo(() => {
        if (!isSheetView) {
            return {
                toPx: (r: number) => xRatioToPx(r, sheetWidth),
                toRatio: (px: number) => pxToXRatio(px, sheetWidth),
            };
        }
        const { thW, dpsW, padX } = readLanesColumnVars();
        const lanes = lanesBands(visiblePartyMembers, memberStartPx, thW, dpsW, padX);
        const sheet = sheetBands(visiblePartyMembers, memberLayout);
        const lanesWidth = lanesSheetWidth(scrollViewportW, sheetWidth);
        return {
            toPx: (r: number) => convertMemberX(r * lanesWidth, lanes, sheet),
            toRatio: (px: number) => (lanesWidth > 0 ? convertMemberX(px, sheet, lanes) / lanesWidth : 0),
        };
    }, [isSheetView, visiblePartyMembers, memberStartPx, memberLayout, sheetWidth, scrollViewportW]);
    memberXMapRef.current = memberXMap;
    return { memberHeaderRefs, getMemberRefCallback, memberLayout, memberStartPx, scrollViewportW, memberXMap };
}

interface UseTimelineHoverGeomArgs {
    isSheetView: boolean;
    visiblePartyMembers: PartyMember[];
    memberLayout: ReturnType<typeof useMeasuredMemberLayout>;
    sheetColumnMap: ReadonlyMap<string, SheetColumn[]> | null;
    rowLayout: RowLayout;
    memberXMap: { toPx: (xRatio: number) => number; toRatio: (px: number) => number };
    sheetWidthRef: MutableRefObject<number>;
}

/** ⑦ ホバー強調とカーソル送信が読む最新の幾何(描画中に ref へ書く) */
export function useTimelineHoverGeom({
    isSheetView, visiblePartyMembers, memberLayout, sheetColumnMap, rowLayout, memberXMap, sheetWidthRef,
}: UseTimelineHoverGeomArgs) {
    // ホバー強調(TableHoverHighlight)が pointermove で読む最新の幾何
    const hoverGeomRef = useRef<HoverGeom>({ mode: 'lanes', bands: [], columnMap: null, layout: EMPTY_ROW_LAYOUT });
    hoverGeomRef.current = {
        mode: isSheetView ? 'sheet' : 'lanes',
        // レーン表示の memberLayout は列の内側(左右の余白 padX を除いた幅)なので、帯は余白ぶん広げてセル全体に合わせる
        bands: isSheetView
            ? sheetBands(visiblePartyMembers, memberLayout)
            : (() => { const padX = readLanesColumnVars().padX; return sheetBands(visiblePartyMembers, memberLayout).map(b => ({ ...b, left: b.left - padX, width: b.width + padX * 2 })); })(),
        columnMap: sheetColumnMap,
        layout: rowLayout,
    };
    // レーン表示は従来どおり rAF 内で最新の sheetWidthRef を読む。スプシ表示だけ列変換。
    const cursorToLocalXRef = useRef(memberXMap.toPx);
    cursorToLocalXRef.current = isSheetView
        ? memberXMap.toPx
        : (r: number) => xRatioToPx(r, sheetWidthRef.current);
    return { hoverGeomRef, cursorToLocalXRef };
}
