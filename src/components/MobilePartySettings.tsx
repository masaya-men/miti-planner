import React, { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { useJobs } from '../hooks/useSkillsData';
import { X, Star, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { JobMigrationModal } from './JobMigrationModal';
import { ConfirmDialog } from './ConfirmDialog';
import { migrateMitigations } from '../utils/jobMigration';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useHaptic } from '../hooks/useHaptic';
import { SCALE } from '../tokens/motionTokens';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
import type { MigrationMode } from '../utils/jobMigration';
import type { Job } from '../types';
import { PARTY_MEMBER_IDS } from '../constants/party';
import { createPortal } from 'react-dom';

// ── パーティスロット（長押しで削除） ──
const PartySlot: React.FC<{
    member: { id: string; jobId: string | null };
    job: Job | null;
    isFocused: boolean;
    isDropTarget: boolean;
    myJobMode: boolean;
    onTap: () => void;
    onLongPress: () => void;
}> = ({ member, job, isFocused, isDropTarget, myJobMode, onTap, onLongPress }) => {
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const movedRef = React.useRef(false);
    const startPosRef = React.useRef({ x: 0, y: 0 });

    const handlePointerDown = (e: React.TouchEvent | React.MouseEvent) => {
        if (!job) return;
        movedRef.current = false;
        const pos = 'touches' in e
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };
        startPosRef.current = pos;
        timerRef.current = setTimeout(() => {
            if (!movedRef.current) onLongPress();
        }, 400);
    };

    const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
        const pos = 'touches' in e
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };
        if (Math.abs(pos.x - startPosRef.current.x) > 8 || Math.abs(pos.y - startPosRef.current.y) > 8) {
            movedRef.current = true;
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        }
    };

    const handlePointerUp = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    React.useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    return (
        <div
            onClick={onTap}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            className={clsx(
                "flex flex-col items-center gap-1 p-2 border transition-all active:scale-95 relative cursor-pointer select-none",
                isDropTarget
                    ? "border-blue-400 bg-blue-400/15 ring-1 ring-blue-400"
                    : myJobMode
                        ? "border-app-text/50 bg-app-text/5"
                        : isFocused
                            ? "border-app-text bg-app-text/10"
                            : "border-app-border bg-app-surface2"
            )}
            style={{ borderRadius: MOBILE_TOKENS.party.slotRadius }}
        >
            {job ? (
                <img src={job.icon} className="w-8 h-8 object-contain pointer-events-none" />
            ) : (
                <div className="w-8 h-8 rounded-full border border-dashed border-app-border flex items-center justify-center">
                    <span className="text-app-base text-app-text-muted">+</span>
                </div>
            )}
            <span className="text-app-base font-black text-app-text">{member.id}</span>
        </div>
    );
};

