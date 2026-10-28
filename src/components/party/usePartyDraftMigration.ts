import React, { useState } from 'react';
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside';
import { useTutorialStore } from '../../store/useTutorialStore';
import { migrateMitigations } from '../../utils/jobMigration';
import type { MigrationMode } from '../../utils/jobMigration';
import type { Job, PartyMember, AppliedMitigation } from '../../types';
import { useMitigationStore } from '../../store/useMitigationStore';

interface UsePartyDraftMigrationArgs {
    isOpen: boolean;
    onClose: () => void;
    JOBS: Job[];
    partyMembers: PartyMember[];
    timelineMitigations: AppliedMitigation[];
    updatePartyBulk: (updates: { memberId: string; jobId: string | null; mitigations?: AppliedMitigation[] }[]) => void;
    popoverRef: React.RefObject<HTMLDivElement | null>;
    setFocusedSlot: React.Dispatch<React.SetStateAction<number | null>>;
}

/** パーティ設定の下書きメンバー・閉じる時の確認(ジョブ変更の移行バッチ)・閉じ操作(背景/Enter/Escape)。 */
export function usePartyDraftMigration({
    isOpen, onClose, JOBS, partyMembers, timelineMitigations, updatePartyBulk, popoverRef, setFocusedSlot,
}: UsePartyDraftMigrationArgs) {
    // Draft state for party members
    const [draftMembers, setDraftMembers] = useState<PartyMember[]>([]);

    // Batch Migration State
    const [migrationBatch, setMigrationBatch] = useState<{
        memberName: string;
        oldJob: Job | null;
        newJob: Job;
        memberId: string;
    }[] | null>(null);

    // Set draft members when the modal opens
    React.useEffect(() => {
        if (isOpen) {
            setDraftMembers(JSON.parse(JSON.stringify(partyMembers))); // Simple deep copy for draft
        }
    }, [isOpen, partyMembers]);

    const handleAttemptClose = React.useCallback(() => {
        // チュートリアル中はTutorialBlockerがクリック制御するため、ここでは閉じを許可
        // （completeEvent('party:closed')で進行通知）

        if (migrationBatch) return;

        const pendingMigrations: { memberName: string; oldJob: Job | null; newJob: Job; memberId: string }[] = [];
        const safeChanges: { memberId: string; jobId: string | null }[] = [];

        draftMembers.forEach(draftMember => {
            const originalMember = partyMembers.find(m => m.id === draftMember.id);
            if (!originalMember) return;

            if (originalMember.jobId !== draftMember.jobId) {
                const hasMitigations = timelineMitigations.some(m => m.ownerId === draftMember.id);
                if (hasMitigations && originalMember.jobId && draftMember.jobId) {
                    const oldJob = JOBS.find(j => j.id === originalMember.jobId) || null;
                    const newJob = JOBS.find(j => j.id === draftMember.jobId)!;
                    pendingMigrations.push({
                        memberName: draftMember.id,
                        memberId: draftMember.id,
                        oldJob,
                        newJob
                    });
                } else {
                    safeChanges.push({ memberId: draftMember.id, jobId: draftMember.jobId });
                }
            }
        });

        // Apply safe changes immediately if there are no pending migrations
        if (pendingMigrations.length === 0) {
            if (safeChanges.length > 0) {
                updatePartyBulk(safeChanges.map(c => ({ memberId: c.memberId, jobId: c.jobId! })));
            }
            // ── Tutorial: Complete Step 5 ──
            useTutorialStore.getState().completeEvent('party:closed');
            onClose();
        } else {
            // Unsafe changes
            setMigrationBatch(pendingMigrations);
        }
    }, [JOBS, partyMembers, draftMembers, timelineMitigations, migrationBatch, onClose, updatePartyBulk]);

    // ①：画面が完全に閉じた時だけ、状態をリセットする（点滅バグの防止）
    React.useEffect(() => {
        if (!isOpen) {
            setFocusedSlot(null);
            setMigrationBatch(null);
        }
    }, [isOpen, setFocusedSlot]);


    // ②：背景クリック(外側を押す)の検知。移行確認の窓(portal で外に出る)が開いている間は検知しない
    // (窓の中を押して click が止められると確認ボタンが効かなくなる)
    useDismissOnOutside(isOpen && !migrationBatch, handleAttemptClose, [popoverRef]);

    // ②：Enter / Escapeキーの検知
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
                handleAttemptClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleAttemptClose]);

    // Protected Migration Handlers for Batch Process
    const handleBatchMigrationConfirm = (mode: MigrationMode) => {
        if (!migrationBatch) return;

        const bulkUpdates: { memberId: string, jobId: string | null, mitigations?: AppliedMitigation[] }[] = [];

        // Add any safe changes first
        draftMembers.forEach(draftMember => {
            const originalMember = partyMembers.find(m => m.id === draftMember.id);
            if (originalMember && originalMember.jobId !== draftMember.jobId && !migrationBatch.some(b => b.memberId === draftMember.id)) {
                bulkUpdates.push({ memberId: draftMember.id, jobId: draftMember.jobId });
            }
        });

        // Add migrated changes
        migrationBatch.forEach(({ memberId, oldJob, newJob }) => {
            const memberMitis = useMitigationStore.getState().timelineMitigations.filter(m => m.ownerId === memberId);
            const newMitis = migrateMitigations(oldJob?.id || '', newJob.id, memberId, memberMitis, mode);
            bulkUpdates.push({ memberId, jobId: newJob.id, mitigations: newMitis });
        });

        updatePartyBulk(bulkUpdates);

        setMigrationBatch(null);
        onClose();
    };

    const handleBatchMigrationCancel = () => {
        setMigrationBatch(null);
    };

    return { draftMembers, setDraftMembers, migrationBatch, handleAttemptClose, handleBatchMigrationConfirm, handleBatchMigrationCancel };
}
