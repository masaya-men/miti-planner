import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { TFunction } from 'i18next';
import type { Mitigation, PartyMember } from '../../types';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useSheetHiddenSkillsStore } from '../../store/useSheetHiddenSkillsStore';
import { validateMitigationPlacement } from '../../utils/resourceTracker';
import { resolveSeraphismMitigation } from '../../utils/scholarShieldRules';
import { buildSheetColumnMap, buildHiddenSheetColumnMap, sheetColumnAt, sheetColumnFromX, sheetColumnIndex, type SheetColumn } from './sheet/sheetColumns';
import type { SheetHiddenPopoverState } from './sheet/SheetHiddenPopover';
import type { SheetPopoverState } from './sheet/SheetTargetPopover';
import { sheetBands } from './sheet/memberX';
import { buildAppliedMitigation, resolveSheetTap } from './sheet/sheetTap';
import { canStackSameSecond } from '../../utils/sameSecondStack';

/*
 * スプシ表示まわりの状態。Timeline 本体から移したもの。
 * 本体の中で飛び地(上方・中ほど・memberLayout の前後)に散らばっていたため、
 * effect と描画中の ref 書き込みの相対順を保つよう、元の位置ごとに 4 つのフックへ割っている。
 * 本体では元と同じ位置で順に呼ぶこと(順序を入れ替えない)。
 */

type SheetToast = { message: string; n: number } | null;

/** ① 上方: 列マップ ref・トースト・小窓の state と、レーン表示へ戻したら小窓を閉じる effect */
export function useTimelineSheetViewState({ isSheetView }: { isSheetView: boolean }) {
    // スプシ表示: マスのクリック判定が読む列(下方の sheetColumnMap を毎 render 差し替え)・弾いたときのトースト・対象選択の小窓
    const sheetColumnMapRef = useRef<ReadonlyMap<string, SheetColumn[]> | null>(null);
    const [sheetToast, setSheetToast] = useState<SheetToast>(null);
    const [sheetPopover, setSheetPopover] = useState<SheetPopoverState | null>(null);
    // レーン表示へ切り替えたら小窓は閉じる(戻したときに再び出ないように)
    useEffect(() => { if (!isSheetView) setSheetPopover(null); }, [isSheetView]);
    return { sheetColumnMapRef, sheetToast, setSheetToast, sheetPopover, setSheetPopover };
}

interface UseTimelineSheetTapArgs {
    t: TFunction;
    MITIGATIONS: Mitigation[];
    readOnlyRef: RefObject<boolean>;
    sheetToast: SheetToast;
    setSheetToast: React.Dispatch<React.SetStateAction<SheetToast>>;
    sheetPopover: SheetPopoverState | null;
    setSheetPopover: React.Dispatch<React.SetStateAction<SheetPopoverState | null>>;
}

