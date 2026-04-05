import React from 'react';
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
import type { MigrationMode } from '../utils/jobMigration';
import type { Job } from '../types';
import { PARTY_MEMBER_IDS } from '../constants/party';

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

    return (
        <div className="flex flex-col gap-3">
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

            {/* スロット一覧 */}
            <div className="grid grid-cols-4 gap-2">
                {sortedMembers.map(member => {
                    const job = member.jobId ? JOBS.find(j => j.id === member.jobId) : null;
                    const isMyJob = myMemberId === member.id;
                    const isFocused = focusedSlot === member.id;

                    return (
                        <button
                            key={member.id}
                            onClick={() => {
                                if (myJobMode) {
                                    setMyMemberId(isMyJob ? null : member.id);
                                    setMyJobMode(false);
                                } else {
                                    setFocusedSlot(isFocused ? null : member.id);
                                }
                            }}
                            className={clsx(
                                "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 relative cursor-pointer",
                                myJobMode
                                    ? "border-app-text/50 bg-app-text/5"
                                    : isFocused
                                        ? "border-app-text bg-app-text/10"
                                        : "border-app-border bg-app-surface2"
                            )}
                        >
                            {job ? (
                                <img src={job.icon} className="w-8 h-8 object-contain" />
                            ) : (
                                <div className="w-8 h-8 rounded-full border border-dashed border-app-border flex items-center justify-center">
                                    <span className="text-app-base text-app-text-muted">+</span>
                                </div>
                            )}
                            <span className="text-app-base font-black text-app-text">{member.id}</span>
                            {isMyJob && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                    <Star size={8} className="text-black fill-black" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ジョブ選択グリッド（スロット選択時） */}
            {focusedSlot && !myJobMode && (
                <div className="bg-app-surface2/50 rounded-xl p-3 border border-app-border">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-app-base font-black text-app-text-muted uppercase tracking-wider">
                            {focusedSlot} — {t('party.select_job')}
                        </span>
                        <button onClick={() => setFocusedSlot(null)} className="text-app-text-muted p-1 cursor-pointer">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                        {JOBS.map(job => {
                            const isCurrentJob = partyMembers.find(m => m.id === focusedSlot)?.jobId === job.id;
                            return (
                                <button
                                    key={job.id}
                                    onClick={() => handleJobChange(focusedSlot, job.id)}
                                    className={clsx(
                                        "w-10 h-10 rounded-lg border flex items-center justify-center cursor-pointer active:scale-90 transition-all",
                                        isCurrentJob
                                            ? "bg-app-text/20 border-app-text"
                                            : "bg-app-surface2 border-app-border"
                                    )}
                                >
                                    <img src={job.icon} alt={job.name?.ja} className="w-7 h-7 object-contain" />
                                </button>
                            );
                        })}
                    </div>
                </div>
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

// ── モバイル用ステータス表示 ──
const MobileStatusView: React.FC = () => {
    const { t } = useTranslation();
    const JOBS = useJobs();
    const partyMembers = useMitigationStore(s => s.partyMembers);
    const myMemberId = useMitigationStore(s => s.myMemberId);

    const sortedMembers = PARTY_MEMBER_IDS.map(id => partyMembers.find(m => m.id === id)).filter(Boolean) as typeof partyMembers;

    return (
        <div className="flex flex-col gap-2">
            {sortedMembers.map(member => {
                const job = member.jobId ? JOBS.find(j => j.id === member.jobId) : null;
                const isMyJob = myMemberId === member.id;
                return (
                    <div key={member.id} className={clsx(
                        "flex items-center gap-3 px-3 py-2 rounded-xl border",
                        isMyJob ? "border-app-text/50 bg-app-text/5" : "border-app-border bg-app-surface2"
                    )}>
                        {job ? (
                            <img src={job.icon} className="w-6 h-6 object-contain shrink-0" />
                        ) : (
                            <div className="w-6 h-6 rounded-full border border-dashed border-app-border shrink-0" />
                        )}
                        <span className="text-app-md font-black text-app-text w-6">{member.id}</span>
                        <div className="flex-1 flex items-center gap-3 text-app-base text-app-text-muted font-mono">
                            <span>{t('party.hp_label', 'HP')} {member.stats?.hp?.toLocaleString() || '—'}</span>
                        </div>
                        {isMyJob && <Star size={12} className="text-yellow-500 fill-yellow-500 shrink-0" />}
                    </div>
                );
            })}
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
