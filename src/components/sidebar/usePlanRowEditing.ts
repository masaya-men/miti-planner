import React from 'react';
import { usePlanStore } from '../../store/usePlanStore';

/** サイドバーのプラン行の「名前をその場で編集」と「削除の 2 段階確認」の状態 */
export function usePlanRowEditing() {
    const updatePlan = usePlanStore(s => s.updatePlan);
    // プラン名インライン編集
    const [editingPlanId, setEditingPlanId] = React.useState<string | null>(null);
    const [editingTitle, setEditingTitle] = React.useState('');
    const editInputRef = React.useRef<HTMLInputElement>(null);

    // 削除確認ステート
    const [confirmDeletePlanId, setConfirmDeletePlanId] = React.useState<string | null>(null);

    const startEditing = (planId: string, title: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPlanId(planId);
        setEditingTitle(title);
        setTimeout(() => editInputRef.current?.select(), 0);
    };

    const finishEditing = () => {
        if (editingPlanId && editingTitle.trim()) {
            updatePlan(editingPlanId, { title: editingTitle.trim() });
        }
        setEditingPlanId(null);
    };

    return {
        editingPlanId, setEditingPlanId, editingTitle, setEditingTitle, editInputRef,
        confirmDeletePlanId, setConfirmDeletePlanId, startEditing, finishEditing,
    };
}