/** ② 中ほど: マス押下の処理・トーストの自動消去 effect・小窓の選択/閉じる。sheetTRef/sheetDefsRef は描画中に書く(元の位置のまま) */
export function useTimelineSheetTap({
    t, MITIGATIONS, readOnlyRef, sheetToast, setSheetToast, sheetPopover, setSheetPopover,
}: UseTimelineSheetTapArgs) {
    // スプシ表示のマス押下。クリックの基準は「そのメンバーのマス」の左端。効果帯(MitigationItem の data-mit-bar)から
    // 転送されたクリックは currentTarget が帯なので、同じ点の下にあるマス([data-sheet-cols])を引き直す。
    const sheetTRef = useRef(t);
    sheetTRef.current = t;
    const sheetDefsRef = useRef(MITIGATIONS);
    sheetDefsRef.current = MITIGATIONS;
    const handleSheetCellTap = useCallback((sheetMap: ReadonlyMap<string, SheetColumn[]>, memberId: string, time: number, e: React.MouseEvent) => {
        const cols = sheetMap.get(memberId);
        const target = e.currentTarget as HTMLElement | null;
        const cell = target?.hasAttribute?.('data-sheet-cols')
            ? target
            : (document.elementsFromPoint?.(e.clientX, e.clientY) ?? []).find(el => el.hasAttribute('data-sheet-cols')) as HTMLElement | undefined;
        if (!cols || !cell) return;
        const colIndex = sheetColumnAt(e.clientX, cell.getBoundingClientRect().left);
        const col = cols[colIndex];
        if (!col) return;
        const all = useMitigationStore.getState().timelineMitigations;
        const ownerMitigations = all.filter(m => m.ownerId === memberId);
        // もう一度押して消す: この列に描かれている配置(版違い・セラフィズム差し替えなど id が列と違うものも含む)
        const defs = sheetDefsRef.current;
        const existing = ownerMitigations.find(m => m.time === time && sheetColumnIndex(cols, m.mitigationId, defs) === colIndex);
        // 2 回分ためて相手を選ぶ技は消さずに相手選びへ(resolveSheetTap が selectTarget を返す・masaya 10-29)
        const existingDef = existing && defs.find(d => d.id === existing.mitigationId);
        if (existing && !(existingDef && canStackSameSecond(existingDef))) {
            useMitigationStore.getState().removeMitigation(existing.id);
            return;
        }
        // セラフィズム中は鼓舞激励の策→マニフェステーション等に差し替わる(レーン表示の MitigationSelector と同じ)
        const colDef = resolveSeraphismMitigation(col.def, time, ownerMitigations, defs);
        const r = resolveSheetTap(colDef, time, ownerMitigations, all, (k, o) => String(sheetTRef.current(k, o as never)));
        switch (r.kind) {
            case 'remove':
                useMitigationStore.getState().removeMitigation(r.id);
                return;
            case 'place':
                // 後ろ向きの重なり(warning)は通常表示と同じく置いて、競合の脈動・矢印に任せる
                useMitigationStore.getState().addMitigation(buildAppliedMitigation(colDef, time, memberId, { linkedMitigationId: r.linkedMitigationId }));
                return;
            case 'blocked':
                // 本当に置けない(レーン表示でも置けない)ときはトーストだけ。マスは揺らさない
                setSheetToast(prev => ({ message: r.message ?? sheetTRef.current('timeline.cannot_place_here'), n: (prev?.n ?? 0) + 1 }));
                return;
            case 'selectTarget':
            case 'selectShield':
                setSheetPopover({
                    memberId, time, def: colDef, kind: r.kind,
                    shields: r.kind === 'selectShield' ? r.shields : [],
                    x: e.clientX, y: e.clientY,
                });
                return;
        }
    }, [setSheetPopover, setSheetToast]);

    useEffect(() => {
        if (!sheetToast) return;
        const timer = setTimeout(() => setSheetToast(null), 2500);
        return () => clearTimeout(timer);
    }, [setSheetToast, sheetToast]);

    const handleSheetPopoverPick = useCallback((pick: { targetId?: string; linkedMitigationId?: string; removeId?: string }) => {
        if (sheetPopover && !readOnlyRef.current && pick.removeId) {
            useMitigationStore.getState().removeMitigation(pick.removeId);
        } else if (sheetPopover && !readOnlyRef.current) {
            // 小窓を開いている間に共同編集で別の配置が入った場合に備え、選んだ時点で配置可否を再判定する
            const own = useMitigationStore.getState().timelineMitigations.filter(m => m.ownerId === sheetPopover.memberId);
            const status = validateMitigationPlacement(sheetPopover.def, sheetPopover.time, own, (k, o) => String(sheetTRef.current(k, o as never)));
            if (!status.available && !status.conflictOverride) {
                setSheetToast(prev => ({ message: status.message ?? sheetTRef.current('timeline.cannot_place_here'), n: (prev?.n ?? 0) + 1 }));
            } else {
                useMitigationStore.getState().addMitigation(buildAppliedMitigation(sheetPopover.def, sheetPopover.time, sheetPopover.memberId, pick));
            }
        }
        setSheetPopover(null);
    }, [readOnlyRef, setSheetPopover, setSheetToast, sheetPopover]);
    const handleSheetPopoverClose = useCallback(() => setSheetPopover(null), [setSheetPopover]);

    return { handleSheetCellTap, handleSheetPopoverPick, handleSheetPopoverClose };
}

interface UseTimelineSheetColumnsArgs {
    isSheetView: boolean;
    visiblePartyMembers: PartyMember[];
    MITIGATIONS: Mitigation[];
    currentLevel: number;
    sheetColumnMapRef: MutableRefObject<ReadonlyMap<string, SheetColumn[]> | null>;
}

