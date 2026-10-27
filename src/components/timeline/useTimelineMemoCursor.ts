import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { TFunction } from 'i18next';
import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import { useCursorSendStore } from '../../store/useCursorSendStore';
import type { PlanMemo } from '../../types';
import { MEMO_LIMITS } from '../../types/firebase';
import { showToast } from '../Toast';
import { yToTimeSec, timeSecToY, clampXRatio } from '../Memo/coords';
import { memoCreateXRatio } from './sheet/memberX';

interface MemberXMapRef {
    toPx: (xRatio: number) => number;
    toRatio: (px: number) => number;
}

interface UseTimelineMemoArgs {
    sheetContainerRef: RefObject<HTMLDivElement | null>;
    timeToYMapRef: RefObject<Map<number, number>>;
    memberXMapRef: RefObject<MemberXMapRef>;
    readOnlyRef: RefObject<boolean>;
    isMemoMode: boolean;
    memos: PlanMemo[];
    isSheetView: boolean;
    sheetWidth: number;
    t: TFunction;
}

/**
 * メモの入力状態と、保存・ドラッグ確定・削除・クリック(新規/編集)の各ハンドラ。
 * Timeline 本体から移したもの(元と同じ位置で呼ぶ。座標計算は元のまま)。
 */
export function useTimelineMemo({
    sheetContainerRef, timeToYMapRef, memberXMapRef, readOnlyRef,
    isMemoMode, memos, isSheetView, sheetWidth, t,
}: UseTimelineMemoArgs) {
    // メモ入力状態 (新規 = editingId 無し / 編集 = editingId + initialText)
    const [memoInput, setMemoInput] = useState<{
        topPx: number;
        leftPx: number;
        timeSec: number;
        xRatio: number;
        editingId?: string;
        initialText?: string;
    } | null>(null);

    // メモ: PlanData.memos へ反映 (markDirty は updatePlan が自動で行う)
    const reflectMemosToPlan = useCallback(() => {
        const planId = usePlanStore.getState().currentPlanId;
        if (!planId) return;
        const newMemos = useMitigationStore.getState().memos;
        const plan = usePlanStore.getState().getPlan(planId);
        if (!plan) return;
        usePlanStore.getState().updatePlan(planId, {
            data: { ...plan.data, memos: newMemos },
        });
    }, []);

    // メモ: シートクリック → 新規入力ボックス表示
    const handleSheetClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isMemoMode) return;
        // 軽減アイコン (cursor-grab) / ボタン / リンク / 入力欄 / 既存メモ 上のクリックは無視
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, textarea, .cursor-grab, .plan-memo')) return;
        if (memos.length >= MEMO_LIMITS.MAX_MEMOS_PER_PLAN) {
            showToast(t('memo.limit_reached', { max: MEMO_LIMITS.MAX_MEMOS_PER_PLAN }));
            return;
        }
        const rect = sheetContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const xPx = e.clientX - rect.left;
        // メモゾーン = メンバー列のみ。 メンバー列の左端を DOM 上の `[data-member-id]` 要素から取得
        // (CSS 変数は calc/clamp 式で getComputedStyle が文字列のまま返すため px 数値で読めない)。
        const firstMemberEl = document.querySelector('[data-member-id]') as HTMLElement | null;
        if (firstMemberEl) {
            const memberRect = firstMemberEl.getBoundingClientRect();
            const memoZoneLeftPx = memberRect.left - rect.left;
            if (xPx < memoZoneLeftPx) return;
        }
        // `[data-member-id]` 要素が見つからない場合 (= ジョブ未配置 等) はガードなし = シート全体許可
        // sheetContainerRef は scrollContainerRef の内部 relative div なので、
        // e.clientY - rect.top は既に sheet 内の絶対座標 (= スクロール反映済み)。
        // scrollTop を加算すると二重加算になる。
        const yPx = e.clientY - rect.top;
        // y → timeSec を timeToYMap 逆引き (動的高さ対応)
        const timeSec = yToTimeSec(yPx, timeToYMapRef.current);
        if (timeSec === null) return;  // シート範囲外、 メモ作成不可
        const xRatio = clampXRatio(memoCreateXRatio(xPx, rect.width, isSheetView, memberXMapRef.current.toRatio));
        // 入力ボックスは position: fixed で body 直下に portal するため、
        // 位置はビューポート基準 (クリック座標そのもの) で渡す (画面端クリップ対策)。
        setMemoInput({
            topPx: e.clientY,
            leftPx: e.clientX,
            timeSec,
            xRatio,
        });
    }, [isMemoMode, memos.length, t, isSheetView]);

    // メモ: InputBox の保存ハンドラ (新規 = addMemo、 編集 = updateMemo or 空文字で deleteMemo)
    const handleMemoSave = useCallback((text: string) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (!memoInput) return;
        const trimmed = text.trim();
        if (memoInput.editingId) {
            // 編集モード
            if (!trimmed) {
                // 空文字確定 = 削除 (spec §4.5 確認なし)
                useMitigationStore.getState().deleteMemo(memoInput.editingId);
            } else {
                useMitigationStore.getState().updateMemo(memoInput.editingId, { text: trimmed });
            }
            reflectMemosToPlan();
        } else {
            // 新規作成
            if (!trimmed) {
                setMemoInput(null);
                return;
            }
            const ok = useMitigationStore.getState().addMemo({
                text: trimmed,
                timeSec: memoInput.timeSec,
                xRatio: memoInput.xRatio,
            });
            if (!ok) {
                showToast(t('memo.limit_reached', { max: MEMO_LIMITS.MAX_MEMOS_PER_PLAN }));
            } else {
                reflectMemosToPlan();
            }
        }
        setMemoInput(null);
    }, [memoInput, t, reflectMemosToPlan]);

    // メモ: DnD 確定 (pointerup) → 座標更新 + Plan へ反映
    const handleMemoDragEnd = useCallback((id: string, coords: { timeSec: number; xRatio: number }) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        useMitigationStore.getState().updateMemo(id, coords);
        reflectMemosToPlan();
    }, [reflectMemosToPlan]);

    // メモ: 右クリック → 1 件削除 (確認なし、 spec §4.5 誤操作リスク低)
    const handleMemoDelete = useCallback((id: string) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        useMitigationStore.getState().deleteMemo(id);
        reflectMemosToPlan();
    }, [reflectMemosToPlan]);

    // メモ: 既存メモクリック → 編集モードで InputBox を開く
    const handleMemoClick = useCallback((memo: PlanMemo) => {
        if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用
        if (!isMemoMode) return;
        // 既存メモの位置はシート相対 → 入力ボックスは position: fixed(body直下)なので
        // sheetContainerRef の実画面位置を足してビューポート基準に変換する。
        const sheetRect = sheetContainerRef.current?.getBoundingClientRect();
        const topPx = timeSecToY(memo.timeSec, timeToYMapRef.current) + (sheetRect?.top ?? 0);
        const leftPx = memberXMapRef.current.toPx(memo.xRatio) + (sheetRect?.left ?? 0);
        setMemoInput({
            topPx,
            leftPx,
            timeSec: memo.timeSec,
            xRatio: memo.xRatio,
            editingId: memo.id,
            initialText: memo.text,
        });
    }, [isMemoMode, sheetWidth]);

    return { memoInput, setMemoInput, reflectMemosToPlan, handleSheetClick, handleMemoSave, handleMemoDragEnd, handleMemoDelete, handleMemoClick };
}

