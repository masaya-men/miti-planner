import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { useJobs } from '../hooks/useSkillsData';
import { X, Star, Eye } from 'lucide-react';
import clsx from 'clsx';
import { JobMigrationModal } from './JobMigrationModal';
import { migrateMitigations } from '../utils/jobMigration';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useHaptic } from '../hooks/useHaptic';
import { SCALE } from '../tokens/motionTokens';
import type { MigrationMode } from '../utils/jobMigration';
import type { Job } from '../types';
import { PARTY_MEMBER_IDS } from '../constants/party';
import { createPortal } from 'react-dom';
import { PartySlot } from './party/MobilePartySlot';
import { createMobileSmartAssign } from './party/createMobileSmartAssign';

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
    const myJobHighlight = useMitigationStore(s => s.myJobHighlight);
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

    // handleJobChange が最新の軽減配置・ジョブ一覧を読むため、毎回作り直す(useCallback にしない)
    const handleDrop = (job: Job, targetId: string) => {
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
    };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drag は毎回作り直されるオブジェクト。ドラッグ中フラグと移動・対象設定の関数が変わった時だけ作り直す
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
    const handleSmartAssign = createMobileSmartAssign({ JOBS, focusedSlot, sortedMembers, setMemberJob, handleJobChange, lastMeleeSlotRef });


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
                        ? "bg-app-amber text-black border-app-amber"
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

            {/* 自ジョブ行ハイライト トグル（旧ボトムナビ MY JOB の代替・スマホはトグルで提供） */}
            <button
                type="button"
                role="switch"
                aria-checked={myJobHighlight}
                onClick={() => useMitigationStore.getState().setMyJobHighlight(!myJobHighlight)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-app-border text-app-text hover:bg-app-text/10 active:scale-[0.98] transition-all cursor-pointer"
            >
                <Eye size={16} className={myJobHighlight ? "text-app-text" : "text-app-text/50"} />
                <span className="text-app-base font-semibold">{t('party.highlight_my_job', '自分のジョブをハイライト')}</span>
                <span
                    className={clsx(
                        "ml-auto relative inline-flex shrink-0 rounded-full transition-colors duration-200",
                        myJobHighlight ? "bg-app-text" : "bg-app-text/25"
                    )}
                    style={{ width: 40, height: 24 }}
                >
                    <span
                        className="absolute rounded-full bg-app-bg transition-transform duration-200"
                        style={{
                            width: 18,
                            height: 18,
                            top: 3,
                            left: 3,
                            transform: myJobHighlight ? 'translateX(16px)' : 'translateX(0)',
                        }}
                    />
                </span>
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
                                <div className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 bg-app-amber rounded-full flex items-center justify-center">
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