/** ③ memberLayout の前: 列マップ・隠した列・「+(数)」小窓。最後に sheetColumnMapRef を描画中に差し替える(元の位置のまま) */
export function useTimelineSheetColumns({
    isSheetView, visiblePartyMembers, MITIGATIONS, currentLevel, sheetColumnMapRef,
}: UseTimelineSheetColumnsArgs) {
    // スプシ表示: メンバー id → 列(軽減技)。列数の Map は参照を安定させる(TimelineRow の memo 比較は参照比較)
    // 列見出しで隠した技(全体で 1 つの設定・技 ID)。隠した列は表から外し、ジョブ欄の「+(数)」から再表示する
    const sheetHiddenIds = useSheetHiddenSkillsStore(s => s.hiddenIds);
    const sheetHiddenSet = useMemo(() => new Set(sheetHiddenIds), [sheetHiddenIds]);
    const sheetColumnMap = useMemo(
        () => isSheetView ? buildSheetColumnMap(visiblePartyMembers, MITIGATIONS, currentLevel, sheetHiddenSet) : null,
        [isSheetView, visiblePartyMembers, MITIGATIONS, currentLevel, sheetHiddenSet]
    );
    const sheetHiddenColumns = useMemo(
        () => isSheetView ? buildHiddenSheetColumnMap(visiblePartyMembers, MITIGATIONS, currentLevel, sheetHiddenSet) : undefined,
        [isSheetView, visiblePartyMembers, MITIGATIONS, currentLevel, sheetHiddenSet]
    );
    const [sheetHiddenPopover, setSheetHiddenPopover] = useState<SheetHiddenPopoverState | null>(null);
    const handleOpenSheetHidden = useCallback((memberId: string, e: React.MouseEvent) => {
        setSheetHiddenPopover({ memberId, x: e.clientX, y: e.clientY });
    }, []);
    const handleCloseSheetHidden = useCallback(() => setSheetHiddenPopover(null), []);
    const handleHideSheetColumn = useCallback((id: string) => {
        useSheetHiddenSkillsStore.getState().hide(id);
    }, []);
    const sheetCols = useMemo(
        () => sheetColumnMap ? new Map([...sheetColumnMap].map(([id, c]) => [id, c.length] as [string, number])) : undefined,
        [sheetColumnMap]
    );
    sheetColumnMapRef.current = sheetColumnMap;

    return {
        sheetColumnMap, sheetHiddenColumns, sheetHiddenPopover, setSheetHiddenPopover,
        handleOpenSheetHidden, handleCloseSheetHidden, handleHideSheetColumn, sheetCols,
    };
}

interface UseTimelineSheetHoverArgs {
    sheetContainerRef: RefObject<HTMLDivElement | null>;
    sheetColumnMap: ReadonlyMap<string, SheetColumn[]> | null;
    visiblePartyMembers: PartyMember[];
    memberLayout: ReadonlyMap<string, { left: number; width: number }>;
}

/** ④ memberLayout の後: マウスがある列の技のツールチップ用 state と pointer ハンドラ */
export function useTimelineSheetHover({
    sheetContainerRef, sheetColumnMap, visiblePartyMembers, memberLayout,
}: UseTimelineSheetHoverArgs) {
    // スプシ表示: マウスがある列の技(アイコン+名前)のツールチップ。状態は「どの列か」が変わった時だけ更新する
    // (列が同じ間の追従は SheetColumnTooltip が document の pointermove で位置だけ動かす)。マス 1 つずつの DOM は作らない
    const [sheetColHover, setSheetColHover] = useState<{ key: string; def: Mitigation; x: number; y: number } | null>(null);
    const handleSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!sheetColumnMap || e.pointerType === 'touch') return;
        const rect = sheetContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const hit = sheetColumnFromX(e.clientX, rect.left, sheetBands(visiblePartyMembers, memberLayout), sheetColumnMap);
        const key = hit ? `${hit.memberId}:${hit.column.mitigationId}` : null;
        setSheetColHover(prev => (prev?.key ?? null) === key ? prev : (hit ? { key: key!, def: hit.column.def, x: e.clientX, y: e.clientY } : null));
    };
    const handleSheetPointerLeave = () => setSheetColHover(null);
    return { sheetColHover, handleSheetPointerMove, handleSheetPointerLeave };
}