// ── モバイル用パーティ編成UI ──
const MobilePartySettings: React.FC = () => {
    const { t } = useTranslation();
    const JOBS = useJobs();
    const partyMembers = useMitigationStore(s => s.partyMembers);
    const setMemberJob = useMitigationStore(s => s.setMemberJob);
    const updatePartyBulk = useMitigationStore(s => s.updatePartyBulk);
    const timelineMitigations = useMitigationStore(s => s.timelineMitigations);
    const myMemberId = useMitigationStore(s => s.myMemberId);
    const setMyMemberId = useMitigationStore(s => s.setMyMemberId);
    const [focusedSlot, setFocusedSlot] = React.useState<string | null>(null);
    const [myJobMode, setMyJobMode] = React.useState(false);

    // ジョブ変更マイグレーション用state
    const [migrationPending, setMigrationPending] = React.useState<{
        memberId: string;
        oldJob: Job | null;
        newJob: Job;
    } | null>(null);

    // D&D: ジョブアイコンからスロットへドラッグ
    const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const { vibrate } = useHaptic();

    const handleDrop = useCallback((job: Job, targetId: string) => {
        const member = partyMembers.find(m => m.id === targetId);
        if (!member) return;
        // スワップ: ドロップ先に既にジョブがある場合、同じジョブの別スロットと入れ替え
        const existingMember = partyMembers.find(m => m.jobId === job.id && m.id !== targetId);
        if (existingMember && member.jobId) {
            setMemberJob(existingMember.id, member.jobId);
        } else if (existingMember) {
            setMemberJob(existingMember.id, null as unknown as string);
        }
        handleJobChange(targetId, job.id);
    }, [partyMembers]);

    const drag = useDragAndDrop<Job>({ onDrop: handleDrop });

    // ドラッグ中にタッチ位置からスロットを判定
    const handleDragMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        drag.moveDrag(e);
        if (!drag.isDragging) return;
        const pos = 'touches' in e
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX, y: e.clientY };
        let found: string | null = null;
        slotRefs.current.forEach((el, id) => {
            const rect = el.getBoundingClientRect();
            if (pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top && pos.y <= rect.bottom) {
                found = id;
            }
        });
        drag.setActiveTarget(found);
    }, [drag.isDragging, drag.moveDrag, drag.setActiveTarget]);

    // スロットのジョブ除去（長押し）
    const handleRemoveJob = useCallback((memberId: string) => {
        vibrate('medium');
        setMemberJob(memberId, null as unknown as string);
    }, [setMemberJob, vibrate]);

    const sortedMembers = PARTY_MEMBER_IDS.map(id => partyMembers.find(m => m.id === id)).filter(Boolean) as typeof partyMembers;

    // ジョブ変更ハンドラ — 軽減がある場合はマイグレーション確認を表示
    const handleJobChange = (memberId: string, jobId: string) => {
        const member = partyMembers.find(m => m.id === memberId);
        if (!member) return;

        const newJob = JOBS.find(j => j.id === jobId);
        if (!newJob) return;

        // 既存ジョブがあり、かつ軽減が配置されている場合 → マイグレーション確認
        const hasMitigations = timelineMitigations.some(m => m.ownerId === memberId);
        if (hasMitigations && member.jobId && member.jobId !== jobId) {
            const oldJob = JOBS.find(j => j.id === member.jobId) || null;
            setMigrationPending({ memberId, oldJob, newJob });
            return;
        }

        // 軽減なし or 新規設定 → 直接変更
        setMemberJob(memberId, jobId);
        setFocusedSlot(null);
    };

    // スマート配置: focusedSlot があればそこに、なければロール別に最適スロットへ
    const lastMeleeSlotRef = useRef<string | null>(null);
    const MELEE_IDS = ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'];
    const PHYS_RANGED_IDS = ['brd', 'mch', 'dnc'];

    const handleSmartAssign = (jobId: string) => {
        const job = JOBS.find(j => j.id === jobId);
        if (!job) return;

        // Mode A: フォーカス中のスロットに直接配置
        if (focusedSlot) {
            handleJobChange(focusedSlot, jobId);
            return;
        }

        // Mode B: スマート配置（PC版と同じロジック）
        let targetId: string | undefined;

        if (job.role === 'tank') {
            const mtScore: Record<string, number> = { drk: 4, war: 3, pld: 2, gnb: 1 };
            const mtMember = sortedMembers.find(m => m.id === 'MT')!;
            const stMember = sortedMembers.find(m => m.id === 'ST')!;
            const currentMtJob = mtMember.jobId;
            const currentStJob = stMember.jobId;
            const isMtPreferred = (mtScore[jobId] ?? 0) >= 3;

            if (!currentMtJob && !currentStJob) {
                targetId = isMtPreferred ? 'MT' : 'ST';
            } else if (currentMtJob && !currentStJob) {
                if ((mtScore[jobId] ?? 0) > (mtScore[currentMtJob] ?? 0)) {
                    // 新ジョブの方がMT適性が高い → 現MTをSTに押し出してMTに配置
                    setMemberJob('ST', currentMtJob);
                    targetId = 'MT';
                } else {
                    targetId = 'ST';
                }
            } else if (!currentMtJob && currentStJob) {
                if ((mtScore[jobId] ?? 0) < (mtScore[currentStJob] ?? 0)) {
                    // 現STの方がMT適性が高い → 現STをMTに移動、新ジョブをSTに
                    setMemberJob('MT', currentStJob);
                    targetId = 'ST';
                } else {
                    targetId = 'MT';
                }
            } else {
                targetId = isMtPreferred ? 'MT' : 'ST';
            }
        } else if (job.role === 'healer') {
            const preferred = ['whm', 'ast'].includes(jobId)
                ? ['H1', 'H2'] : ['H2', 'H1'];
            targetId = preferred.find(id => !sortedMembers.find(m => m.id === id)?.jobId)
                ?? preferred[0];
        } else if (MELEE_IDS.includes(jobId)) {
            const d1 = sortedMembers.find(m => m.id === 'D1')!;
            const d2 = sortedMembers.find(m => m.id === 'D2')!;
            if (!d1.jobId && !d2.jobId) {
                targetId = 'D1';
            } else if (!d1.jobId) {
                targetId = 'D1';
            } else if (!d2.jobId) {
                targetId = 'D2';
            } else {
                targetId = lastMeleeSlotRef.current === 'D1' ? 'D2' : 'D1';
            }
            lastMeleeSlotRef.current = targetId;
        } else if (PHYS_RANGED_IDS.includes(jobId)) {
            targetId = !sortedMembers.find(m => m.id === 'D3')?.jobId ? 'D3'
                : !sortedMembers.find(m => m.id === 'D4')?.jobId ? 'D4' : 'D3';
        } else {
            // キャスター
            targetId = !sortedMembers.find(m => m.id === 'D4')?.jobId ? 'D4'
                : !sortedMembers.find(m => m.id === 'D3')?.jobId ? 'D3' : 'D4';
        }

        if (targetId) {
            handleJobChange(targetId, jobId);
        }
    };

    // マイグレーション確定
    const handleMigrationConfirm = (mode: MigrationMode) => {
        if (!migrationPending) return;
        const { memberId, oldJob, newJob } = migrationPending;
        const memberMitis = useMitigationStore.getState().timelineMitigations.filter(m => m.ownerId === memberId);
        const newMitis = migrateMitigations(oldJob?.id || '', newJob.id, memberId, memberMitis, mode);
        updatePartyBulk([{ memberId, jobId: newJob.id, mitigations: newMitis }]);
        setMigrationPending(null);
        setFocusedSlot(null);
    };

    // ロール別ジョブ分類（D&Dピッカー用）
    const jobsByRole = React.useMemo(() => {
        const groups: { role: string; jobs: Job[] }[] = [
            { role: 'tank', jobs: [] },
            { role: 'healer', jobs: [] },
            { role: 'dps', jobs: [] },
        ];
        for (const job of JOBS) {
            const g = groups.find(g => g.role === job.role);
            if (g) g.jobs.push(job);
        }
        return groups;
    }, [JOBS]);

    return (
        <div
            className="flex flex-col gap-3"
            onTouchMove={handleDragMove}
            onMouseMove={handleDragMove}
            onTouchEnd={drag.endDrag}
            onMouseUp={drag.endDrag}
        >
            {/* MY JOBモード切替 */}
            <button
                onClick={() => { setMyJobMode(!myJobMode); setFocusedSlot(null); }}
                className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-app-2xl font-bold transition-all cursor-pointer",
                    myJobMode
                        ? "bg-yellow-500 text-black border-yellow-500"
                        : "bg-app-surface2 border-app-border text-app-text"
                )}
            >
                <Star size={14} />
                {t('party.set_my_job', '自分のジョブを設定')}
                {myMemberId && !myJobMode && (
                    <span className="ml-auto text-app-base text-app-text-muted">
                        {myMemberId}
                    </span>
                )}
            </button>

            {myJobMode && (
                <p className="text-app-md text-app-text-muted px-1">
                    {t('party.my_job_tap_slot', '自分のスロットをタップしてください')}
                </p>
            )}

            {/* ドラッグヒント */}
            {!myJobMode && !focusedSlot && (
                <p className="text-app-sm text-app-text-muted/60 px-1 text-center">
                    {t('app.party_drag_hint')}
                </p>
            )}

            {/* スロット一覧（ドロップターゲット） */}
            <div className="grid grid-cols-4 gap-2">
                {sortedMembers.map(member => {
                    const job = member.jobId ? JOBS.find(j => j.id === member.jobId) : null;
                    const isMyJob = myMemberId === member.id;
                    const isFocused = focusedSlot === member.id;
                    const isDropTarget = drag.isDragging && drag.activeTargetId === member.id;

                    return (
                        <div
                            key={member.id}
                            ref={(el) => { if (el) slotRefs.current.set(member.id, el); }}
                            className="relative"
                            style={isDropTarget ? { transform: `scale(${SCALE.dropTarget})`, transition: 'transform 0.15s ease' } : { transition: 'transform 0.15s ease' }}
                        >
                            {isMyJob && (
                                <div className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                    <Star size={8} className="text-black fill-black" />
                                </div>
                            )}
                            <PartySlot
                                member={member}
                                job={job ?? null}
                                isFocused={isFocused}
                                isDropTarget={isDropTarget}
                                myJobMode={myJobMode}
                                onTap={() => {
                                    if (myJobMode) {
                                        setMyMemberId(isMyJob ? null : member.id);
                                        setMyJobMode(false);
                                    } else {
                                        setFocusedSlot(isFocused ? null : member.id);
                                    }
                                }}
                                onLongPress={() => handleRemoveJob(member.id)}
                            />
                        </div>
                    );
                })}
            </div>

            {/* フォーカス中ヒント */}
            {focusedSlot && !myJobMode && (
                <div className="flex items-center justify-between px-1">
                    <span className="text-app-base font-black text-app-text-muted uppercase tracking-wider">
                        {focusedSlot} — {t('jobs.select_job')}
                    </span>
                    <button onClick={() => setFocusedSlot(null)} className="text-app-text-muted p-1 cursor-pointer">
                        <X size={14} />
                    </button>
                </div>
            )}
            {/* ジョブパレット（タップでスマート配置 + D&Dソース） */}
            {!myJobMode && (
                <div className="grid grid-cols-7 gap-1.5">
                    {jobsByRole.flatMap(group => group.jobs).map(job => (
                        <button
                            key={job.id}
                            onClick={() => handleSmartAssign(job.id)}
                            onTouchStart={(e) => drag.startDrag(job, e)}
                            onMouseDown={(e) => drag.startDrag(job, e)}
                            className="aspect-square rounded-lg border border-app-border bg-app-surface2 flex items-center justify-center cursor-pointer active:scale-90 transition-all touch-none"
                        >
                            <img src={job.icon} alt={job.name?.ja} className="w-9 h-9 object-contain pointer-events-none" />
                        </button>
                    ))}
                </div>
            )}

            {/* ドラッグゴースト — MobileBottomSheetのtransformを回避するためportal化 */}
            {drag.isDragging && drag.item && createPortal(
                <div
                    className="fixed pointer-events-none z-[9999]"
                    style={{
                        left: drag.position.x - 24,
                        top: drag.position.y - 24,
                        transform: `scale(${SCALE.drag})`,
                    }}
                >
                    <div className="w-12 h-12 rounded-xl bg-app-surface2 border border-app-text/30 flex items-center justify-center shadow-lg shadow-black/40">
                        <img src={drag.item.icon} className="w-9 h-9 object-contain" />
                    </div>
                </div>,
                document.body
            )}

            {/* ジョブ変更マイグレーション確認モーダル */}
            {migrationPending && (
                <JobMigrationModal
                    isOpen={true}
                    oldJob={migrationPending.oldJob}
                    newJob={migrationPending.newJob}
                    memberName={migrationPending.memberId}
                    onConfirm={handleMigrationConfirm}
                    onCancel={() => setMigrationPending(null)}
                />
            )}
        </div>
    );
};

