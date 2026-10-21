import React from 'react';
import type { Job, PartyMember } from '../../../types';

// 表の見出しのメンバー列(見本 v11 css:472-475 の .jc)= ロール色の短い線 + ジョブ略号。
// 列の中心は Timeline が実測した memberLayout(差込口と同じ実測)。並び替え・増減・空き列に追従する。
// 略号はジョブ id(小文字 3 字)の大文字。軍事の表でだけ #timeline-header-inner の中に置く。

export interface MilspecMemberHeadsProps {
  members: PartyMember[];
  jobs: Pick<Job, 'id'>[];
  memberLayout: Map<string, { left: number; width: number }>;
}

function MilspecMemberHeadsImpl({ members, jobs, memberLayout }: MilspecMemberHeadsProps) {
  return (
    <div className="milspec-mh" aria-hidden="true">
      {members.map((m) => {
        const l = memberLayout.get(m.id);
        if (!l) return null;
        const job = m.jobId ? jobs.find((j) => j.id === m.jobId) : null;
        return (
          <span key={m.id} className="milspec-mh-item" data-member-head={m.id} data-role={m.role}
            style={{ left: l.left + l.width / 2 }}>
            <i className="milspec-mh-rl" />
            <small>{job ? job.id.toUpperCase() : ''}</small>
          </span>
        );
      })}
    </div>
  );
}

export const MilspecMemberHeads = React.memo(MilspecMemberHeadsImpl);
