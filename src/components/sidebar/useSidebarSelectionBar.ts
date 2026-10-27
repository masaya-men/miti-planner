import React, { useState, useRef } from 'react';
import type { MultiSelectState } from '../../types/sidebarTypes';
import { useSmoothWheelScroll } from '../../lib/scroll/useSmoothWheelScroll';

export function useSidebarSelectionBar(multiSelect: MultiSelectState) {
    // 削除確認モーダル
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    // フローティングアクションバーの視線誘導アニメーション
    const floatingBarRef = useRef<HTMLDivElement>(null);
    const [floatingBarFlash, setFloatingBarFlash] = useState(false);
    const prevSelectedCount = useRef(multiSelect.selectedIds.length);
    // タブ別コンテンツリスト用 ref + スムーズスクロール
    const savageListRef = useRef<HTMLDivElement>(null);
    const ultimateListRef = useRef<HTMLDivElement>(null);
    const otherListRef = useRef<HTMLDivElement>(null);
    const archiveListRef = useRef<HTMLDivElement>(null);
    useSmoothWheelScroll(savageListRef);
    useSmoothWheelScroll(ultimateListRef);
    useSmoothWheelScroll(otherListRef);
    useSmoothWheelScroll(archiveListRef);
    React.useEffect(() => {
        const count = multiSelect.selectedIds.length;
        if (count !== prevSelectedCount.current && count > 0) {
            // ボーダーフラッシュ
            setFloatingBarFlash(true);
            const el = floatingBarRef.current;
            if (el) {
                el.style.borderColor = 'var(--color-app-text, #e8e8e8)';
                el.style.boxShadow = '0 8px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08)';
                setTimeout(() => {
                    el.style.borderColor = '';
                    el.style.boxShadow = '';
                }, 300);
            }
            setTimeout(() => setFloatingBarFlash(false), 350);
        }
        prevSelectedCount.current = count;
    }, [multiSelect.selectedIds.length]);

    return {
        showDeleteConfirm,
        setShowDeleteConfirm,
        floatingBarRef,
        floatingBarFlash,
        savageListRef,
        ultimateListRef,
        otherListRef,
        archiveListRef,
    };
}