// ── モバイル用パーティ＋ステータスタブ ──
export const MobilePartyWithTabs: React.FC = () => (
    <MobilePartySettings />
);

// ── モバイル用アカウントメニュー（ログイン済み時） ──
export const MobileAccountMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const profileDisplayName = useAuthStore(s => s.profileDisplayName);
    const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);
    const signOut = useAuthStore((s) => s.signOut);
    const deleteAccount = useAuthStore((s) => s.deleteAccount);
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        onClose();
    };

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            await deleteAccount();
            onClose();
            navigate('/');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (!user) return null;

    return (
        <div className="flex flex-col gap-4">
            {/* ユーザー情報 */}
            <div className="flex items-center gap-3 px-1">
                {profileAvatarUrl ? (
                    <img
                        src={profileAvatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-app-border"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-app-surface2 border border-app-border flex items-center justify-center">
                        <span className="text-app-2xl font-bold text-app-text">
                            {(profileDisplayName || '?')[0]}
                        </span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-app-2xl font-bold text-app-text truncate">
                        {profileDisplayName || t('nav.account')}
                    </p>
                </div>
            </div>

            {/* ログアウトボタン */}
            <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-app-border text-app-2xl font-bold text-app-text bg-app-surface2 active:bg-app-text/10 transition-colors cursor-pointer"
            >
                <LogOut size={16} />
                {t('nav.logout')}
            </button>

            {/* アカウント削除（控えめ配置） */}
            <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-app-base text-app-text-muted/50 hover:text-app-text-muted transition-colors cursor-pointer py-1"
            >
                {t('nav.deleteAccount')}
            </button>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onConfirm={handleDeleteAccount}
                onCancel={() => setShowDeleteConfirm(false)}
                title={t('nav.deleteAccountTitle')}
                message={isDeleting ? '...' : t('nav.deleteAccountMessage')}
                confirmLabel={t('nav.deleteAccountConfirm')}
                variant="danger"
            />
        </div>
    );
};
