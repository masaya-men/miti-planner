import React from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import type { TFunction } from 'i18next';
import type { Job, PartyMember } from '../types';
import { useMitigationStore } from '../store/useMitigationStore';
import { getColumnCssVar } from '../utils/calculator';
import { Tooltip } from './ui/Tooltip';
import { useThemeStore } from '../store/useThemeStore';
import { getPhaseName } from '../types';
import { sheetMemberStyle } from './timeline/sheet/sheetStyle';
// 軍事専用部品は遅延読み込み(標準テーマに MIL-SPEC チャンクを配信しない)
const MilspecJackRow = React.lazy(() => import('./military/table/MilspecJackRow').then(m => ({ default: m.MilspecJackRow })));

export interface JobPickerRowProps {
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
    /** 'socket' = 軍事テーマの差込口(中身だけ差し替え。外側 div・ref・data 属性・クリックは同じ)。未指定 = 標準 */
    variant?: 'socket';
    /** スプシ表示: メンバー id → 列数。指定時は幅を「列数 × --sheet-col-w」にし、3 列以上ならジョブ名と位置も出す。未指定 = 従来 */
    sheetCols?: ReadonlyMap<string, number>;
}

/** スプシ表示の上段ラベル(ジョブ名 + 位置)。ジョブ名の言語は contentLanguage */
const SheetJobLabel: React.FC<{ job: Job | undefined; memberId: string }> = ({ job, memberId }) => {
    const contentLanguage = useThemeStore(s => s.contentLanguage);
    return (
        <>
            <span className="text-[10px] font-black text-app-text truncate">{job ? getPhaseName(job.name, contentLanguage) : ''}</span>
            <span className="text-[9px] font-mono text-app-text-muted">{memberId}</span>
        </>
    );
};

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
    variant,
    jobs,
    sheetCols,
}) => {
    if (variant === 'socket') {
        return <React.Suspense fallback={null}><MilspecJackRow partyMembers={partyMembers} partySortOrder={partySortOrder} getJobIcon={getJobIcon} jobs={jobs} handleJobIconClick={handleJobIconClick} getMemberRefCallback={getMemberRefCallback} t={t} sheetCols={sheetCols} /></React.Suspense>;
    }
    return (
        <>
            {partyMembers.map((member, index) => (
                <div
                    key={member.id}
                    ref={getMemberRefCallback(member.id)}
                    data-member-id={member.id}
                    data-member-role={member.role}
                    data-sheet-cols={sheetCols ? (sheetCols.get(member.id) ?? 0) : undefined}
                    style={sheetCols ? sheetMemberStyle(sheetCols.get(member.id) ?? 0) : {
                        width: getColumnCssVar(member.role),
                        minWidth: getColumnCssVar(member.role),
                        maxWidth: getColumnCssVar(member.role),
                        paddingLeft: 'var(--col-member-pad-x)',
                        paddingRight: 'var(--col-member-pad-x)',
                    }}
                    className={clsx(
                        "hidden md:flex flex-none border-r h-full flex-col items-center justify-center p-0.5 relative group",
                        sheetCols ? "border-app-text/20" : "border-app-border",
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
                                "flex items-center justify-center w-full h-full rounded cursor-pointer transition-all duration-300 relative",
                                sheetCols && "gap-1 overflow-hidden"
                            )}
                            onClick={(e) => handleJobIconClick(member.id, e)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                if (!member.jobId) return;
                                useMitigationStore.getState().setMemberJob(member.id, null);
                            }}
                        >
                            {member.jobId ? (
                                <>
                                    <img src={getJobIcon(member.jobId) || ''} alt={member.jobId} className={clsx("object-contain opacity-90 drop-shadow-sm transition-transform group-hover:scale-125", sheetCols ? "w-[18px] h-[18px] shrink-0" : "w-6 h-6")} />
                                    {sheetCols && (sheetCols.get(member.id) ?? 0) >= 3 && (
                                        <SheetJobLabel job={jobs.find(j => j.id === member.jobId)} memberId={member.id} />
                                    )}
                                </>
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
