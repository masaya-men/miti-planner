import { useEffect } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useMitigationStore } from '../../store/useMitigationStore';
import type { TimelineEvent } from '../../types';
import { matchesMobile } from '../../hooks/useIsMobile';

/*
 * キー操作の effect。Timeline 本体から移したもの。
 * 本体では他の effect の間に挟まっていたため、effect の相対順を保つよう元の位置ごとに 3 つのフックへ割っている。
 * 本体では元と同じ位置で呼ぶこと(順序を入れ替えない)。
 */

/** AA モード中に Escape キーで終了 */
export function useTimelineAaEscape({ isAaModeEnabled, setIsAaModeEnabled }: {
    isAaModeEnabled: boolean;
    setIsAaModeEnabled: Dispatch<SetStateAction<boolean>>;
}) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isAaModeEnabled) {
                setIsAaModeEnabled(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isAaModeEnabled, setIsAaModeEnabled]);
}

interface ShortcutKeysArgs {
    readOnlyRef: RefObject<boolean>;
    phaseDropdownOpen: boolean;
    gimmickDropdownOpen: boolean;
    setPhaseDropdownOpen: Dispatch<SetStateAction<boolean>>;
    setGimmickDropdownOpen: Dispatch<SetStateAction<boolean>>;
    setTimeInputOpen: Dispatch<SetStateAction<boolean>>;
    setMechanicSearchOpen: Dispatch<SetStateAction<boolean>>;
    handleTogglePhaseCollapse: () => void;
    handleToggleLabelCollapse: () => void;
}

/** 元に戻す/やり直し(Ctrl+Z など)と、単独キーのショートカット(P / Shift+P / T / L / Shift+L / A) */
export function useTimelineShortcutKeys({
    readOnlyRef, phaseDropdownOpen, gimmickDropdownOpen,
    setPhaseDropdownOpen, setGimmickDropdownOpen, setTimeInputOpen, setMechanicSearchOpen,
    handleTogglePhaseCollapse, handleToggleLabelCollapse,
}: ShortcutKeysArgs) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (readOnlyRef.current) return; // ⑤-3b: ジョイナー読み取り専用は undo/redo ショートカット無効
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            const key = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
                e.preventDefault();
                useMitigationStore.getState().undo();
            }
            if ((e.ctrlKey || e.metaKey) && key === 'z' && e.shiftKey) {
                e.preventDefault();
                useMitigationStore.getState().redo();
            }
            if ((e.ctrlKey || e.metaKey) && key === 'y') {
                e.preventDefault();
                useMitigationStore.getState().redo();
            }
            // 単独キーショートカット（PCのみ、Shiftは許可）
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (matchesMobile(window)) return;
            if (key === 'p' && e.shiftKey) {
                // Shift+P: フェーズ列の表示/非表示
                e.preventDefault();
                if (phaseDropdownOpen) setPhaseDropdownOpen(false);
                handleTogglePhaseCollapse();
            } else if (key === 'p' && !e.shiftKey) {
                // P: フェーズドロップダウン開閉
                e.preventDefault();
                setPhaseDropdownOpen(prev => !prev);
            } else if (key === 't') {
                e.preventDefault();
                setTimeInputOpen(prev => !prev);
            } else if (key === 'l' && e.shiftKey) {
                // Shift+L: ラベル列の表示/非表示
                e.preventDefault();
                if (gimmickDropdownOpen) setGimmickDropdownOpen(false);
                handleToggleLabelCollapse();
            } else if (key === 'l' && !e.shiftKey) {
                // L: ラベルドロップダウン開閉
                e.preventDefault();
                setGimmickDropdownOpen(prev => !prev);
            } else if (key === 'a') {
                e.preventDefault();
                setMechanicSearchOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- キー入力の登録はドロップダウン開閉が変わった時だけ張り直す。handleToggle* は毎回作り直される関数(中身は functional setState のみ)で、readOnlyRef と set* は安定
    }, [phaseDropdownOpen, gimmickDropdownOpen]);
}

interface EscapeKeysArgs {
    eventPopover: unknown;
    setEventPopover: Dispatch<SetStateAction<{ event: TimelineEvent; position: { x: number; y: number } } | null>>;
    clipboardEvent: unknown;
    setClipboardEvent: (event: null) => void;
    timelineSelectMode: unknown;
    setTimelineSelectMode: (v: null) => void;
    labelSelectMode: unknown;
    setLabelSelectMode: (v: null) => void;
    throttledUpdatePreview: (time: number | null) => void;
}

/** Escape で閉じる/取り消す 3 本: イベントポップオーバー・コピーモード・TL/ラベル選択モード */
export function useTimelineEscapeKeys({
    eventPopover, setEventPopover, clipboardEvent, setClipboardEvent,
    timelineSelectMode, setTimelineSelectMode, labelSelectMode, setLabelSelectMode,
    throttledUpdatePreview,
}: EscapeKeysArgs) {
    // イベントポップオーバー: Escapeで閉じる
    useEffect(() => {
        if (!eventPopover) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setEventPopover(null);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [eventPopover, setEventPopover]);

    // コピーモード: Escapeでキャンセル
    useEffect(() => {
        if (!clipboardEvent) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setClipboardEvent(null);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [clipboardEvent, setClipboardEvent]);

    // TL選択モード: Escapeでキャンセル
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (timelineSelectMode) {
                    setTimelineSelectMode(null);
                    throttledUpdatePreview(null);
                }
                if (labelSelectMode) {
                    setLabelSelectMode(null);
                    throttledUpdatePreview(null);
                }
            }
        };
        if (timelineSelectMode || labelSelectMode) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [timelineSelectMode, labelSelectMode, throttledUpdatePreview, setTimelineSelectMode, setLabelSelectMode]);
}