interface UseTimelineCursorSendArgs {
    sheetContainerRef: RefObject<HTMLDivElement | null>;
    timeToYMapRef: RefObject<Map<number, number>>;
    memberXMapRef: RefObject<MemberXMapRef>;
    myCursorEnabled: boolean;
    sheetWidth: number;
}

/**
 * 自分のカーソル送信(pointermove は ref に書くだけ・~15Hz の rAF で変換して P2P broadcast)。
 * Timeline 本体から移したもの。effect の位置は元と同じ(本体側で同じ箇所から呼ぶ)。
 */
export function useTimelineCursorSend({
    sheetContainerRef, timeToYMapRef, memberXMapRef, myCursorEnabled, sheetWidth,
}: UseTimelineCursorSendArgs) {
    // ④-b-2: 自分のカーソル送信。pointermove は ref に書くだけ(setState しない)。
    // ~15Hz の rAF 間引きで (timeSec,xRatio) に変換し、前回から動いた時だけ P2P broadcast。
    // cursorEnabled が ON のときだけリスナと送信ループを張る(OFF=送信ゼロ=IP 露出ゼロ)。
    const lastCursorPointer = useRef<{ x: number; y: number } | null>(null);
    const lastCursorSent = useRef<{ timeSec: number; xRatio: number } | null>(null);
    useEffect(() => {
        if (!myCursorEnabled) return;
        const container = sheetContainerRef.current;
        if (!container) return;
        const onMove = (e: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            lastCursorPointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };
        container.addEventListener('pointermove', onMove);
        const SEND_MS = 66; // ~15Hz
        let raf = 0;
        let lastT = 0;
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (now - lastT < SEND_MS) return;
            lastT = now;
            const { broadcast, localClientId } = useCursorSendStore.getState();
            if (localClientId == null) return;
            const lp = lastCursorPointer.current;
            let pos: { timeSec: number; xRatio: number } | null = null;
            if (lp) {
                const timeSec = yToTimeSec(lp.y, timeToYMapRef.current);
                pos = timeSec === null ? null : { timeSec, xRatio: clampXRatio(memberXMapRef.current.toRatio(lp.x)) };
            }
            const prev = lastCursorSent.current;
            const changed = !prev || !pos || prev.timeSec !== pos.timeSec || prev.xRatio !== pos.xRatio;
            if (changed) {
                lastCursorSent.current = pos;
                broadcast({ clientId: localClientId, pos, t: now });
            }
        };
        raf = requestAnimationFrame(loop);
        return () => {
            container.removeEventListener('pointermove', onMove);
            cancelAnimationFrame(raf);
        };
    }, [myCursorEnabled, sheetWidth]);
}
