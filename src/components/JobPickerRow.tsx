import React from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import type { TFunction } from 'i18next';
import type { Job, PartyMember } from '../types';
import { useMitigationStore } from '../store/useMitigationStore';
import { getColumnCssVar } from '../utils/calculator';
import { Tooltip } from './ui/Tooltip';

interface JobPickerRowProps {
    partyMembers: PartyMember[];
    partySortOrder: 'role' | 'light_party';
    /** jobId → icon url の解決関数 (Timeline.tsx 内 getJobIcon と整合) */
    getJobIcon: (jobId: string | null) => string | null;
    /** JOBS (現状未使用だが将来の拡張用に保持) */
    jobs: Job[];
    /** メンバーアイコンクリック時 (= JobPicker モーダルを開く) */
    handleJobIconClick: (memberId: string, e: React.MouseEvent) => void;
    /** メンバーセルの ref を取得する callback factory */
    getMemberRefCallback: (id: string) => (el: HTMLDivElement | null) => void;
    t: TFunction;
}

/**
 * controlBar の右端に配置される「ジョブ選択行」。
 *
 * 旧 (セッション 17 以前): ヘッダー (header) のメンバー列に直接ジョブアイコンを表示していた。
 * 新 (セッション 18, 案 C1): ジョブアイコンを controlBar に物理移動。
 * ヘッダーのメンバー列領域はリキャストアイコン専用 (RecastRow) に。
 *
 * DOM 構造はヘッダー時代と完全に同等 (テスト/CSS/Ref を破壊しない目的):
 * - data-member-id / data-member-role
 * - role / light_party 用 gradient bg
 * - クリックで JobPicker、 右クリックでジョブクリア
 */
export const JobPickerRow: React.FC<JobPickerRowProps> = ({
    partyMembers,
    partySortOrder,
    getJobIcon,
    handleJobIconClick,
    getMemberRefCallback,
    t,
}) => {
    return (
        <>
            {partyMembers.map((member, index) => (
                <div
                    key={member.id}
                    ref={getMemberRefCallback(member.id)}
                    data-member-id={member.id}
                    data-member-role={member.role}
                    style={{
                        width: getColumnCssVar(member.role),
                        minWidth: getColumnCssVar(member.role),
                        maxWidth: getColumnCssVar(member.role),
                        paddingLeft: 'var(--col-member-pad-x)',
                        paddingRight: 'var(--col-member-pad-x)',
                    }}
                    className={clsx(
                        "hidden md:flex flex-none border-r border-app-border h-full flex-col items-center justify-center p-0.5 relative group",
                        index === partyMembers.length - 1 && "border-r border-app-border",
                        partySortOrder === 'role' ? (
                            member.role === 'tank' ? "bg-gradient-to-b from-blue-600/20 via-blue-600/5 to-transparent shadow-[inset_0_1px_0_rgba(37,99,235,0.5)]" :
                                member.role === 'healer' ? "bg-gradient-to-b from-green-500/20 via-green-500/5 to-transparent shadow-[inset_0_1px_0_rgba(34,197,94,0.5)]" :
                                    "bg-gradient-to-b from-red-500/20 via-red-500/5 to-transparent shadow-[inset_0_1px_0_rgba(239,68,68,0.5)]"
                        ) : (
                            ['MT', 'H1', 'D1', 'D3'].includes(member.id)
                                ? "bg-gradient-to-b from-blue-500/20 via-blue-600/5 to-transparent shadow-[inset_0_1px_0_rgba(59,130,246,0.5)]"
                                : "bg-gradient-to-b from-cyan-500/20 via-cyan-600/5 to-transparent shadow-[inset_0_1px_0_rgba(6,182,212,0.5)]"
                        )
                    )}
                >
                    <Tooltip content={member.jobId ? `${member.id} — ${t('ui.change_job_tooltip')}` : `${member.id} (${t('ui.change_job')})`} position="bottom" wrapperClassName="w-full h-full">
                        <div
                            className={clsx(
                                "flex items-center justify-center w-full h-full rounded cursor-pointer transition-all duration-300 relative"
                            )}
                            onClick={(e) => handleJobIconClick(member.id, e)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                if (!member.jobId) return;
                                useMitigationStore.getState().setMemberJob(member.id, null);
                            }}
                        >
                            {member.jobId ? (
                                <img src={getJobIcon(member.jobId) || ''} alt={member.jobId} className="w-6 h-6 object-contain opacity-90 drop-shadow-sm transition-transform group-hover:scale-125" />
                            ) : (
                                <div className="w-5 h-5 rounded-full border border-app-border bg-app-surface2 flex items-center justify-center hover:bg-app-surface2">
                                    <Plus size={10} className="text-app-text-muted" />
                                </div>
                            )}
                        </div>
                    </Tooltip>
                </div>
            ))}
        </>
    );
};
JobPickerRow.displayName = 'JobPickerRow';
